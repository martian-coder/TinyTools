/**
 * commander — natural language intent parser for the Commander inbox assistant.
 * Priority: Anthropic Claude (if API key set) → heuristic regex fallback.
 */

import type { Contact, Message } from '../types';

export interface ReplyIntent      { type: 'reply';       contactId: string; contactName: string; text: string }
export interface OpenIntent       { type: 'open';        contactId: string; contactName: string }
export interface ApproveIntent    { type: 'approve';     messageId?: string }
export interface RejectIntent     { type: 'reject';      messageId?: string }
export interface ShowReviewIntent { type: 'show_review' }
export interface SetRuleIntent {
  type: 'set_rule';
  rule: 'trust' | 'distrust' | 'sensitivity' | 'civility_toggle' | 'spam_toggle' | 'dnd_toggle';
  contactId?: string;
  contactName?: string;
  value?: 'low' | 'medium' | 'high' | 'on' | 'off';
}
export interface QueryIntent {
  type: 'query';
  subject: 'capabilities' | 'held_count' | 'contact_messages' | 'summary' | 'settings';
  contactId?: string;
  contactName?: string;
}
export interface DynamicRuleIntent {
  type: 'dynamic_rule';
  action: 'add' | 'remove';
  contactId?: string;
  contactName?: string;
  condition?: string;
  ruleAction?: 'block' | 'review';
}
export interface UnknownIntent { type: 'unknown'; query: string }

