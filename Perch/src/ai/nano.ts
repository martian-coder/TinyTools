/**
 * nano — Chrome's built-in Prompt API (Gemini Nano), fully on-device.
 * We only run when the model reports 'available' (weights already local),
 * so a call can never trigger a download or any network traffic.
 */

export function getPromptApi(): LanguageModelStatic | null {
  if (typeof window === 'undefined') return null;
  if (window.LanguageModel?.availability) return window.LanguageModel;
  const legacy = window.ai?.languageModel;
  if (legacy?.capabilities) {
    return {
      async availability() {
        const c = await legacy.capabilities();
        return c.available === 'readily'
          ? 'available'
          : c.available === 'after-download'
            ? 'downloadable'
            : 'unavailable';
      },
      create: opts => legacy.create(opts),
    };
  }
  return null;
}

export async function nanoReady(): Promise<boolean> {
  const api = getPromptApi();
  if (!api) return false;
  try {
    return (await api.availability()) === 'available';
  } catch {
    return false;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('nano-timeout')), ms)),
  ]);
}

/**
 * Run one prompt against the on-device model. Returns the raw completion,
 * or null when the model isn't ready, errors, or takes too long.
 */
export async function promptNano(system: string, user: string, timeoutMs = 10_000): Promise<string | null> {
  const api = getPromptApi();
  if (!api) return null;
  try {
    if ((await withTimeout(api.availability(), 2500)) !== 'available') return null;
  } catch {
    return null;
  }

  let session: LanguageModelSession | null = null;
  try {
    const run = (async () => {
      session = await api.create({
        initialPrompts: [{ role: 'system', content: system }],
        temperature: 0.2,
        topK: 3,
      });
      return await session.prompt(user);
    })();
    return await withTimeout(run, timeoutMs);
  } catch {
    return null;
  } finally {
    try { (session as LanguageModelSession | null)?.destroy(); } catch { /* may still be initializing */ }
  }
}
