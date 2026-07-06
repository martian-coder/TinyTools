/**
 * nano — shared access to Chrome's built-in Prompt API (Gemini Nano).
 * One place to probe availability and run a single system+user prompt,
 * used by rule evaluation, summaries, and reply suggestion.
 *
 * Hard rule (SIFT_BUILD.md §5): plaintext never leaves the device. We only
 * run when the model reports 'available' (weights already local), so a call
 * can never trigger a download or any network traffic.
 */

export function getPromptApi(): LanguageModelStatic | null {
  if (typeof window === 'undefined') return null;
  if (window.LanguageModel?.availability) return window.LanguageModel;
  // Legacy origin-trial surface (Chrome < 138): window.ai.languageModel
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

/**
 * Run one prompt against the on-device model. Returns the raw completion, or
 * null when the model isn't ready or errors — callers fall back heuristically.
 */
export async function promptNano(system: string, user: string, schema?: object): Promise<string | null> {
  const api = getPromptApi();
  if (!api) return null;
  try {
    if ((await api.availability()) !== 'available') return null;
  } catch {
    return null;
  }

  let session: LanguageModelSession | null = null;
  try {
    session = await api.create({
      initialPrompts: [{ role: 'system', content: system }],
      temperature: 0,
      topK: 1,
    });
    try {
      return await session.prompt(user, schema ? { responseConstraint: schema } : undefined);
    } catch {
      // Browser may not support responseConstraint — retry unconstrained.
      return await session.prompt(user);
    }
  } catch {
    return null;
  } finally {
    session?.destroy();
  }
}