export type Intent =
  | ReplyIntent | OpenIntent | ApproveIntent | RejectIntent
  | ShowReviewIntent | SetRuleIntent | QueryIntent | DynamicRuleIntent | UnknownIntent;

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

  // reply
  const rm = t.match(/^(?:reply(?:\s+to)?|respond\s+to|tell|message|text|msg|send(?:\s+to)?)\s+([a-z']+)\s+(.+)/i);
  if (rm) {
    const c = matchContact(rm[1], contacts);
    if (c) return { type: 'reply', contactId: c.id, contactName: c.name, text: rm[2] };
  }

  // open
  const om = t.match(/^(?:open(?:\s+chat(?:\s+with)?)?|show|see|read|view|go\s+to|check)\s+([a-z']+)/i);
  if (om) {
    const c = matchContact(om[1], contacts);
    if (c) return { type: 'open', contactId: c.id, contactName: c.name };
  }

  // trust
  const trustM = t.match(/^(?:trust|always\s+(?:allow|let\s+through))\s+([a-z']+)/i);
  if (trustM) {
    const c = matchContact(trustM[1], contacts);
    if (c) return { type: 'set_rule', rule: 'trust', contactId: c.id, contactName: c.name };
  }

  // distrust
  const distrustM = t.match(/^(?:don'?t\s+trust|distrust|remove\s+trust(?:\s+from)?|stop\s+trusting|untrust)\s+([a-z']+)/i);
  if (distrustM) {
    const c = matchContact(distrustM[1], contacts);
    if (c) return { type: 'set_rule', rule: 'distrust', contactId: c.id, contactName: c.name };
  }

  // sensitivity
  const sensM = t.match(/^(?:set\s+)?(?:civility\s+)?sensitivity\s+(?:to\s+)?(low|medium|high)/i);
  if (sensM) return { type: 'set_rule', rule: 'sensitivity', value: sensM[1].toLowerCase() as 'low' | 'medium' | 'high' };

  // feature on
  const onM = t.match(/^(?:turn\s+on|enable)\s+(civility(?:\s+filter)?|spam(?:\s+filter)?|dnd|do\s+not\s+disturb)/i);
  if (onM) {
    const f = onM[1].toLowerCase();
    if (f.includes('civility')) return { type: 'set_rule', rule: 'civility_toggle', value: 'on' };
    if (f.includes('spam'))     return { type: 'set_rule', rule: 'spam_toggle',     value: 'on' };
    if (f.includes('dnd') || f.includes('disturb')) return { type: 'set_rule', rule: 'dnd_toggle', value: 'on' };
  }

  // feature off
  const offM = t.match(/^(?:turn\s+off|disable)\s+(civility(?:\s+filter)?|spam(?:\s+filter)?|dnd|do\s+not\s+disturb)/i);
  if (offM) {
    const f = offM[1].toLowerCase();
    if (f.includes('civility')) return { type: 'set_rule', rule: 'civility_toggle', value: 'off' };
    if (f.includes('spam'))     return { type: 'set_rule', rule: 'spam_toggle',     value: 'off' };
    if (f.includes('dnd') || f.includes('disturb')) return { type: 'set_rule', rule: 'dnd_toggle', value: 'off' };
  }

  // query: capabilities
  if (/^(?:help|what\s+can\s+(?:you|i)|commands?|options?|capabilities?|what\s+do\s+you)/i.test(t))
    return { type: 'query', subject: 'capabilities' };

  // query: held count
  if (/how\s+many\s+(?:are\s+)?(?:held|pending|waiting|in\s+review)|any\s+held/i.test(t))
    return { type: 'query', subject: 'held_count' };

  // query: contact messages
  const cMsgM = t.match(/^(?:what\s+did|show\s+(?:me\s+)?(?:messages?\s+from)?|messages?\s+from|read\s+from)\s+([a-z']+)/i);
  if (cMsgM) {
    const c = matchContact(cMsgM[1], contacts);
    if (c) return { type: 'query', subject: 'contact_messages', contactId: c.id, contactName: c.name };
  }

  // query: summary
  if (/^(?:summary|briefing|what'?s?\s+new|catch\s+me\s+up|update\s+me|re-brief)/i.test(t))
    return { type: 'query', subject: 'summary' };

  // query: settings
  if (/^(?:my\s+(?:settings?|rules?)|(?:show\s+)?settings?|what\s+are\s+my\s+rules?)/i.test(t))
    return { type: 'query', subject: 'settings' };

  // dynamic rule: block if/when
  const blockM = t.match(/^(?:block|rule:?\s+block)\s+([a-z']+)\s+(?:if|when)\s+(.+)/i);
  if (blockM) {
    const c = matchContact(blockM[1], contacts);
    if (c) return {
      type: 'dynamic_rule',
      action: 'add',
      contactId: c.id,
      contactName: c.name,
      condition: blockM[2],
      ruleAction: 'block',
    };
  }

  // dynamic rule: review if/when
  const reviewM = t.match(/^(?:review|check|rule:?\s+review)\s+([a-z']+)\s+(?:if|when)\s+(.+)/i);
  if (reviewM) {
    const c = matchContact(reviewM[1], contacts);
    if (c) return {
      type: 'dynamic_rule',
      action: 'add',
      contactId: c.id,
      contactName: c.name,
      condition: reviewM[2],
      ruleAction: 'review',
    };
  }

  // legacy patterns
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
  const contactList = contacts.map(c => `id:${c.id} name:"${c.name}" trusted:${c.trusted}`).join('\n');
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
    '{"type":"set_rule","rule":"trust","contactId":"<id>","contactName":"<name>"}\n' +
    '{"type":"set_rule","rule":"distrust","contactId":"<id>","contactName":"<name>"}\n' +
    '{"type":"set_rule","rule":"sensitivity","value":"low|medium|high"}\n' +
    '{"type":"set_rule","rule":"civility_toggle","value":"on|off"}\n' +
    '{"type":"set_rule","rule":"spam_toggle","value":"on|off"}\n' +
    '{"type":"set_rule","rule":"dnd_toggle","value":"on|off"}\n' +
    '{"type":"query","subject":"capabilities"}\n' +
    '{"type":"query","subject":"held_count"}\n' +
    '{"type":"query","subject":"contact_messages","contactId":"<id>","contactName":"<name>"}\n' +
    '{"type":"query","subject":"summary"}\n' +
    '{"type":"query","subject":"settings"}\n' +
    '{"type":"dynamic_rule","action":"add","contactId":"<id>","contactName":"<name>","condition":"<condition>","ruleAction":"block|review"}\n' +
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
    const raw  = data.content?.find(b => b.type === 'text')?.text ?? '';
    const m    = raw.match(/\{[\s\S]*?\}/);
    if (!m) return parseHeuristic(text, contacts);
    return JSON.parse(m[0]) as Intent;
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
  if (apiKey.trim()) return parseViaAnthropic(text, contacts, heldMessages, apiKey.trim());
  return parseHeuristic(text, contacts);
}
