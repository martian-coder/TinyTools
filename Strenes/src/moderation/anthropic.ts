import type { Category, ModerationVerdict } from '../types';
import type { Moderator, Sensitivity } from './types';
import { classifyByRules } from './rules';

/**
 * AnthropicModerator — optional cloud-based AI engine using Claude.
 *
 * If the user provides an Anthropic API key, this engine is available and
 * can be used for more sophisticated classification. It requires network access
 * and sends text to Anthropic's servers (not on-device).
 *
 * Hard rule (SIFT_BUILD.md §5): this engine is only enabled if:
 * 1. An API key is configured in settings
 * 2. User explicitly chose this engine during setup/settings
 * 3. Fallback to rules always available if network is unavailable
 */

const SYSTEM_PROMPT = (sensitivity: Sensitivity) =>
  [
    "You are a message-safety classifier.",
    'Classify the message into exactly one category: clean | abusive | spam | business | promo.',
    '"abusive" = insults, harassment, threats, hateful or demeaning language.',
    '"spam" = chain forwards, scams, bait, junk blasts.',
    '"business" = orders, deliveries, receipts, OTPs, appointments.',
    '"promo" = sales, discounts, marketing offers.',
    `Sensitivity is ${sensitivity}: higher = flag milder language as abusive.`,
    'Return ONLY JSON: {"category":"...","confidence":0.0-1.0,"reason":"<=8 words"}.',
  ].join('\n');

function parseVerdict(raw: string): ModerationVerdict | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]) as { category?: string; confidence?: number; reason?: string };
    const valid: Category[] = ['clean', 'abusive', 'spam', 'business', 'promo'];
    if (!obj.category || !valid.includes(obj.category as Category)) return null;
    const confidence =
      typeof obj.confidence === 'number' && obj.confidence >= 0 && obj.confidence <= 1
        ? obj.confidence
        : 0.85;
    return {
      category: obj.category as Category,
      confidence,
      reason: typeof obj.reason === 'string' ? obj.reason.slice(0, 80) : undefined,
      flaggedTerms: [],
      engine: 'anthropic-claude',
    };
  } catch {
    return null;
  }
}

/**
 * Create an AnthropicModerator with the given API key.
 * The key must be provided and non-empty; returns null if not.
 */
export function createAnthropicModerator(apiKey: string): Moderator | null {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) return null;

  const key = apiKey.trim();

  return {
    name: 'anthropic-claude',

    async isAvailable() {
      // Only available if API key is configured
      return !!key;
    },

    async classify(text, { sensitivity }) {
      // Pre-filter with rules first; only escalate borderline cases to Claude
      const pre = classifyByRules(text, sensitivity);
      if (pre.category !== 'clean') return pre;

      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-opus-4-8',
            max_tokens: 256,
            system: SYSTEM_PROMPT(sensitivity),
            messages: [
              {
                role: 'user',
                content: text,
              },
            ],
          }),
        });

        if (!response.ok) {
          // API error → silent fallback to rules
          return pre;
        }

        const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
        const textContent = data.content?.find((c) => c.type === 'text');
        if (!textContent || !textContent.text) return pre;

        return parseVerdict(textContent.text) ?? pre;
      } catch {
        // Network error → silent fallback to rules
        return pre;
      }
    },
  };
}
