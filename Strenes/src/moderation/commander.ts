/**
 * commander — natural language intent parser for the Commander inbox assistant.
 * Priority: Anthropic Claude (if API key set) → heuristic regex fallback.
 */

import type { Contact, Message } from '../types';
import { promptNano } from './nano';
import { promptCloud } from './cloud';
import { matchProfile, PROFILES, type ProfileId, type Circle } from './profiles';

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
  subject: 'capabilities' | 'held_count' | 'contact_messages' | 'summary' | 'settings' | 'rules' | 'circles' | 'memory';
  contactId?: string;
  contactName?: string;
}
export interface DynamicRuleIntent {
  type: 'dynamic_rule';
  action: 'add' | 'remove';
  /** '*' targets every sender ("no ranting messages today"). */
  contactId?: string;
  contactName?: string;
  condition?: string;
  ruleAction?: 'block' | 'review';
  /** Epoch ms when the rule should stop applying; absent = permanent. */
  expiresAt?: number;
  /** For action 'remove': 'all', a 1-based index from the rules list, or a keyword. */
  ruleRef?: string;
}
export interface MuteIntent {
  type: 'mute';
  contactId: string;
  contactName: string;
  /** Epoch ms until which the contact's updates are hidden. */
  untilTs: number;
}
export interface UnmuteIntent { type: 'unmute'; contactId: string; contactName: string }
export interface SummaryStyleIntent { type: 'summary_style'; style: 'professional' | 'casual' | 'brief' }
export interface SetProfileIntent { type: 'set_profile'; profile: ProfileId }
export interface SetCircleIntent { type: 'set_circle'; contactId: string; contactName: string; circle: Circle | null }
export interface RememberIntent {
  type: 'remember';
  note: string;
  kind: 'fact' | 'situation';
  /** e.g. 'breakup' | 'exams' | 'grief' | 'health' | 'newjob' | 'travel' — colors the reply. */
  situationKind?: string;
  expiresAt?: number;
}
export interface ForgetIntent { type: 'forget'; target: 'all' | string }
export interface MemoryExportIntent { type: 'memory_export' }
export interface UnknownIntent { type: 'unknown'; query: string }

export type Intent =
  | ReplyIntent | OpenIntent | ApproveIntent | RejectIntent
  | ShowReviewIntent | SetRuleIntent | QueryIntent | DynamicRuleIntent
  | MuteIntent | UnmuteIntent | SummaryStyleIntent | SetProfileIntent | SetCircleIntent
  | RememberIntent | ForgetIntent | MemoryExportIntent | UnknownIntent;

/**
 * Parse a duration phrase out of a command. Returns the expiry timestamp and
 * the input with the phrase removed (so conditions don't keep "for today").
 * Understands: "for 4 hours/hrs/h", "for 30 minutes/min/m", "for 2 days",
 * "for today"/"today", "until tomorrow", "for the rest of the day", "this week".
 */
