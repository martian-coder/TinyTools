/**
 * summarizeMessage — on-device AI summarizer.
 *
 * Uses Chrome's built-in Prompt API (Gemini Nano) when available.
 * Zero network requests: text never leaves the device.
 * Falls back to a simple text truncation when the model isn't ready.
 */

function getPromptApi(): LanguageModelStatic | null {
  if (typeof window === 'undefined') return null;
  if ((window as Window).LanguageModel?.availability) return (window as Window).LanguageModel!;
  const legacy = (window as Window).ai?.languageModel;
  if (legacy?.capabilities) {
    return {
      async availability() {
        const c = await legacy.capabilities!();
        return c.available === 'readily'
          ? 'available'
          : c.available === 'after-download'
            ? 'downloadable'
            : 'unavailable';
      },
      create: opts => legacy.create!(opts as Parameters<typeof legacy.create>[0]),
    };
  }
  return null;
}

const SYSTEM_PROMPT =
  "Summarize what this message is asking or saying in 8–10 words. " +
  "Be specific. Do NOT include the sender's name. No quotes. No trailing period.";

export async function summarizeMessage(text: string, senderName: string): Promise<string> {
  const fallback = text.length > 60 ? text.slice(0, 57).trimEnd() + '…' : text;

  const api = getPromptApi();
  if (!api) return fallback;

  try {
    if ((await api.availability()) !== 'available') return fallback;

    const session = await api.create({
      initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT }],
      temperature: 0.4,
      topK: 10,
    });

    try {
      const raw = await session.prompt(`Message from ${senderName}: ${text}`);
      const clean = raw.trim().replace(/^["']|["']$/g, '').replace(/\.$/, '');
      return clean || fallback;
    } finally {
      session.destroy();
    }
  } catch {
    return fallback;
  }
}
