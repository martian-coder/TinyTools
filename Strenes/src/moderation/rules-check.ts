import type { DynamicRule } from '../types';
import { isRant } from './insights';
import { promptNano } from './nano';
import { promptCloud, cloudAvailable } from './cloud';

/**
 * checkRuleMatch — decides whether an incoming message matches a rule the
 * recipient wrote in their own words ("hold anything asking me for money").
 *
 * Evaluation chain, best available wins:
 *   1. Anthropic Claude   — when the user configured an API key
 *   2. Gemini Nano        — Chrome's built-in model, fully on-device
 *   3. Heuristics         — rant detector, topic lexicons, keyword overlap
 *
 * The condition is free-form natural language; nothing upstream restricts
 * what the user can express.
 */
export async function checkRuleMatch(
  message: string,
  rule: DynamicRule,
  apiKey: string,
): Promise<{ matches: boolean; reason?: string }> {
  if (cloudAvailable(apiKey)) {
    const viaClaude = await checkViaAnthropic(message, rule, apiKey.trim());
    if (viaClaude) return viaClaude;
  }

  const viaNano = await checkViaNano(message, rule);
  if (viaNano) return viaNano;

  return checkRuleMatchHeuristic(message, rule);
}

const MATCH_SCHEMA = {
  type: 'object',
  required: ['matches'],
  additionalProperties: false,
  properties: {
    matches: { type: 'boolean' },
    reason: { type: 'string' },
  },
} as const;

function ruleSystemPrompt(rule: DynamicRule): string {
  return [
    "You evaluate one message-filtering rule that the phone's owner wrote in their own words.",
    `Rule: "${rule.condition}"`,
    'Decide whether the incoming message should be caught by this rule.',
    'Interpret the rule generously but literally — match the intent of the owner.',
    'Return ONLY JSON: {"matches":true|false,"reason":"<=8 words"}',
  ].join('\n');
}

function parseMatch(raw: string): { matches: boolean; reason?: string } | null {
  const m = raw.match(/\{[\s\S]*?\}/);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[0]) as { matches?: unknown; reason?: unknown };
    if (typeof obj.matches !== 'boolean') return null;
    return { matches: obj.matches, reason: typeof obj.reason === 'string' ? obj.reason.slice(0, 80) : undefined };
  } catch {
    return null;
  }
}

async function checkViaAnthropic(
  message: string,
  rule: DynamicRule,
  apiKey: string,
): Promise<{ matches: boolean; reason?: string } | null> {
  // Routes to Claude or Gemini depending on the key the user pasted.
  const raw = await promptCloud(ruleSystemPrompt(rule), `Incoming message: "${message}"`, apiKey, { maxTokens: 100 });
  if (!raw) return null;
  return parseMatch(raw);
}

async function checkViaNano(
  message: string,
  rule: DynamicRule,
): Promise<{ matches: boolean; reason?: string } | null> {
  const raw = await promptNano(ruleSystemPrompt(rule), `Incoming message: "${message}"`, MATCH_SCHEMA);
  if (!raw) return null;
  return parseMatch(raw);
}

// Words that carry no signal when matching a free-form condition to a message.
const STOPWORDS = new Set([
  'the', 'a', 'an', 'any', 'anything', 'anyone', 'anybody', 'everyone', 'all', 'some',
  'message', 'messages', 'text', 'texts', 'update', 'updates', 'sender', 'senders',
  'from', 'about', 'with', 'when', 'that', 'this', 'them', 'they', 'their', 'says',
  'block', 'hold', 'review', 'hide', 'show', 'stop', 'filter', 'never', 'dont',
  "don't", 'not', 'only', 'asking', 'asks', 'sends', 'sending', 'containing',
  'mentions', 'mentioning', 'talking', 'talks', 'today', 'tomorrow', 'please', 'want',
]);

function checkRuleMatchHeuristic(message: string, rule: DynamicRule): { matches: boolean; reason?: string } {
  const msgLower = message.toLowerCase();
  const ruleLower = rule.condition.toLowerCase();

  // Built-in behavioral conditions ("no ranting messages today").
  if (/\brant|venting|complain/i.test(ruleLower) && isRant(message)) {
    return { matches: true, reason: 'Reads as a rant' };
  }
  if (/\bnegativ/i.test(ruleLower) && isRant(message)) {
    return { matches: true, reason: 'Negative venting' };
  }

  const keywordMatch = ruleLower.match(/(?:mentions?|discusses?|talks?\s+about|says?)\s+(.+)$/);
  if (keywordMatch) {
    const keywords = keywordMatch[1].split(/\s+or\s+|\s*,\s*/);
    for (const kw of keywords) {
      const cleanKw = kw.toLowerCase().replace(/['"]/g, '').trim();
      if (cleanKw && msgLower.includes(cleanKw)) {
        return { matches: true, reason: `Mentions "${cleanKw}"` };
      }
    }
  }

  if (ruleLower.includes('money') && /\b(money|cash|dollars?|payment|invoice|bill|charge|lend|borrow|pay me|venmo|paypal)\b/i.test(message)) {
    return { matches: true, reason: 'Discusses financial topics' };
  }
  if (ruleLower.includes('politic') && /\b(politics|political|election|vote|candidate|republican|democrat|government)\b/i.test(message)) {
    return { matches: true, reason: 'Discusses political topics' };
  }
  if (ruleLower.includes('religion') && /\b(religion|religious|god|church|faith|spiritual)\b/i.test(message)) {
    return { matches: true, reason: 'Discusses religious topics' };
  }
  if (ruleLower.includes('work') && /\b(work|job|boss|coworker|meeting|project|deadline)\b/i.test(message)) {
    return { matches: true, reason: 'Discusses work topics' };
  }
  if (/\blinks?\b|\burls?\b/.test(ruleLower) && /https?:\/\/|www\./i.test(message)) {
    return { matches: true, reason: 'Contains a link' };
  }

  // Generic fallback for free-form conditions: does any significant word of
  // the rule appear in the message? Crude, but keeps arbitrary rules working
  // when no model is available.
  const significant = (ruleLower.match(/[a-z']{4,}/g) || []).filter(w => !STOPWORDS.has(w));
  for (const w of significant) {
    if (msgLower.includes(w)) {
      return { matches: true, reason: `Mentions "${w}"` };
    }
  }

  return { matches: false };
}
