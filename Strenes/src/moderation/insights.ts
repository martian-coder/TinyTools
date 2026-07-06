import type { Message, SummaryStyle } from '../types';

/**
 * insights — offline, deterministic reading of what a sender is *doing*
 * (ranting, sharing an opinion, asking a question…), used by the Commander
 * briefing and by dynamic rules like "no ranting messages today".
 * No network calls: pure heuristics over the text, same contract as the
 * rules moderation engine.
 */

export type MessageKind =
  | 'rant' | 'opinion' | 'question' | 'plan' | 'urgent'
  | 'link' | 'celebration' | 'ack' | 'chat';

const NEGATIVE = [
  'hate', 'sick of', 'fed up', "can't believe", 'cant believe', 'worst',
  'annoying', 'furious', 'so done', 'ridiculous', 'unbelievable', 'terrible',
  'awful', 'ugh', 'pissed', 'angry', 'rant', 'nightmare', 'disaster',
  'killing me', 'driving me crazy', 'so tired of', 'why does this always',
];

const OPINION = [
  'i think', 'i feel', 'imo', 'in my opinion', 'honestly', 'personally',
  'to be honest', 'tbh', 'my take', 'if you ask me', 'i believe', 'hot take',
];

const CELEBRATION = [
  'congrats', 'congratulations', 'great news', 'guess what', 'we did it',
  'got the job', 'so happy', 'amazing news', 'finally!', '🎉', '🥳', 'woohoo',
];

const ACK = ['thanks', 'thank you', 'ok', 'okay', 'cool', 'sounds good', 'sure', 'yes', 'got it', 'nice', '👍'];

function countMatches(t: string, terms: string[]): number {
  return terms.filter(w => t.includes(w)).length;
}

/** Rant: sustained negative emotional venting. Used by the "no rants" rule too. */
export function isRant(text: string): boolean {
  const t = text.toLowerCase();
  const negatives = countMatches(t, NEGATIVE);
  const exclaims = (text.match(/!/g) || []).length;
  const capsWords = (text.match(/\b[A-Z]{3,}\b/g) || []).length;
  const long = text.length > 100;
  // Two strong signals, or one strong signal in a long message.
  const signals = (negatives >= 2 ? 2 : negatives) + (exclaims >= 3 ? 1 : 0) + (capsWords >= 2 ? 1 : 0);
  return signals >= 2 || (long && signals >= 1);
}

export function classifyMessageKind(text: string): MessageKind {
  const t = text.toLowerCase().trim();

  if (isRant(text)) return 'rant';
  if (/urgent|asap|emergency|right now|immediately|need help/i.test(t)) return 'urgent';
  if (countMatches(t, CELEBRATION) > 0) return 'celebration';
  if (countMatches(t, OPINION) > 0) return 'opinion';
  if (/meet|call|schedule|when are|what time|meeting|sync|catch up|lunch|dinner|plan/i.test(t)) return 'plan';
  if (/https?:\/\/|www\./i.test(t)) return 'link';
  if (t.includes('?') || /^(?:how|what|why|where|when|who|can you|could you|do you|are you|is it)\b/.test(t)) return 'question';
  if (t.length < 30 && countMatches(t, ACK) > 0) return 'ack';
  return 'chat';
}

/** Per-style phrasing for one sender's activity in the briefing. */
const PHRASES: Record<MessageKind, Record<SummaryStyle, string>> = {
  rant:        { professional: 'is venting frustration',          casual: 'is ranting about something', brief: 'ranting' },
  opinion:     { professional: 'has shared a personal opinion',   casual: 'is sharing an opinion',      brief: 'opinion' },
  question:    { professional: 'has asked a question',            casual: 'is asking a question',       brief: 'question' },
  plan:        { professional: 'proposes scheduling a meeting',   casual: 'wants to make plans',        brief: 'plans' },
  urgent:      { professional: 'has an urgent request',           casual: 'needs something urgent',     brief: 'urgent' },
  link:        { professional: 'has shared a link',               casual: 'sent a link',                brief: 'link' },
  celebration: { professional: 'has shared positive news',        casual: 'is celebrating something',   brief: 'good news' },
  ack:         { professional: 'has acknowledged your message',   casual: 'is responding positively',   brief: 'ack' },
  chat:        { professional: 'has sent a message',              casual: 'is chatting',                brief: 'message' },
};

export function describeSender(latest: Message, style: SummaryStyle): { kind: MessageKind; summary: string } {
  // Moderation verdict wins when it says something material.
  const cat = latest.verdict?.category;
  if (cat === 'business') {
    return { kind: 'chat', summary: style === 'brief' ? 'business' : style === 'professional' ? 'has a business notification' : 'has a business message' };
  }
  if (cat === 'promo') {
    return { kind: 'chat', summary: style === 'brief' ? 'promo' : 'sent a promotion' };
  }
  if (cat === 'spam') {
    return { kind: 'chat', summary: style === 'brief' ? 'spam' : 'sent spam' };
  }
  if (cat === 'abusive') {
    return { kind: 'chat', summary: style === 'brief' ? 'abusive' : style === 'professional' ? 'sent a message flagged as hostile' : 'sent an abusive message' };
  }

  const kind = classifyMessageKind(latest.text);
  return { kind, summary: PHRASES[kind][style] };
}

/** Priority for briefing ordering, derived from what the sender is doing. */
export function priorityFor(kind: MessageKind, verdictCategory?: string): 'high' | 'medium' | 'low' {
  if (verdictCategory === 'business' || verdictCategory === 'abusive') return 'high';
  if (verdictCategory === 'promo') return 'medium';
  if (verdictCategory === 'spam') return 'low';
  if (kind === 'urgent' || kind === 'plan') return 'high';
  if (kind === 'question' || kind === 'rant' || kind === 'celebration') return 'medium';
  return 'low';
}
