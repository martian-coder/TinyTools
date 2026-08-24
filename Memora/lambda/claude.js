'use strict';

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Voice-optimised system prompt: no markdown, short sentences, conversational tone
const SYSTEM_PROMPT = `You are Memora, a helpful voice assistant speaking through an Amazon Echo device.
Follow these rules without exception:
- Respond in plain spoken English only. No markdown, no bullet points, no lists, no asterisks, no headers.
- Keep every reply to two or three short sentences unless the user clearly needs more.
- Ask at most one clarifying question per turn, never more.
- When you learn something durable about the user (a preference, a name, a routine), say "I'll remember that" and include a JSON block at the end of your reply in the exact format: <MEMORA_FACTS>["fact one","fact two"]</MEMORA_FACTS>. Only include this block when you have something genuinely new to remember — omit it otherwise.
- Speak as though your response will be read aloud to someone driving, so never assume they can see anything.`;

/**
 * @param {Array<{role:string,content:string}>} history - recent turns
 * @param {string[]} facts - durable facts about the user
 * @param {string} userUtterance - what the user just said
 * @returns {{ reply: string, newFacts: string[] }}
 */
async function askClaude(history, facts, userUtterance) {
  const messages = buildMessages(history, userUtterance);
  const systemWithFacts = facts.length
    ? `${SYSTEM_PROMPT}\n\nWhat you know about this user:\n${facts.map(f => `- ${f}`).join('\n')}`
    : SYSTEM_PROMPT;

  const response = await client.messages.create({
    model: process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001',
    max_tokens: 250,
    system: systemWithFacts,
    messages,
  });

  const rawText = response.content[0].text || '';
  const { reply, newFacts } = extractFacts(rawText);
  return { reply, newFacts };
}

function buildMessages(history, userUtterance) {
  const msgs = history.map(turn => ({ role: turn.role, content: turn.content }));
  msgs.push({ role: 'user', content: userUtterance });
  return msgs;
}

function extractFacts(rawText) {
  const match = rawText.match(/<MEMORA_FACTS>([\s\S]*?)<\/MEMORA_FACTS>/);
  if (!match) {
    return { reply: rawText.trim(), newFacts: [] };
  }
  const reply = rawText.replace(match[0], '').trim();
  let newFacts = [];
  try {
    newFacts = JSON.parse(match[1]);
    if (!Array.isArray(newFacts)) newFacts = [];
  } catch (_) {
    // malformed block — ignore it, still return the cleaned reply
  }
  return { reply, newFacts };
}

module.exports = { askClaude };
