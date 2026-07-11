/**
 * cloud — one door to the cloud LLM providers. The user pastes EITHER a
 * Claude key (sk-ant-…) or a Google Gemini key (AIza…) into Settings; the
 * provider is detected from the key shape and every AI surface (Commander
 * parsing, rule evaluation, moderation, replies) routes through here.
 */

export type CloudProvider = 'claude' | 'gemini';

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
  return p === 'gemini' ? 'Gemini (API)' : p === 'claude' ? 'Claude (API)' : '';
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
  const provider = detectProvider(key);
  if (!provider) return null;
  const { maxTokens = 300, timeoutMs = 10_000 } = opts;

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
