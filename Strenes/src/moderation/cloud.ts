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

export const FREE_PROXY_LIMIT = 40;
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

/** Why the last managed-proxy call failed (for user-facing diagnostics). */
export let lastProxyError = '';
/** Why the last DIRECT (pasted-key) call failed — set by promptCloud below. */
export let lastDirectError = '';

async function callProxy(
  bearer: string,
  system: string,
  user: string,
  maxTokens: number,
  timeoutMs: number,
): Promise<Response> {
  return fetch(`${SUPABASE_URL}/functions/v1/${AI_PROXY_FN}`, {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'content-type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify({ system, user, maxTokens }),
  });
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

    let res = await callProxy(bearer, system, user, maxTokens, timeoutMs);
    // A stale/rejected session token must not kill AI — the anon key is
    // always valid for this project, so retry with it once.
    if (!res.ok && (res.status === 401 || res.status === 403) && bearer !== SUPABASE_ANON_KEY) {
      res = await callProxy(SUPABASE_ANON_KEY, system, user, maxTokens, timeoutMs);
    }
    if (!res.ok) {
      lastProxyError = `AI service returned ${res.status}`;
      return null;
    }
    const data = await res.json() as { text?: string | null };
    if (!data.text) { lastProxyError = 'AI service sent an empty reply'; return null; }
    lastProxyError = '';
    return data.text;
  } catch (e) {
    lastProxyError = e instanceof Error && e.name === 'TimeoutError'
      ? 'AI service timed out' : 'No connection to the AI service';
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
  /**
   * Whether this call spends the user-visible free-quota counter (the one
   * that triggers "add your API key" in Commander). Default true.
   * Background/automatic calls the user never asked for — message
   * moderation, reply suggestions, rule checks — pass false so they don't
   * silently eat the quota reserved for Commander chat (mirrors Perch,
   * which only ever spends its quota on an explicit parent question).
   * The edge function's own per-caller rate limit is the real cost guard
   * either way; this flag only controls the client-side UX counter.
   */
  countsTowardQuota?: boolean;
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
  const { maxTokens = 300, timeoutMs = 10_000, countsTowardQuota = true } = opts;

  // No key pasted → managed server-side proxy (key never ships to clients).
  // Free quota spent or the user opted for on-device AI → return null so
  // every caller falls through to Gemini Nano / heuristics.
  if (!key) {
    // localOnlyChosen is a privacy choice (no message content leaves the
    // device) — always honored. proxyQuotaExceeded only gates calls that
    // spend the visible quota.
    if (!proxyAvailable() || localOnlyChosen() || (countsTowardQuota && proxyQuotaExceeded())) return null;
    const out = await promptViaProxy(system, user, maxTokens, timeoutMs);
    if (out && countsTowardQuota) bumpProxyUses();
    return out;
  }

  const provider = detectProvider(key);
  if (!provider) return null;

  // One retry after a short pause for rate-limit/overload responses only —
  // free-tier Gemini keys are capped around 10-15 requests/minute, so a
  // single retry recovers the very common "just hit the per-minute cap"
  // case instead of surfacing it as a random, unexplained failure.
  const fetchWithRetry = async (url: string, init: RequestInit): Promise<Response> => {
    const res = await fetch(url, init);
    if (res.status !== 429 && res.status !== 503) return res;
    await new Promise(r => setTimeout(r, 1500));
    return fetch(url, init);
  };

  const describeError = async (res: Response, providerLabel: string): Promise<string> => {
    let detail = '';
    try {
      const body = await res.json() as { error?: { message?: string } };
      detail = body?.error?.message ?? '';
    } catch { /* non-JSON error body */ }
    if (res.status === 429) return `${providerLabel} rate limit hit (free-tier keys allow ~10-15 requests/min) — try again in a minute`;
    if (res.status === 401 || res.status === 403) return `${providerLabel} rejected the key (${res.status}) — check it was copied correctly and is active`;
    return `${providerLabel} error ${res.status}${detail ? `: ${detail.slice(0, 120)}` : ''}`;
  };

  try {
    if (provider === 'gemini') {
      const res = await fetchWithRetry(
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
      if (!res.ok) { lastDirectError = await describeError(res, 'Gemini'); return null; }
      const data = await res.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? '';
      if (!text) { lastDirectError = 'Gemini returned an empty response'; return null; }
      lastDirectError = '';
      return text;
    }

    // Claude
    const res = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
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
    if (!res.ok) { lastDirectError = await describeError(res, 'Claude'); return null; }
    const data = await res.json() as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.find(b => b.type === 'text')?.text ?? null;
    if (!text) { lastDirectError = 'Claude returned an empty response'; return null; }
    lastDirectError = '';
    return text;
  } catch (e) {
    lastDirectError = e instanceof Error && e.name === 'TimeoutError' ? 'Request timed out' : 'No connection';
    return null;
  }
}