export function extractDuration(text: string): { expiresAt?: number; rest: string } {
  const now = new Date();
  const endOfDay = () => new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();

  const patterns: Array<[RegExp, (m: RegExpMatchArray) => number]> = [
    [/\bfor\s+(?:the\s+)?next\s+(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b/i, m => Date.now() + parseFloat(m[1]) * 3_600_000],
    [/\bfor\s+(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b/i, m => Date.now() + parseFloat(m[1]) * 3_600_000],
    [/\bfor\s+(?:the\s+)?next\s+(\d+)\s*(minutes?|mins?|m)\b/i, m => Date.now() + parseInt(m[1]) * 60_000],
    [/\bfor\s+(\d+)\s*(minutes?|mins?|m)\b/i, m => Date.now() + parseInt(m[1]) * 60_000],
    [/\bfor\s+(\d+)\s*(days?|d)\b/i, m => Date.now() + parseInt(m[1]) * 86_400_000],
    [/\b(\d+(?:\.\d+)?)\s*(hours?|hrs?)\b/i, m => Date.now() + parseFloat(m[1]) * 3_600_000],
    [/\b(?:for\s+)?(?:the\s+rest\s+of\s+(?:the\s+)?day|today|till?\s+tonight|until\s+tonight)\b/i, () => endOfDay()],
    [/\buntil\s+tomorrow\b/i, () => endOfDay()],
    [/\b(?:for\s+)?this\s+week\b/i, () => Date.now() + 7 * 86_400_000],
  ];

  for (const [re, calc] of patterns) {
    const m = text.match(re);
    if (m) {
      return { expiresAt: calc(m), rest: text.replace(re, ' ').replace(/\s{2,}/g, ' ').trim() };
    }
  }
  return { rest: text };
}

export function formatUntil(ts: number): string {
  const mins = Math.round((ts - Date.now()) / 60_000);
  if (mins < 90) return `for ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours <= 36) {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 0, 0);
    if (Math.abs(ts - endOfToday.getTime()) < 90 * 60_000) return 'until end of day';
    return `for ${hours} hr${hours !== 1 ? 's' : ''}`;
  }
  return `until ${new Date(ts).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`;
}

function matchContact(name: string, contacts: Contact[]): Contact | undefined {
  const lower = name.toLowerCase().trim();
  return (
    contacts.find(c => c.name.toLowerCase() === lower) ??
    contacts.find(c => c.name.toLowerCase().startsWith(lower)) ??
    contacts.find(c => c.name.toLowerCase().includes(lower))
  );
}

/**
 * Precise command grammar — deterministic patterns for well-formed commands.
 * Returns null when nothing matches so the caller can escalate to the
 * on-device LLM before falling back to the rule catch-all.
 */
function parsePrecise(text: string, contacts: Contact[]): Intent | null {
  const t = text.trim();
  const { expiresAt, rest } = extractDuration(t);
  const endOfDay = () => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1).getTime();
  };

  // summary style: "summary should be professional", "casual summaries"
  const styleM = t.match(/summar(?:y|ies).{0,24}?\b(professional|formal|casual|friendly|brief|short)\b|\b(professional|formal|casual|friendly|brief|short)\b.{0,10}summar(?:y|ies)/i);
  if (styleM) {
    const raw = (styleM[1] || styleM[2] || '').toLowerCase();
    const style = (raw === 'formal' ? 'professional' : raw === 'friendly' ? 'casual' : raw === 'short' ? 'brief' : raw) as 'professional' | 'casual' | 'brief';
    return { type: 'summary_style', style };
  }

  // protection profiles: "use elder shield", "professional mode", "protect my parents' phone"
  const wantsProfile = /\b(shield|mode|profile|protection|preset)\b/i.test(rest)
    || /^(?:elder|public)\b/i.test(rest)
    || /protect\s+(?:my|this|the)\b/i.test(rest);
  if (wantsProfile) {
    const pid = matchProfile(rest);
    if (pid) return { type: 'set_profile', profile: pid };
  }

  // circles: "maya is family", "mark jay as work", "sara is my vip", "remove jay from circles"
  if (/^(?:show\s+|list\s+)?(?:my\s+)?circles?\s*$|^who(?:'?s|\s+is|\s+are)?\s+(?:all\s+)?in\s+my\s+circles?/i.test(rest)) {
    return { type: 'query', subject: 'circles' };
  }
  const circleM = rest.match(/^(?:mark\s+|set\s+|add\s+)?([a-z']+)\s+(?:is|as|to|=)\s*(?:my\s+|a\s+|the\s+)?(family|work|office|colleague|friend|friends|bestie|vip|inner\s+circle|important|client|priority)s?\s*(?:circle|contact|person)?\s*$/i);
  if (circleM) {
    const c = matchContact(circleM[1], contacts);
    if (c) {
      const raw = circleM[2].toLowerCase();
      const circle: Circle = /work|office|colleague|client/.test(raw) ? 'work'
        : /friend|bestie/.test(raw) ? 'friends'
        : /vip|inner|important|priority/.test(raw) ? 'vip'
        : 'family';
      return { type: 'set_circle', contactId: c.id, contactName: c.name, circle };
    }
  }
  const circleRmM = rest.match(/^(?:remove|take)\s+([a-z']+)\s+(?:from|out\s+of)\s+(?:my\s+)?(?:circles?|family|work|friends|vips?)\s*$/i);
  if (circleRmM) {
    const c = matchContact(circleRmM[1], contacts);
    if (c) return { type: 'set_circle', contactId: c.id, contactName: c.name, circle: null };
  }

  // memory: "remember that...", "what do you remember", "forget X", "export memory"
  if (/^what\s+do\s+you\s+(?:remember|know)(?:\s+about\s+me)?\??$|^(?:show\s+|my\s+)memory\s*$/i.test(rest)) {
    return { type: 'query', subject: 'memory' };
  }
  if (/^(?:export|download|save)\s+(?:my\s+)?memory\s*$/i.test(rest)) {
    return { type: 'memory_export' };
  }
  const forgetM = rest.match(/^forget\s+(?:about\s+)?(everything|all|it all)\s*$/i)
    ?? rest.match(/^forget\s+(?:about\s+)?(.+)$/i);
  if (forgetM) {
    const target = /^(everything|all|it all)$/i.test(forgetM[1]) ? 'all' : forgetM[1].trim();
    return { type: 'forget', target };
  }
  const rememberM = rest.match(/^(?:remember|note|keep\s+in\s+mind)\s+(?:that\s+)?(.+)$/i);
  if (rememberM) {
    return { type: 'remember', note: rememberM[1].trim(), kind: 'fact', expiresAt };
  }
  // life situations: "i'm going through a breakup", "exams this week", "lost my dad"
  const sitM = t.match(/\b(break\s*up|breakup|divorce|separat(?:ed|ing)|exams?|finals|lost\s+my\s+\w+|funeral|griev|passed\s+away|sick|unwell|hospital|surgery|new\s+job|job\s+interview|interview\s+week|new\s+baby|pregnan|wedding|getting\s+married|moving\s+(?:house|out|cit)|travell?ing|vacation|burn(?:ed|t)?\s*out|overwhelmed|stressed)\b/i);
  const sitContext = /\b(?:i'?m|i\s+am|i\s+have|i'?ve|my|going\s+through|dealing\s+with|just\s+had|feeling)\b/i.test(t);
  if (sitM && sitContext) {
    const w = sitM[1].toLowerCase();
    const situationKind =
      /break|divorce|separat/.test(w) ? 'breakup'
      : /exam|final/.test(w) ? 'exams'
      : /lost|funeral|griev|passed/.test(w) ? 'grief'
      : /sick|unwell|hospital|surgery/.test(w) ? 'health'
      : /job|interview/.test(w) ? 'newjob'
      : /baby|pregnan/.test(w) ? 'baby'
      : /wedding|married/.test(w) ? 'wedding'
      : /moving/.test(w) ? 'moving'
      : /travel|vacation/.test(w) ? 'travel'
      : 'stress';
    // Situations default to fading out after two weeks unless a duration was given.
    return { type: 'remember', note: t, kind: 'situation', situationKind, expiresAt: expiresAt ?? Date.now() + 14 * 86_400_000 };
  }

  // unmute: "unmute maya", "unmute all", "show maya's updates again"
  const unmuteM = rest.match(/^(?:unmute|unsnooze|unhide)(?:\s+([a-z']+))?\s*(?:msgs?|messages?|updates?)?\s*$/i);
  if (unmuteM) {
    const word = (unmuteM[1] || 'all').toLowerCase();
    if (['all', 'everything', 'everyone'].includes(word)) {
      return { type: 'unmute', contactId: '*', contactName: 'everyone' };
    }
    const c = matchContact(word, contacts);
    if (c) return { type: 'unmute', contactId: c.id, contactName: c.name };
  }
  const unmuteAgainM = rest.match(/^show\s+([a-z']+)(?:'s)?\s+(?:updates?|messages?)\s+again/i);
  if (unmuteAgainM) {
    const c = matchContact(unmuteAgainM[1], contacts);
    if (c) return { type: 'unmute', contactId: c.id, contactName: c.name };
  }

  // global mute: "mute all msgs for 2 hrs", "silence everything today",
  // "mute messages", "dnd for 2 hours", "quiet time for 1 hour"
  const muteAllM =
    rest.match(/^(?:mute|snooze|silence|hide|pause)\s+(?:all|everything|everyone)(?:\s+(?:msgs?|messages?|updates?|chats?|notifications?))?\s*$/i)
    ?? rest.match(/^(?:mute|snooze|silence|pause)\s+(?:msgs?|messages?|updates?|notifications?)\s*$/i)
    ?? rest.match(/^(?:dnd|do\s+not\s+disturb|quiet\s+time|quiet)\s*$/i);
  if (muteAllM) {
    return { type: 'mute', contactId: '*', contactName: 'everyone', untilTs: expiresAt ?? endOfDay() };
  }

  // mute one contact: "mute maya for 4 hours", "hide dad today", "mute jay's msgs",
  // "don't show maya updates", "block maya for 4 hours" (bare block + duration = snooze)
  const muteM = rest.match(/^(?:mute|snooze|silence|hide|block)\s+([a-z']+)(?:'s)?\s*(?:msgs?|messages?|updates?|chats?)?\s*$/i)
    ?? rest.match(/^(?:don'?t|do\s+not|no)\s+(?:show\s+)?(?:updates?\s+(?:from|for)\s+)?([a-z']+)(?:'s)?\s+(?:updates?|messages?)?\s*$/i);
  if (muteM) {
    const c = matchContact(muteM[1], contacts);
    if (c) return { type: 'mute', contactId: c.id, contactName: c.name, untilTs: expiresAt ?? endOfDay() };
  }

  // rule management: "my rules", "remove rule 2", "clear all rules"
  if (/^(?:show\s+|list\s+)?(?:my\s+|active\s+)?rules\s*$/i.test(rest)) {
    return { type: 'query', subject: 'rules' };
  }
  const clearRulesM = rest.match(/^(?:clear|remove|delete|cancel)\s+(?:all\s+)?(?:my\s+)?rules\s*$/i);
  if (clearRulesM) {
    return { type: 'dynamic_rule', action: 'remove', ruleRef: 'all' };
  }
  const removeRuleM = rest.match(/^(?:remove|delete|cancel|drop)\s+rule\s*(?:#|number\s*)?(\d+)\s*$/i)
    ?? rest.match(/^(?:remove|delete|cancel)\s+(?:the\s+)?rule\s+about\s+(.+)$/i);
  if (removeRuleM) {
    return { type: 'dynamic_rule', action: 'remove', ruleRef: removeRuleM[1] };
  }

  // global temporal content rule: "no ranting messages today", "block promos for today"
  const globalM = rest.match(/^(?:no|block|hide|stop|mute)\s+(rant(?:ing|s)?|negativity|negative|vent(?:ing)?|promo(?:tion)?s?|marketing|spam|forwards?|politic(?:s|al)?)\s*(?:messages?|stuff|content|updates?)?\s*$/i);
  if (globalM) {
    const cat = globalM[1].toLowerCase();
    const condition = /rant|vent|negativ/.test(cat) ? 'ranting'
      : /promo|marketing/.test(cat) ? 'mentions sale, discount, offer, promotion'
      : /spam|forward/.test(cat) ? 'mentions forward, winner, free, click here'
      : 'mentions politics';
    return {
      type: 'dynamic_rule', action: 'add',
      contactId: '*', contactName: 'everyone',
      condition, ruleAction: 'review',
      expiresAt: expiresAt ?? endOfDay(),
    };
  }

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

  // dynamic rule: block [contact] [condition]
  // Matches: "block Maya mentions money", "block Maya if she asks for payment", "don't allow alex when talking about work"
  const blockM = t.match(/^(?:block|don't?\s+allow|prevent|disallow|stop)\s+([a-z']+)(?:\s+(?:if|when|mentions?|discusses?|talks?\s+about|says?)?\s+(.+))?/i);
  if (blockM && blockM[2]) {
    const c = matchContact(blockM[1], contacts);
    if (c) {
      const { expiresAt: exp, rest: cond } = extractDuration(blockM[2]);
      return {
        type: 'dynamic_rule',
        action: 'add',
        contactId: c.id,
        contactName: c.name,
        condition: cond || blockM[2],
        ruleAction: 'block',
        expiresAt: exp,
      };
    }
  }

  // dynamic rule: review [contact] [condition]
  // Matches: "review Maya mentions money", "review Maya when discussing work", "check alex if talking about politics"
  const reviewM = t.match(/^(?:review|check|flag|monitor)\s+([a-z']+)(?:\s+(?:if|when|mentions?|discusses?|talks?\s+about|says?)?\s+(.+))?/i);
  if (reviewM && reviewM[2]) {
    const c = matchContact(reviewM[1], contacts);
    if (c) {
      const { expiresAt: exp, rest: cond } = extractDuration(reviewM[2]);
      return {
        type: 'dynamic_rule',
        action: 'add',
        contactId: c.id,
        contactName: c.name,
        condition: cond || reviewM[2],
        ruleAction: 'review',
        expiresAt: exp,
      };
    }
  }
  return null;
}

/**
 * Last-resort interpretation: the free-form rule catch-all plus legacy
 * one-word patterns. Runs after both the precise grammar and the on-device
 * LLM have had their chance.
 */
function parseFallback(text: string, contacts: Contact[]): Intent {
  const t = text.trim();
  const { expiresAt, rest } = extractDuration(t);

  // Free-form rule catch-all: any leftover statement of preference about
  // messages becomes a rule in the user's own words. The condition is stored
  // verbatim and judged per-message by the LLM evaluation chain (Claude →
  // on-device Gemini Nano → heuristics) — no fixed rule grammar.
  const ruleish =
    /^(?:if|when(?:ever)?|never|no\b|don'?t|do\s+not|hold|only|hide|stop|filter|block|silence|keep|reject|flag|quarantine)\b/i.test(rest) ||
    /\b(?:any(?:one|body|thing)|everyone|all\s+messages?|messages?\s+(?:about|asking|with|containing|that))\b/i.test(rest);
  if (ruleish && rest.split(/\s+/).length >= 3) {
    // A contact named anywhere in the rule scopes it; otherwise it's global.
    let target: Contact | undefined;
    for (const c of contacts) {
      const first = c.name.split(/\s+/)[0].toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (first.length >= 2 && new RegExp(`\\b${first}\\b`, 'i').test(rest)) { target = c; break; }
    }
    const wantsBlock = /\b(?:block|drop|delete|reject|never\s+(?:show|deliver)|don'?t\s+deliver|discard)\b/i.test(rest);
    return {
      type: 'dynamic_rule',
      action: 'add',
      contactId: target?.id ?? '*',
      contactName: target?.name ?? 'everyone',
      condition: rest,
      ruleAction: wantsBlock ? 'block' : 'review',
      expiresAt,
    };
  }

  // legacy patterns
  if (/(?:review|pending|held|waiting|queue|filter)/i.test(t)) return { type: 'show_review' };
  if (/(?:approve|allow|let\s+(?:in|through)|accept)/i.test(t))   return { type: 'approve' };
  if (/(?:reject|block|dismiss|ignore|decline|delete|discard)/i.test(t)) return { type: 'reject' };

  return { type: 'unknown', query: t };
}

function parseHeuristic(text: string, contacts: Contact[]): Intent {
  return parsePrecise(text, contacts) ?? parseFallback(text, contacts);
}

/**
 * Validate and normalize an intent produced by a language model. Models can
 * hallucinate ids, types, or shapes — everything they emit passes through
 * here before it can touch the store. Returns null when unusable.
 */
function sanitizeIntent(p: any, contacts: Contact[]): Intent | null {
  if (!p || typeof p.type !== 'string') return null;

  const findContact = (): { id: string; name: string } | null => {
    if (p.contactId === '*') return { id: '*', name: p.contactName || 'everyone' };
    const c = contacts.find(x => x.id === p.contactId)
      ?? (typeof p.contactName === 'string' ? matchContact(p.contactName, contacts) : undefined)
      ?? (typeof p.contactId === 'string' ? matchContact(p.contactId, contacts) : undefined);
    return c ? { id: c.id, name: c.name } : null;
  };
  const minutes = typeof p.durationMinutes === 'number' && p.durationMinutes > 0 && p.durationMinutes < 60 * 24 * 30
    ? p.durationMinutes : undefined;

  switch (p.type) {
    case 'reply': {
      const c = findContact();
      if (!c || c.id === '*' || typeof p.text !== 'string' || !p.text.trim()) return null;
      return { type: 'reply', contactId: c.id, contactName: c.name, text: p.text.trim() };
    }
    case 'open': {
      const c = findContact();
      if (!c || c.id === '*') return null;
      return { type: 'open', contactId: c.id, contactName: c.name };
    }
    case 'approve': return { type: 'approve', messageId: typeof p.messageId === 'string' ? p.messageId : undefined };
    case 'reject': return { type: 'reject', messageId: typeof p.messageId === 'string' ? p.messageId : undefined };
    case 'show_review': return { type: 'show_review' };
    case 'set_rule': {
      if (!['trust', 'distrust', 'sensitivity', 'civility_toggle', 'spam_toggle', 'dnd_toggle'].includes(p.rule)) return null;
      const needsContact = p.rule === 'trust' || p.rule === 'distrust';
      const c = needsContact ? findContact() : null;
      if (needsContact && (!c || c.id === '*')) return null;
      return { type: 'set_rule', rule: p.rule, contactId: c?.id, contactName: c?.name, value: p.value };
    }
    case 'query': {
      if (!['capabilities', 'held_count', 'contact_messages', 'summary', 'settings', 'rules', 'circles', 'memory'].includes(p.subject)) return null;
      const c = p.subject === 'contact_messages' ? findContact() : null;
      if (p.subject === 'contact_messages' && (!c || c.id === '*')) return null;
      return { type: 'query', subject: p.subject, contactId: c?.id ?? undefined, contactName: c?.name ?? undefined };
    }
    case 'dynamic_rule': {
      if (p.action === 'remove') {
        return { type: 'dynamic_rule', action: 'remove', ruleRef: p.ruleRef != null ? String(p.ruleRef) : 'all' };
      }
      if (typeof p.condition !== 'string' || !p.condition.trim()) return null;
      const c = findContact();
      return {
        type: 'dynamic_rule', action: 'add',
        contactId: c?.id ?? '*', contactName: c?.name ?? 'everyone',
        condition: p.condition.trim(),
        ruleAction: p.ruleAction === 'block' ? 'block' : 'review',
        expiresAt: minutes ? Date.now() + minutes * 60_000 : (typeof p.expiresAt === 'number' ? p.expiresAt : undefined),
      };
    }
    case 'mute': {
      const c = findContact();
      return {
        type: 'mute',
        contactId: c?.id ?? '*', contactName: c?.name ?? 'everyone',
        untilTs: typeof p.untilTs === 'number' && p.untilTs > Date.now()
          ? p.untilTs
          : Date.now() + (minutes ?? 720) * 60_000,
      };
    }
    case 'unmute': {
      const c = findContact();
      return { type: 'unmute', contactId: c?.id ?? '*', contactName: c?.name ?? 'everyone' };
    }
    case 'remember': {
      if (typeof p.note !== 'string' || !p.note.trim()) return null;
      const kind = p.kind === 'situation' ? 'situation' : 'fact';
      return {
        type: 'remember', note: p.note.trim().slice(0, 300), kind,
        situationKind: typeof p.situationKind === 'string' ? p.situationKind : undefined,
        expiresAt: minutes ? Date.now() + minutes * 60_000 : (kind === 'situation' ? Date.now() + 14 * 86_400_000 : undefined),
      };
    }
    case 'forget': {
      if (typeof p.target !== 'string' || !p.target.trim()) return null;
      return { type: 'forget', target: p.target.trim() };
    }
    case 'memory_export': return { type: 'memory_export' };
    case 'set_circle': {
      const c = findContact();
      if (!c || c.id === '*') return null;
      const circle = ['family', 'work', 'friends', 'vip'].includes(p.circle) ? p.circle as Circle : null;
      return { type: 'set_circle', contactId: c.id, contactName: c.name, circle };
    }
    case 'set_profile': {
      if (!(p.profile in PROFILES)) return null;
      return { type: 'set_profile', profile: p.profile as ProfileId };
    }
    case 'summary_style': {
      if (!['professional', 'casual', 'brief'].includes(p.style)) return null;
      return { type: 'summary_style', style: p.style };
    }
    default:
      return null; // includes 'unknown' — caller decides the fallback
  }
}

// Flat schema so the on-device model's constrained decoding stays reliable.
const NANO_INTENT_SCHEMA = {
  type: 'object',
  required: ['type'],
  additionalProperties: false,
  properties: {
    type: { type: 'string', enum: ['reply', 'open', 'approve', 'reject', 'show_review', 'set_rule', 'query', 'dynamic_rule', 'mute', 'unmute', 'summary_style', 'set_profile', 'set_circle', 'remember', 'forget', 'memory_export', 'unknown'] },
    contactId: { type: 'string' },
    contactName: { type: 'string' },
    text: { type: 'string' },
    condition: { type: 'string' },
    ruleAction: { type: 'string', enum: ['block', 'review'] },
    durationMinutes: { type: 'number' },
    style: { type: 'string', enum: ['professional', 'casual', 'brief'] },
    rule: { type: 'string', enum: ['trust', 'distrust', 'sensitivity', 'civility_toggle', 'spam_toggle', 'dnd_toggle'] },
    value: { type: 'string' },
    subject: { type: 'string', enum: ['capabilities', 'held_count', 'contact_messages', 'summary', 'settings', 'rules'] },
    ruleRef: { type: 'string' },
    action: { type: 'string', enum: ['add', 'remove'] },
    profile: { type: 'string', enum: ['elder', 'public', 'professional', 'minimal'] },
    circle: { type: 'string', enum: ['family', 'work', 'friends', 'vip'] },
    note: { type: 'string' },
    kind: { type: 'string', enum: ['fact', 'situation'] },
    situationKind: { type: 'string' },
    target: { type: 'string' },
  },
} as const;

/**
 * On-device interpretation via Gemini Nano — lets the user phrase a command
 * any way they like without an API key. Only consulted when the precise
 * grammar didn't match; output is sanitized before use.
 */
async function parseViaNano(text: string, contacts: Contact[]): Promise<Intent | null> {
  const system = [
    'You convert one messaging-app command into a single JSON intent. Return ONLY JSON.',
    'Contacts:',
    contacts.slice(0, 30).map(c => `id:${c.id} name:"${c.name}"`).join('\n') || '(none)',
    '',
    'Intent shapes (pick exactly one):',
    '{"type":"reply","contactId":"<id>","text":"<reply>"}',
    '{"type":"open","contactId":"<id>"}',
    '{"type":"approve"} {"type":"reject"} {"type":"show_review"}',
    '{"type":"set_rule","rule":"trust|distrust","contactId":"<id>"}',
    '{"type":"set_rule","rule":"sensitivity","value":"low|medium|high"}',
    '{"type":"set_rule","rule":"civility_toggle|spam_toggle|dnd_toggle","value":"on|off"}',
    '{"type":"query","subject":"capabilities|held_count|summary|settings|rules"}',
    '{"type":"query","subject":"contact_messages","contactId":"<id>"}',
    '{"type":"dynamic_rule","action":"add","contactId":"<id or *>","condition":"<the preference in the user\'s words>","ruleAction":"block|review","durationMinutes":<optional>}',
    '{"type":"dynamic_rule","action":"remove","ruleRef":"all|<number>|<keyword>"}',
    '{"type":"mute","contactId":"<id or * for everything>","durationMinutes":<number>}',
    '{"type":"unmute","contactId":"<id or *>"}',
    '{"type":"summary_style","style":"professional|casual|brief"}',
    '{"type":"set_profile","profile":"elder|public|professional|minimal"}  // protection presets: elder=scam shield, public=creator inbox, professional=work, minimal=quiet',
    '{"type":"set_circle","contactId":"<id>","circle":"family|work|friends|vip"}  // "maya is family", "jay is a work contact"',
    '{"type":"query","subject":"circles"}  // "who is in my circles"',
    '{"type":"remember","note":"<what to remember>","kind":"fact|situation","situationKind":"breakup|exams|grief|health|newjob|baby|wedding|moving|travel|stress","durationMinutes":<optional>}  // "remember I work nights"; life events ("i\'m going through a divorce") => kind situation',
    '{"type":"forget","target":"all|<keyword>"} {"type":"memory_export"} {"type":"query","subject":"memory"}',
    '{"type":"unknown"}',
    '',
    'Guidance: wanting quiet/peace/no notifications => mute (contactId "*" unless a contact is named).',
    'Any preference about which messages to see, hide, hold or block => dynamic_rule add, condition in the user\'s own words.',
    'durationMinutes: "2 hours"=120, "today"=until end of day estimate 720. If genuinely unsure => {"type":"unknown"}.',
  ].join('\n');

  const raw = await promptNano(system, text, NANO_INTENT_SCHEMA);
  if (!raw) return null;
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return sanitizeIntent(JSON.parse(m[0]), contacts);
  } catch {
    return null;
  }
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
    '{"type":"query","subject":"rules"}  // "my rules", "list rules"\n' +
    '{"type":"dynamic_rule","action":"add","contactId":"<id or * for all contacts>","contactName":"<name or everyone>","condition":"<the preference in natural language>","ruleAction":"block|review","durationMinutes":<optional number, e.g. 240 for "4 hours", 1440 for "today">}\n' +
    '{"type":"dynamic_rule","action":"remove","ruleRef":"all|<1-based rule number>|<keyword>"}\n' +
    '{"type":"mute","contactId":"<id or * to mute everything>","contactName":"<name or everyone>","durationMinutes":<number, default 720>}  // "mute X", "mute all msgs for 2 hrs", "dnd for 2 hours"\n' +
    '{"type":"unmute","contactId":"<id or * for unmute all>","contactName":"<name or everyone>"}\n' +
    '{"type":"summary_style","style":"professional|casual|brief"}  // "summaries should be professional"\n' +
    '{"type":"set_profile","profile":"elder|public|professional|minimal"}  // protection presets, e.g. "protect my mom\'s phone" => elder\n' +
    '{"type":"set_circle","contactId":"<id>","contactName":"<name>","circle":"family|work|friends|vip"}  // "maya is family", "jay is my client" => work\n' +
    '{"type":"query","subject":"circles"}\n' +
    '{"type":"remember","note":"<text>","kind":"fact|situation","situationKind":"breakup|exams|grief|health|newjob|baby|wedding|moving|travel|stress","durationMinutes":<optional>}  // any personal fact or life event the user shares\n' +
    '{"type":"forget","target":"all|<keyword>"}\n' +
    '{"type":"query","subject":"memory"}  // "what do you remember about me"\n' +
    '{"type":"memory_export"}\n' +
    '{"type":"unknown","query":"<original input>"}\n\n' +
    'IMPORTANT: ANY preference about which messages the user wants to see, hide, hold, or block ' +
    'is a dynamic_rule add — keep the condition in the user\'s own words (it is evaluated per-message ' +
    'by an AI later, so free-form conditions like "asking me for money" or "guilt-tripping me" are fine). ' +
    'Prefer ruleAction "review" unless the user clearly wants messages gone.';

  try {
    // Routes to Claude or Gemini depending on the key the user pasted.
    const raw = await promptCloud(system, text, apiKey, { maxTokens: 200 });
    if (!raw) return parseHeuristic(text, contacts);
    const m = raw.match(/\{[\s\S]*?\}/);
    if (!m) return parseHeuristic(text, contacts);
    // Model output is untrusted — sanitize before it can touch the store.
    const clean = sanitizeIntent(JSON.parse(m[0]), contacts);
    return clean ?? parseHeuristic(text, contacts);
  } catch {
    return parseHeuristic(text, contacts);
  }
}

/**
 * The full understanding chain. The user can phrase a command any way they
 * like; the best available interpreter wins:
 *   1. Anthropic Claude — when an API key is configured
 *   2. Precise grammar — fast deterministic patterns for common commands
 *   3. Gemini Nano — on-device LLM interprets free phrasing, no key needed
 *   4. Rule catch-all — leftover preferences become free-form rules
 */
export async function parseIntent(
  text: string,
  contacts: Contact[],
  heldMessages: Message[],
  apiKey: string,
): Promise<Intent> {
  if (apiKey.trim()) return parseViaAnthropic(text, contacts, heldMessages, apiKey.trim());

  const precise = parsePrecise(text, contacts);
  if (precise) return precise;

  const viaNano = await parseViaNano(text, contacts);
  if (viaNano && viaNano.type !== 'unknown') return viaNano;

  return parseFallback(text, contacts);
}
