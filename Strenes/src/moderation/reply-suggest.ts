/**
 * reply-suggest — generates 3 short AI reply options for a conversation.
 *
 * Priority chain:
 *  1. Anthropic Claude (claude-haiku) — if user has set an API key.
 *     Uses the browser-direct API call with the required header.
 *  2. Chrome Prompt API (Gemini Nano) — if on-device model is available.
 *  3. Returns null — no suggestions shown.
 *
 * The API key is stored only in localStorage and sent only to the provider
 * it belongs to (Claude or Gemini, detected from the key shape).
 */

import { promptCloud } from './cloud';

export interface ChatTurn {
  role: 'incoming' | 'outgoing';
  text: string;
}

const SYSTEM =
  'You suggest 3 short, natural reply options for a conversation. ' +
  'Each reply must be under 12 words. Match the tone of the conversation. ' +
  'Return ONLY a JSON array of 3 strings, nothing else. Example: ["Sure!", "Can\'t make it, sorry", "Let me check and get back"]';

function parseReplies(raw: string): string[] | null {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr) || arr.length < 1) return null;
    return (arr as unknown[])
      .filter((x): x is string => typeof x === 'string' && x.length > 0)
      .slice(0, 3);
  } catch {
    return null;
  }
}

function buildPrompt(history: ChatTurn[], senderName: string): string {
  const lines = history.map(t =>
    t.role === 'incoming' ? `${senderName}: ${t.text}` : `Me: ${t.text}`
  );
  return lines.join('\n') + '\n\nSuggest 3 short reply options for "Me":';
}

/* ── Anthropic Claude (browser-direct) ─────────────────────────────── */

async function suggestViaAnthropic(
  history: ChatTurn[],
  senderName: string,
  apiKey: string,
): Promise<string[] | null> {
  // Routes to Claude or Gemini depending on the key the user pasted.
  const raw = await promptCloud(SYSTEM, buildPrompt(history, senderName), apiKey, { maxTokens: 200 });
  if (!raw) return null;
  return parseReplies(raw);
}

/* ── Chrome Prompt API / Gemini Nano ───────────────────────────────── */

function getPromptApi(): LanguageModelStatic | null {
  if (typeof window === 'undefined') return null;
  if ((window as Window).LanguageModel?.availability) return (window as Window).LanguageModel!;
  const legacy = (window as Window).ai?.languageModel;
  if (legacy?.capabilities) {
    return {
      async availability() {
        const c = await legacy.capabilities!();
        return c.available === 'readily' ? 'available' : c.available === 'after-download' ? 'downloadable' : 'unavailable';
      },
      create: opts => legacy.create!(opts as Parameters<typeof legacy.create>[0]),
    };
  }
  return null;
}

async function suggestViaLocalModel(
  history: ChatTurn[],
  senderName: string,
): Promise<string[] | null> {
  const api = getPromptApi();
  if (!api) return null;
  try {
    if ((await api.availability()) !== 'available') return null;
    const session = await api.create({
      initialPrompts: [{ role: 'system', content: SYSTEM }],
      temperature: 0.7,
      topK: 20,
    });
    try {
      const raw = await session.prompt(buildPrompt(history, senderName));
      return parseReplies(raw);
    } finally {
      session.destroy();
    }
  } catch {
    return null;
  }
}

/* ── Public API ─────────────────────────────────────────────────────── */

export type ReplyEngine = 'claude' | 'local';

export interface SuggestionResult {
  replies: string[];
  engine: ReplyEngine;
}

export async function suggestReplies(
  history: ChatTurn[],
  senderName: string,
  anthropicKey: string,
): Promise<SuggestionResult | null> {
  if (history.length === 0) return null;

  if (anthropicKey.trim()) {
    const replies = await suggestViaAnthropic(history, senderName, anthropicKey.trim());
    if (replies && replies.length > 0) return { replies, engine: 'claude' };
  }

  const replies = await suggestViaLocalModel(history, senderName);
  if (replies && replies.length > 0) return { replies, engine: 'local' };

  return null;
}
