/**
 * cloud — one door to the cloud LLM providers, ported from Strenes.
 * The parent pastes EITHER a Claude key (sk-ant-…) or a Google Gemini key
 * (AIza…) into Settings; the provider is detected from the key shape.
 *
 * With NO key set, calls route through the managed AI proxy — a Supabase
 * Edge Function that holds the provider key server-side — with a small
 * free quota per device.
 *
 * IMPORTANT (privacy): only PerchEvent metadata is ever included in
 * prompts. Message content never exists on the parent's phone at all.
 */

export type CloudProvider = 'claude' | 'gemini';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
const AI_PROXY_FN = import.meta.env.VITE_AI_PROXY_FN ?? 'ai-proxy';

export function proxyAvailable(): boolean {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY && !SUPABASE_URL.includes('your-project');
}

export const FREE_PROXY_LIMIT = 20;
const USES_KEY = '__perch_proxy_uses';

export function proxyUses(): number {
  try { return parseInt(localStorage.getItem(USES_KEY) ?? '0', 10) || 0; } catch { return 0; }
}

export function proxyUsesLeft(): number {
  return Math.max(0, FREE_PROXY_LIMIT - proxyUses());
}

export function proxyQuotaExceeded(): boolean {
  return proxyUses() >= FREE_PROXY_LIMIT;
}

function bumpProxyUses(): void {
  try { localStorage.setItem(USES_KEY, String(proxyUses() + 1)); } catch { /* private mode */ }
}

export function cloudAvailable(apiKey: string | undefined): boolean {
  if (apiKey?.trim()) return true;
  return proxyAvailable() && !proxyQuotaExceeded();
}

async function promptViaProxy(
  system: string,
  user: string,
  maxTokens: number,
  timeoutMs: number,
): Promise<string | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${AI_PROXY_FN}`, {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'content-type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        authorization: `Bearer ${SUPABASE_ANON_KEY}`,
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
  if (k.startsWith('AIza') || k.startsWith('AQ.')) return 'gemini';
  if (k.startsWith('sk-ant-') || k.startsWith('sk-')) return 'claude';
  return 'claude';
}

export function providerLabel(apiKey: string): string {
  const p = detectProvider(apiKey);
  if (p === 'gemini') return 'Gemini (API)';
  if (p === 'claude') return 'Claude (API)';
  return proxyAvailable() ? 'Perch managed AI' : 'On-device';
}

interface CloudOpts {
  maxTokens?: number;
  timeoutMs?: number;
}

/**
 * Run one system+user prompt against whichever provider the key belongs to.
 * Returns the raw completion text, or null on any failure/timeout so callers
 * can fall through to on-device AI or the deterministic analyst.
 */
export async function promptCloud(
  system: string,
  user: string,
  apiKey: string,
  opts: CloudOpts = {},
): Promise<string | null> {
  const key = apiKey.trim();
  const { maxTokens = 500, timeoutMs = 12_000 } = opts;

  if (!key) {
    if (!proxyAvailable() || proxyQuotaExceeded()) return null;
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
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: maxTokens,
              // gemini-2.5-flash spends output budget on internal "thinking"
              // unless disabled — with it on, short caps truncate mid-sentence.
              thinkingConfig: { thinkingBudget: 0 },
            },
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
