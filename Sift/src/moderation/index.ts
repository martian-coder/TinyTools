import type { Moderator, ModerationEngine } from './types';
import { RulesModerator } from './rules';
import { GeminiNanoModerator } from './gemini-nano';

export type { Moderator, Sensitivity } from './types';
export { classifyByRules, moderate, RulesModerator } from './rules';
export { GeminiNanoModerator } from './gemini-nano';
export { routeVerdict } from './route';

/**
 * Engine-selection chain (SIFT_BUILD.md §3). Probe each in priority order and
 * use the first that reports itself available; RulesModerator anchors the chain
 * and is always available, so getModerator() never fails.
 *
 * AppleFMModerator (iOS Foundation Models) and ExecuTorchModerator are
 * native-only engines from the spec — they have no web surface, so on this PWA
 * the realistic on-device model is Gemini Nano via Chrome's Prompt API. The
 * chain is structured so they can slot in unchanged on a native build.
 *
 * Hard rule: no engine in any path makes a network call that sees plaintext.
 */
const CHAIN: Moderator[] = [GeminiNanoModerator, RulesModerator];

let cached: Moderator | null = null;

export async function getModerator(): Promise<Moderator> {
  if (cached) return cached;
  for (const m of CHAIN) {
    try {
      if (await m.isAvailable()) {
        cached = m;
        return cached;
      }
    } catch {
      // ignore and continue down the chain
    }
  }
  cached = RulesModerator;
  return cached;
}

/** Reset the cached engine — used after settings changes or in tests. */
export function resetModerator() {
  cached = null;
}

/** Human-facing label for the on-device chip in the UI. */
export const ENGINE_LABELS: Record<ModerationEngine, string> = {
  'rules': 'on-device rules',
  'apple-fm': 'Apple Intelligence',
  'gemini-nano': 'Gemini Nano',
  'executorch': 'ExecuTorch',
};
