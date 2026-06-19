import type { Category, ModerationVerdict, UserSettings } from '../types';

const ABUSIVE_WORDS = [
  'idiot','moron','stupid','dumb','fool','hate','loser','trash','garbage',
  'damn','hell','crap','bastard','jerk','creep','ugly','pathetic','worthless',
  'screw you','shut up','go away','leave me alone','die','kill','threat',
  'abuse','harass','bully','insult','attack',
];

const SPAM_PATTERNS = [
  /forward(ed)?\s*(this|to|message)/i,
  /share\s+with\s+\d+\s+(friends|people|contacts)/i,
  /send\s+this\s+to\s+\d+/i,
  /chain\s+(letter|message|mail)/i,
  /you('ve| have) won/i,
  /click\s+here\s+to\s+claim/i,
  /limited\s+time\s+offer/i,
  /congratulations.*won/i,
  /free\s+gift/i,
  /act\s+now/i,
];

const BUSINESS_KEYWORDS = [
  'order','invoice','otp','verification','code','delivery','shipment','shipped',
  'package','track','booking','appointment','account','statement','receipt',
  'transaction','payment','bank','balance','credit','debit','bill','subscription',
];

const PROMO_KEYWORDS = [
  'sale','discount','offer','deal','coupon','promo','save','off','% off',
  'flash sale','buy one','free shipping','exclusive','special offer','today only',
  'hurry','expires','limited stock','shop now',
];

function countEmojis(text: string): number {
  return [...text].filter(c => /\p{Emoji}/u.test(c)).length;
}

function countLinks(text: string): number {
  return (text.match(/https?:\/\/\S+/g) || []).length;
}

export function moderate(text: string, settings: UserSettings): ModerationVerdict {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);

  // Abusive check
  const sens = settings.civility.sensitivity;
  const threshold = sens === 'high' ? 1 : sens === 'medium' ? 2 : 3;
  const flaggedTerms: string[] = [];

  for (const word of words) {
    const clean = word.replace(/[^a-z]/g, '');
    for (const bad of ABUSIVE_WORDS) {
      if (clean.includes(bad.replace(/\s/g, '')) || lower.includes(bad)) {
        if (!flaggedTerms.includes(bad)) flaggedTerms.push(bad);
      }
    }
  }

  if (flaggedTerms.length >= threshold) {
    const confidence = Math.min(0.6 + flaggedTerms.length * 0.1, 0.99);
    return { category: 'abusive', confidence, flaggedTerms, reason: 'Abusive language detected', engine: 'rules' };
  }

  // Spam check
  const emojiCount = countEmojis(text);
  const linkCount = countLinks(text);
  const isAllCaps = text.length > 10 && text === text.toUpperCase();
  const spamMatches = SPAM_PATTERNS.filter(p => p.test(text));

  if (spamMatches.length > 0 || (emojiCount > 5 && linkCount > 1) || isAllCaps) {
    const confidence = 0.5 + spamMatches.length * 0.15 + (isAllCaps ? 0.1 : 0);
    return { category: 'spam', confidence: Math.min(confidence, 0.95), reason: 'Spam/forward pattern detected', engine: 'rules' };
  }

  // Business check
  const bizMatches = BUSINESS_KEYWORDS.filter(k => lower.includes(k));
  if (bizMatches.length >= 2) {
    return { category: 'business', confidence: 0.5 + bizMatches.length * 0.08, reason: 'Business/transactional content', engine: 'rules' };
  }

  // Promo check
  const promoMatches = PROMO_KEYWORDS.filter(k => lower.includes(k));
  if (promoMatches.length >= 2) {
    return { category: 'promo', confidence: 0.5 + promoMatches.length * 0.08, reason: 'Promotional content', engine: 'rules' };
  }

  // Single keyword business/promo with weak signal
  if (bizMatches.length === 1) {
    return { category: 'business', confidence: 0.45, reason: 'Possible business content', engine: 'rules' };
  }
  if (promoMatches.length === 1) {
    return { category: 'promo', confidence: 0.40, reason: 'Possible promo content', engine: 'rules' };
  }

  return { category: 'clean', confidence: 0.90, reason: 'No issues detected', engine: 'rules' };
}

export type { Category, ModerationVerdict };
