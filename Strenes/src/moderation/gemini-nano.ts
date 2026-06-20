import type { Category, ModerationVerdict } from '../types';
import type { Moderator, Sensitivity } from './types';
import { classifyByRules } from './rules';

/**
 * GeminiNanoModerator — the real on-device AI engine for the web.
 *
 * Uses Chrome's built-in Prompt API, which runs **Gemini Nano locally on the
 * device**. Inference happens entirely on-device: once the model is present,
 * classifying a message makes ZERO network requests, and the message plaintext
 * never leaves the machine. This is the web analog of the spec's native
 * GeminiNanoModerator (ML Kit GenAI Prompt API on AICore).
 *
 * Hard rule (SIFT_BUILD.md §5): plaintext must never be sent off-device. We
 * therefore only report ourselves available when the model is fully downloaded
 * ('available'), so classify() can never trigger a fetch mid-classification.
 * Anything else falls back to RulesModerator.
 */

// Shared classification prompt (SIFT_BUILD.md §5). Force structured JSON output.
const SYSTEM_PROMPT = (sensitivity: Sensitivity) =>
  [
    "You are a message-safety classifier running privately on the user's phone.",
    'Classify the message into exactly one category: clean | abusive | spam | business | promo.',
    '"abusive" = insults, harassment, threats, hateful or demeaning language.',
    '"spam" = chain forwards, scams, bait, junk blasts.',
    '"business" = orders, deliveries, receipts, OTPs, appointments.',
    '"promo" = sales, discounts, marketing offers.',
    `Sensitivity is ${sensitivity}: higher = flag milder language as abusive.`,
    'Return ONLY JSON: {"category":"...","confidence":0.0-1.0,"reason":"<=8 words"}.',
  ].join('\n');

// JSON schema constraint (when the browser supports responseConstraint, this
// guarantees parseable output; harmless when ignored).
const RESPONSE_SCHEMA = {
  type: 'object',
  required: ['category', 'confidence'],
  additionalProperties: false,
  properties: {
    category: { type: 'string', enum: ['clean', 'abusive', 'spam', 'business', 'promo'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    reason: { type: 'string' },
  },
} as const;

function getPromptApi(): LanguageModelStatic | null {
  if (typeof window === 'undefined') return null;
  if (window.LanguageModel?.availability) return window.LanguageModel;
  // Legacy window.ai shim → adapt to the modern shape.
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

function parseVerdict(raw: string): ModerationVerdict | null {
  // The model may wrap JSON in prose or code fences; extract the first object.
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
      engine: 'gemini-nano',
    };
  } catch {
    return null;
  }
}

export const GeminiNanoModerator: Moderator = {
  name: 'gemini-nano',

  async isAvailable() {
    const api = getPromptApi();
    if (!api) return false;
    try {
      // Only "available" means weights are already on-device — so classify()
      // is guaranteed network-free. 'downloadable'/'downloading' would require
      // a fetch, so we defer to rules until the model is ready.
      return (await api.availability()) === 'available';
    } catch {
      return false;
    }
  },

  async classify(text, { sensitivity }) {
    // Pre-filter with the rules engine. Obvious wordlist hits are resolved
    // instantly and honestly attributed to 'rules'; only borderline input
    // (nothing matched) is escalated to the model — saving battery/compute and
    // mirroring the spec's engine-selection flow.
    const pre = classifyByRules(text, sensitivity);
    if (pre.category !== 'clean') return pre;

    const api = getPromptApi();
    if (!api) return pre;

    let session: LanguageModelSession | null = null;
    try {
      session = await api.create({
        initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT(sensitivity) }],
        temperature: 0,
        topK: 1,
      });
      let raw: string;
      try {
        raw = await session.prompt(text, { responseConstraint: RESPONSE_SCHEMA });
      } catch {
        // Browser may not support responseConstraint — retry unconstrained.
        raw = await session.prompt(text);
      }
      return parseVerdict(raw) ?? pre;
    } catch {
      // Any model failure → silent, graceful fallback to the rules verdict.
      return pre;
    } finally {
      session?.destroy();
    }
  },
};
