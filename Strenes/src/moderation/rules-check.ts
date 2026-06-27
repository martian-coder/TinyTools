import type { DynamicRule } from '../types';

export async function checkRuleMatch(
  message: string,
  rule: DynamicRule,
  apiKey: string,
): Promise<{ matches: boolean; reason?: string }> {
  if (!apiKey.trim()) {
    return checkRuleMatchHeuristic(message, rule);
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        system: `You are a rule evaluator. Check if a message matches a rule condition.
Rule: "${rule.condition}"
Message: "${message}"

Respond ONLY with valid JSON: {"matches": true|false, "reason": "brief explanation"}`,
        messages: [{ role: 'user', content: 'Check the rule match' }],
      }),
    });

    if (!res.ok) return checkRuleMatchHeuristic(message, rule);
    const data = await res.json() as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.find(b => b.type === 'text')?.text ?? '';
    const m = text.match(/\{[\s\S]*?\}/);
    if (!m) return checkRuleMatchHeuristic(message, rule);
    return JSON.parse(m[0]) as { matches: boolean; reason?: string };
  } catch {
    return checkRuleMatchHeuristic(message, rule);
  }
}

function checkRuleMatchHeuristic(message: string, rule: DynamicRule): { matches: boolean; reason?: string } {
  const msgLower = message.toLowerCase();
  const ruleLower = rule.condition.toLowerCase();

  const keywordMatch = ruleLower.match(/(?:mentions?|discusses?|talks?\s+about|says?)\s+(.+?)(?:\s+or|$)/);
  if (keywordMatch) {
    const keywords = keywordMatch[1].split(/\s+or\s+|\s*,\s*/);
    for (const kw of keywords) {
      const cleanKw = kw.toLowerCase().replace(/['"]/g, '').trim();
      if (msgLower.includes(cleanKw)) {
        return { matches: true, reason: `Mentions "${cleanKw}"` };
      }
    }
  }

  if (ruleLower.includes('money') && /\b(money|cash|dollars?|payment|invoice|bill|charge)\b/i.test(message)) {
    return { matches: true, reason: 'Discusses financial topics' };
  }
  if (ruleLower.includes('politics') && /\b(politics|election|vote|candidate|republican|democrat|government)\b/i.test(message)) {
    return { matches: true, reason: 'Discusses political topics' };
  }
  if (ruleLower.includes('religion') && /\b(religion|religious|god|church|faith|spiritual)\b/i.test(message)) {
    return { matches: true, reason: 'Discusses religious topics' };
  }
  if (ruleLower.includes('work') && /\b(work|job|boss|coworker|meeting|project|deadline)\b/i.test(message)) {
    return { matches: true, reason: 'Discusses work topics' };
  }

  return { matches: false };
}
