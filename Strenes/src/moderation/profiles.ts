import type { UserSettings } from '../types';

/**
 * profiles — one-tap protection bundles. Different people want radically
 * different inboxes; nobody wants to write rules from scratch. A profile is
 * just a bundle of the settings and free-form rules the engine already
 * supports, so switching profiles never touches the moderation pipeline.
 *
 * Rules created by a profile are tagged source:'profile' and are replaced
 * wholesale when the user switches profiles; hand-written rules are kept.
 */

export type ProfileId = 'elder' | 'public' | 'professional' | 'minimal';

export type Circle = 'family' | 'work' | 'friends' | 'vip';

export const CIRCLE_META: Record<Circle, { emoji: string; label: string }> = {
  vip:     { emoji: '\u2B50', label: 'VIP' },
  family:  { emoji: '\u{1F46A}', label: 'Family' },
  friends: { emoji: '\u{1F389}', label: 'Friends' },
  work:    { emoji: '\u{1F4BC}', label: 'Work' },
};

/** Which circles lead the briefing, per persona. */
export const CIRCLE_ORDER: Record<ProfileId | 'default', Circle[]> = {
  elder:        ['family', 'vip', 'friends', 'work'],
  professional: ['vip', 'work', 'family', 'friends'],
  public:       ['vip', 'work', 'friends', 'family'],
  minimal:      ['vip', 'family', 'friends', 'work'],
  default:      ['vip', 'family', 'friends', 'work'],
};

export interface ProtectionProfile {
  id: ProfileId;
  emoji: string;
  label: string;
  tagline: string;
  /** Shallow patches applied via updateSettings-style merge. */
  settings: {
    civility: Partial<UserSettings['civility']>;
    spam: Partial<UserSettings['spam']>;
    dnd?: Partial<UserSettings['dnd']>;
    summaryStyle: 'professional' | 'casual' | 'brief';
  };
  /** Free-form rules (evaluated by the LLM chain like any user rule). */
  rules: Array<{ condition: string; action: 'block' | 'review' }>;
  /** What Commander tells the user after applying. */
  confirmation: string[];
}

export const PROFILES: Record<ProfileId, ProtectionProfile> = {
  elder: {
    id: 'elder',
    emoji: '🛡️',
    label: 'Elder Shield',
    tagline: 'maximum scam protection — when in doubt, hold it',
    settings: {
      civility: { enabled: true, sensitivity: 'high', onBlock: 'review' },
      spam: { enabled: true, onBlock: 'review' },
      summaryStyle: 'casual',
    },
    rules: [
      { condition: 'asking for OTP, PIN, password, bank details, KYC update, or account verification', action: 'review' },
      { condition: 'demanding a fee, customs charge, courier payment, or claiming a prize or lottery win', action: 'review' },
      { condition: 'claiming to be police, government, or threatening arrest or legal action', action: 'review' },
      { condition: 'a new number claiming to be a family member and asking for money', action: 'review' },
    ],
    confirmation: [
      '🛡️ Elder Shield is on. I now hold anything that smells like a scam: OTP/bank requests, prize claims, fee demands, fake police threats, and "new number" family impersonation.',
      "Held messages wait in Review with a plain explanation of why. Trusted contacts always get through instantly.",
    ],
  },
  public: {
    id: 'public',
    emoji: '📣',
    label: 'Public Inbox',
    tagline: 'for creators & business — strangers allowed, filtered hard',
    settings: {
      civility: { enabled: true, sensitivity: 'high', onBlock: 'silentDrop' as UserSettings['civility']['onBlock'] },
      spam: { enabled: true, onBlock: 'silentDrop' as UserSettings['spam']['onBlock'] },
      summaryStyle: 'brief',
    },
    rules: [
      { condition: 'a business inquiry, collaboration offer, or paid work opportunity', action: 'review' },
    ],
    confirmation: [
      '📣 Public Inbox is on. Abuse and spam from strangers are silently dropped — senders never know. Possible business inquiries get held for your review so leads don\'t drown.',
      'Briefings are now short. Say "summary" any time for the rundown.',
    ],
  },
  professional: {
    id: 'professional',
    emoji: '💼',
    label: 'Professional',
    tagline: 'business first, quiet nights, formal briefings',
    settings: {
      civility: { enabled: true, sensitivity: 'medium', onBlock: 'review' },
      spam: { enabled: true, onBlock: 'review' },
      dnd: { enabled: true, startHour: 22, endHour: 7, allowTrusted: true, allowEmergency: true },
      summaryStyle: 'professional',
    },
    rules: [],
    confirmation: [
      '💼 Professional mode is on. Do Not Disturb runs 22:00–07:00 (trusted and emergency contacts still get through), spam is held, and briefings are now formal.',
    ],
  },
  minimal: {
    id: 'minimal',
    emoji: '🍃',
    label: 'Minimal',
    tagline: 'only what matters — everything else waits',
    settings: {
      civility: { enabled: true, sensitivity: 'high', onBlock: 'review' },
      spam: { enabled: true, onBlock: 'silentDrop' as UserSettings['spam']['onBlock'] },
      summaryStyle: 'brief',
    },
    rules: [
      { condition: 'a promotion, marketing message, newsletter, or automated notification', action: 'review' },
    ],
    confirmation: [
      '🍃 Minimal mode is on. Spam disappears silently, promos and automated noise wait in Review, briefings are one line per sender. Your trusted people reach you instantly — everyone else takes a number.',
    ],
  },
};

/** Match loose user phrasing ("grandma mode", "creator profile") to a profile. */
export function matchProfile(text: string): ProfileId | null {
  const t = text.toLowerCase();
  if (/elder|senior|grandma|grandpa|parent|mom|dad'?s\s+phone|old/i.test(t)) return 'elder';
  if (/public|creator|influencer|open\s+inbox|business\s+inbox/i.test(t)) return 'public';
  if (/professional|work|office|formal/i.test(t)) return 'professional';
  // Note: no bare "quiet" here — "quiet time" is the global-mute command.
  if (/minimal|calm|zen|focus|essential/i.test(t)) return 'minimal';
  return null;
}
