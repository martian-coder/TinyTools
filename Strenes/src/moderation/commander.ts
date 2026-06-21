/**
 * commander — natural language intent parser for the Commander inbox assistant.
 * Priority: Anthropic Claude (if API key set) → heuristic regex fallback.
 */

import type { Contact, Message } from '../types';

export interface ReplyIntent     { type: 'reply';       contactId: string; contactName: string; text: string }
export interface OpenIntent      { type: 'open';        contactId: string; contactName: string }
export interface ApproveIntent   { type: 'approve';     messageId?: string }
export interface RejectIntent    { type: 'reject';      messageId?: string }
export interface ShowReviewIntent { type: 'show_review' }
export interface UnknownIntent   { type: 'unknown';     query: string }

export type Intent =
  | ReplyIntent | OpenIntent | ApproveIntent
  | RejectIntent | ShowReviewIntent | UnknownIntent;

function matchContact(name: string, contacts: Contact[]): Contact | undefined {
  const lower = name.toLowerCase().trim();
  return (
    contacts.find(c => c.name.toLowerCase() === lower) ??
    contacts.find(c => c.name.toLowerCase().startsWith(lower)) ??
    contacts.find(c => c.name.toLowerCase().includes(lower))
  );
}

function parseHeuristic(text: string, contacts: Contact[]): Intent {
  const t = text.trim();

  const replyRe = /^(?:reply(?:\s+to)?|respond\s+to|tell|message|text|msg|send(?:\s+to)?)\s+([a-z']+)\s+(.+)/i;
  const rm = t.match(replyRe);
  if (rm) {
    const c = matchContact(rm[1], contacts);
    if (c) return { type: 'reply', contactId: c.id, contactName: c.name, text: rm[2] };
  }

  const openRe = /^(?:open(?:\s+chat(?:\s+with)?)?|show|see|read|view|go\s+to|check)\s+([a-z']+)/i;
  const om = t.match(openRe);
  if (om) {
    const c = matchContact(om[1], contacts);
    if (c) return { type: 'open', contactId: c.id, contactName: c.name };
  }

  if (/(?:review|pending|held|waiting|queue|filter)/i.test(t)) return { type: 'show_review' };
  if (/(?:approve|allow|let\s+(?:in|through)|accept)/i.test(t))   return { type: 'approve' };
  if (/(?:reject|block|dismiss|ignore|decline|delete|discard)/i.test(t)) return { type: 'reject' };

  return { type: 'unknown', query: t };
}

async function parseViaAnthropic(
  text: string,
  contacts: Contact[],
  heldMessages: Message[],
  apiKey: string,
): Promise<Intent> {
  const contactList = contacts.map(c => `id:${c.id} name:"${c.name}"`).join('\n');
  const heldList    = heldMessages.slice(0, 5).map(m => {
    const c = contacts.find(x => x.id === m.contactId);
    return `id:${m.id} from:"${c?.name ?? 'unknown'}" text:"${m.text.slice(0, 80)}"`;
  }).join('\n');

  const system =
    'Parse a natural language inbox command. Return ONLY a JSON object, no prose.\n\n' +
    'Contacts:\n' + contactList + '\n\n' +
    'Held messages:\n' + (heldList || '(none)') + '\n\n' +
    'Allowed shapes:\n' +
    '{"type":"reply","contactId":"<id>","contactName":"<name>","text":"<reply text>"}\n' +
    '{"type":"open","contactId":"<id>","contactName":"<name>"}\n' +
    '{"type":"approve","messageId":"<id or omit for all>"}\n' +
    '{"type":"reject","messageId":"<id or omit for all>"}\n' +
    '{"type":"show_review"}\n' +
    '{"type":"unknown","query":"<original input>"}';

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system,
        messages: [{ role: 'user', content: text }],
      }),
    });
    if (!res.ok) return parseHeuristic(text, contacts);
    const data = await res.json() as { content?: Array<{ type: string; text?: string }> };
    const raw   = data.content?.find(b => b.type === 'text')?.text ?? '';
    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) return parseHeuristic(text, contacts);
    return JSON.parse(match[0]) as Intent;
  } catch {
    return parseHeuristic(text, contacts);
  }
}

export async function parseIntent(
  text: string,
  contacts: Contact[],
  heldMessages: Message[],
  apiKey: string,
): Promise<Intent> {
  if (apiKey.trim()) {
    return parseViaAnthropic(text, contacts, heldMessages, apiKey.trim());
  }
  return parseHeuristic(text, contacts);
}
