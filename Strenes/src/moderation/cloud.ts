/**
 * cloud — one door to the cloud LLM providers. The user pastes EITHER a
 * Claude key (sk-ant-…) or a Google Gemini key (AIza…) into Settings; the
 * provider is detected from the key shape and every AI surface (Commander
 * parsing, rule evaluation, moderation, replies) routes through here.
 *
 * With NO key set, calls route through the Strenes managed AI proxy — a
 * Supabase Edge Function that holds the provider key server-side, so no
 * key ever ships inside the app.
 */

export type CloudProvider = 'claude' | 'gemini';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
// The deployed edge-function slug. Dashboard-created functions can get a
// generated slug that differs from the intended name — override via env.
const AI_PROXY_FN = import.meta.env.VITE_AI_PROXY_FN ?? 'ai-proxy';

/** True when the managed server-side AI proxy is configured for this build. */
export function proxyAvailable(): boolean {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY && !SUPABASE_URL.includes('your-project');
}

// ── Free-tier quota for the managed proxy ──────────────────────────────────
// The managed proxy runs on the app owner's provider key. Each device gets
// FREE_PROXY_LIMIT successful calls; after that the app asks the user to
// paste their own key (Settings) or continue fully on-device.

export const FREE_PROXY_LIMIT = 20;
const USES_KEY = '__strenes_proxy_uses';
const LOCAL_ONLY_KEY = '__strenes_ai_local_only';

export function proxyUses(): number {
  try { return parseInt(localStorage.getItem(USES_KEY) ?? '0', 10) || 0; } catch { return 0; }
}

export function proxyUsesLeft(): number {
  return Math.max(0, FREE_PROXY_LIMIT - proxyUses());
}

export function proxyQuotaExceeded(): boolean {
  return proxyUses() >= FREE_PROXY_LIMIT;
}

/** The user explicitly picked "keep using on-device AI" after the quota ran out. */
export function localOnlyChosen(): boolean {
  try { return localStorage.getItem(LOCAL_ONLY_KEY) === '1'; } catch { return false; }
}

export function chooseLocalOnly(): void {
  try { localStorage.setItem(LOCAL_ONLY_KEY, '1'); } catch { /* private mode */ }
}

/** Re-enable the managed proxy (e.g. if the user changes their mind before pasting a key). */
export function clearLocalOnly(): void {
  try { localStorage.removeItem(LOCAL_ONLY_KEY); } catch { /* private mode */ }
}

function bumpProxyUses(): void {
  try { localStorage.setItem(USES_KEY, String(proxyUses() + 1)); } catch { /* private mode */ }
}

/** True when ANY cloud AI path exists: a pasted key, or the managed proxy with quota left. */
export function cloudAvailable(apiKey: string | undefined): boolean {
  if (apiKey?.trim()) return true;
  return proxyAvailable() && !proxyQuotaExceeded() && !localOnlyChosen();
}

async function promptViaProxy(
  system: string,
  user: string,
  maxTokens: number,
  timeoutMs: number,
): Promise<string | null> {
  try {
    // Prefer the signed-in session token so the proxy can rate-limit per
    // user; fall back to the anon key (Try Demo / signed-out).
    let bearer = SUPABASE_ANON_KEY;
    try {
      const { supabase } = await import('../services/backends/supabase');
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) bearer = data.session.access_token;
    } catch { /* demo/local builds without a backend still work via anon key */ }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/${AI_PROXY_FN}`, {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'content-type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify({ system, user, maxTokens }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { text?: string | null };
    return data.text || null;
  } catch {
    return null;
  }
}

export function detectProvider(apiKey: string): CloudProvider | null {
  const k = apiKey.trim();
  if (!k) return null;
  // 'AIza…' is the classic Google API key shape; 'AQ.…' is the newer
  // format AI Studio issues.
  if (k.startsWith('AIza') || k.startsWith('AQ.')) return 'gemini';
  if (k.startsWith('sk-ant-') || k.startsWith('sk-')) return 'claude';
  // Unknown shape: assume Claude (the app's historical behavior).
  return 'claude';
}

export function providerLabel(apiKey: string): string {
  const p = detectProvider(apiKey);
  if (p === 'gemini') return 'Gemini (API)';
  if (p === 'claude') return 'Claude (API)';
  return proxyAvailable() ? 'Strenes managed AI' : '';
}

interface CloudOpts {
  maxTokens?: number;
  timeoutMs?: number;
}

/**
 * Run one system+user prompt against whichever provider the key belongs to.
 * Returns the raw completion text, or null on any failure/timeout so callers
 * can fall through to on-device AI or heuristics.
 */
export async function promptCloud(
  system: string,
  user: string,
  apiKey: string,
  opts: CloudOpts = {},
): Promise<string | null> {
  const key = apiKey.trim();
  const { maxTokens = 300, timeoutMs = 10_000 } = opts;

  // No key pasted → managed server-side proxy (key never ships to clients).
  // Free quota spent or the user opted for on-device AI → return null so
  // every caller falls through to Gemini Nano / heuristics.
  if (!key) {
    if (!proxyAvailable() || proxyQuotaExceeded() || localOnlyChosen()) return null;
    const out = await promptViaProxy(system, user, maxTokens, timeoutMs);
    if (out) bumpProxyUses();
    return out;
  }

  const provider = detectProvider(key);
  if (!provider) return null;

  try {
    if (provider === 'gemini') {
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        {
          method: 'POST',
          signal: AbortSignal.timeout(timeoutMs),
          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': key,
          },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: { temperature: 0, maxOutputTokens: maxTokens },
          }),
        },
      );
      if (!res.ok) return null;
      const data = await res.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? '';
      return text || null;
    }

    // Claude
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { content?: Array<{ type: string; text?: string }> };
    return data.content?.find(b => b.type === 'text')?.text ?? null;
  } catch {
    return null;
  }
}
