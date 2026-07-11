import type { Moderator, ModerationEngine } from './types';
import { RulesModerator } from './rules';
import { GeminiNanoModerator } from './gemini-nano';
import { createAnthropicModerator } from './anthropic';

export type { Moderator, Sensitivity } from './types';
export { classifyByRules, moderate, RulesModerator } from './rules';
export { GeminiNanoModerator } from './gemini-nano';
export { createAnthropicModerator } from './anthropic';
export { routeVerdict } from './route';

/**
 * Engine-selection chain (SIFT_BUILD.md §3). Probe each in priority order and
 * use the first that reports itself available; RulesModerator anchors the chain
 * and is always available, so getModerator() never fails.
 *
 * Default chain: Gemini Nano (on-device, no network, Google AI) → Rules (fast heuristic).
 * If user opts into Anthropic Claude during setup and provides an API key,
 * AnthropicModerator is probed first.
 *
 * Hard rule: fallback to RulesModerator if anything fails (network, API key, model).
 */
let cached: Moderator | null = null;

let cachedKey: string | undefined;

export async function getModerator(anthropicKey?: string): Promise<Moderator> {
  // Re-probe when the key changes so pasting one in Settings upgrades the
  // engine immediately instead of after the next reload.
  if (cached && cachedKey === anthropicKey) return cached;
  cachedKey = anthropicKey;

  const chain: Moderator[] = [];
  // Also covers the keyless managed-proxy path (returns null only when
  // neither a key nor the proxy is configured).
  const anthropic = createAnthropicModerator(anthropicKey ?? '');
  if (anthropic) chain.push(anthropic);
  chain.push(GeminiNanoModerator);
  chain.push(RulesModerator);

  for (const m of chain) {
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
  'anthropic-claude': 'Claude (API)',
  'gemini-api': 'Gemini (API)',
};
