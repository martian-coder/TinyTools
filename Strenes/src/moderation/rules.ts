import type { ModerationVerdict, UserSettings } from '../types';
import type { Moderator, Sensitivity } from './types';

/**
 * Deterministic, offline lexicon classifier — the always-available engine at
 * the bottom of the getModerator() chain and the pre-filter the model-backed
 * engines escalate from.
 *
 * Design follows standard abusive-language detection practice:
 * - Normalization defeats the common obfuscations (leetspeak "1d10t",
 *   spaced-out letters "i d i o t", repeated chars "stuuupid").
 * - Word-boundary matching prevents Scunthorpe-style false positives
 *   ("skill" is not "kill", "dumbbell" is not "dumb").
 * - Weighted scoring across categories instead of first-hit-wins, with
 *   threat phrases weighted above generic insults.
 */

// ——— Lexicons ————————————————————————————————————————————————————————————
// weight ≥ 3: severe (threats/targeted hostility) — dominate scoring
// weight 2:   direct insults / strong signals
// weight 1:   weak signals — need company to cross the line

const ABUSIVE: Array<[string, number]> = [
  // threats & targeted hostility
  ['kill you', 3], ['kill yourself', 3], ['hurt you', 3], ['you are dead', 3],
  ["you're dead", 3], ['watch your back', 3], ['beat you up', 3], ['i will find you', 3],
  // direct insults
  ['idiot', 2], ['moron', 2], ['loser', 2], ['worthless', 2], ['pathetic', 2],
  ['hate you', 2], ['shut up', 2], ['screw you', 2], ['nobody likes you', 2],
  ['ugly', 2], ['disgusting', 2], ['trash', 2], ['garbage human', 3],
  // milder, need reinforcement
  ['stupid', 1], ['dumb', 1], ['fool', 1], ['shame on you', 1], ['freak', 1],
];

const SPAM: Array<[string, number]> = [
  // chain-letter / forward bait
  ['forward this', 3], ['forward to', 2], ['share with', 1], ['10 people', 2],
  ['10 friends', 2], ['good luck', 1], ['bad luck', 2], ['or else', 1],
  // scam / phishing
  ['you won', 3], ['you have won', 3], ['claim your prize', 3], ['claim now', 2],
  ['verify your account', 3], ['account suspended', 3], ['urgent action', 2],
  ['act now', 2], ['wire transfer', 2], ['gift card', 2], ['crypto investment', 3],
  ['double your money', 3], ['guaranteed returns', 3], ['work from home', 2],
  ['click here', 2], ['click the link', 2], ['win free', 3], ['congratulations you', 2],
  ['lottery', 2], ['inheritance', 2], ['prince', 1], ['million dollars', 2],
];

const BUSINESS: Array<[string, number]> = [
  ['order', 2], ['invoice', 2], ['otp', 2], ['delivery', 2], ['tracking', 2],
  ['shipped', 2], ['payment', 2], ['receipt', 2], ['appointment', 2],
  ['booking', 2], ['reservation', 2], ['confirmation code', 2], ['your code is', 2],
  ['account statement', 2], ['subscription', 1], ['renewal', 1], ['due date', 1],
];

const PROMO: Array<[string, number]> = [
  ['sale', 2], ['discount', 2], ['% off', 3], ['offer', 1], ['deal', 1],
  ['coupon', 2], ['limited time', 2], ['buy now', 2], ['free shipping', 2],
  ['flash sale', 3], ['clearance', 2], ['best price', 2], ['shop now', 2],
  ['new arrival', 2], ['exclusive offer', 2],
];

// Domains commonly used to cloak spam links.
const SHORTENERS = ['bit.ly', 'tinyurl', 'goo.gl', 't.co/', 'rb.gy', 'cutt.ly', 'shorturl'];

// ——— Normalization ———————————————————————————————————————————————————————

const LEET: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b',
  '@': 'a', '$': 's', '!': 'i', '+': 't',
};

/** Lowercase, strip diacritics, collapse repeated letters. */
function normalize(text: string): string {
  let t = text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
  t = t.replace(/([a-z])\1{2,}/g, '$1'); // "stuuupid" → "stupid"
  return t;
}

/**
 * Leet-decoded view: "1d10t" → "idiot", "$tupid" → "stupid". Kept as a
 * separate matching view (not a replacement) so literal digits survive in the
 * primary view — otherwise "10 people" would corrupt to "io people".
 */
function deleet(text: string): string {
  return text
    .replace(/[0134578@$!+]/g, ch => LEET[ch] ?? ch)
    .replace(/([a-z])\1{2,}/g, '$1');
}

/** Additionally collapse single-char separators: "i.d.i.o.t" / "i d i o t" → "idiot". */
function despace(text: string): string {
  return text.replace(/\b(?:[a-z][\s._\-*]){2,}[a-z]\b/g, m => m.replace(/[\s._\-*]/g, ''));
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const patternCache = new Map<string, RegExp>();
function boundaryPattern(term: string): RegExp {
  let re = patternCache.get(term);
  if (!re) {
    // Require a word edge only on sides that start/end alphanumeric, so terms
    // like "% off" still match "50% off" while "kill" can't match "skill".
    const left = /^[a-z0-9]/i.test(term) ? '(?:^|[^a-z0-9])' : '';
    const right = /[a-z0-9]$/i.test(term) ? '(?=$|[^a-z0-9])' : '';
    re = new RegExp(left + escapeRe(term).replace(/ /g, '\\s+') + right, 'i');
    patternCache.set(term, re);
  }
  return re;
}

function score(haystacks: string[], lexicon: Array<[string, number]>): { total: number; terms: string[] } {
  let total = 0;
  const terms: string[] = [];
  for (const [term, weight] of lexicon) {
    if (haystacks.some(h => boundaryPattern(term).test(h))) {
      total += weight;
      terms.push(term);
    }
  }
  return { total, terms };
}

// ——— Classifier ——————————————————————————————————————————————————————————

export function classifyByRules(text: string, sensitivity: Sensitivity): ModerationVerdict {
  const norm = normalize(text);
  const views = [norm, despace(norm), deleet(norm)];

  // Sensitivity moves the abusive trigger threshold, not just the confidence:
  // high catches single weak insults, low requires strong/compound signals.
  const abusiveThreshold = sensitivity === 'high' ? 1 : sensitivity === 'low' ? 3 : 2;

  const ab = score(views, ABUSIVE);
  if (ab.total >= abusiveThreshold) {
    const base = sensitivity === 'high' ? 0.70 : sensitivity === 'low' ? 0.55 : 0.62;
    return {
      category: 'abusive',
      confidence: Math.min(0.97, base + ab.total * 0.06),
      flaggedTerms: ab.terms,
      engine: 'rules',
    };
  }

  const sp = score(views, SPAM);
  let spamSignals = sp.total;
  const emojiCount = (text.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []).length;
  if (emojiCount >= 3) spamSignals += 1;
  if (emojiCount >= 6) spamSignals += 1;
  const letters = text.replace(/[^A-Za-z]/g, '');
  const shouting = letters.length > 8 && letters === letters.toUpperCase();
  if (shouting) spamSignals += 1;
  const hasUrl = /https?:\/\/|www\./i.test(text);
  const hasShortener = SHORTENERS.some(d => norm.includes(d));
  if (hasShortener) spamSignals += 3;
  else if (hasUrl && sp.total > 0) spamSignals += 2; // links are only spam in spammy company

  if (spamSignals >= 3) {
    return {
      category: 'spam',
      confidence: Math.min(0.96, 0.58 + spamSignals * 0.07),
      flaggedTerms: sp.terms.length ? sp.terms : (hasShortener ? ['link shortener'] : shouting ? ['all caps'] : ['excessive emoji']),
      engine: 'rules',
    };
  }

  const bz = score(views, BUSINESS);
  if (bz.total >= 2) {
    return {
      category: 'business',
      confidence: Math.min(0.95, 0.6 + bz.total * 0.06),
      flaggedTerms: bz.terms,
      engine: 'rules',
    };
  }

  const pr = score(views, PROMO);
  if (pr.total >= 2) {
    return {
      category: 'promo',
      confidence: Math.min(0.95, 0.58 + pr.total * 0.06),
      flaggedTerms: pr.terms,
      engine: 'rules',
    };
  }

  return { category: 'clean', confidence: 0.92, flaggedTerms: [], engine: 'rules' };
}

/**
 * Legacy helper that folds the user's enable/disable toggles into a single
 * verdict. Live code paths gate toggles in routeVerdict(); this stays for
 * synchronous callers and now delegates to the shared classifier.
 */
export function moderate(text: string, settings: UserSettings): ModerationVerdict {
  const verdict = classifyByRules(text, settings.civility.sensitivity);
  if (verdict.category === 'abusive' && !settings.civility.enabled) {
    return { category: 'clean', confidence: 0.92, flaggedTerms: [], engine: 'rules' };
  }
  if (verdict.category === 'spam' && !settings.spam.enabled) {
    return { category: 'clean', confidence: 0.92, flaggedTerms: [], engine: 'rules' };
  }
  if (verdict.category === 'business' && !settings.business.enabled) {
    return { category: 'clean', confidence: 0.92, flaggedTerms: [], engine: 'rules' };
  }
  return verdict;
}

/**
 * The always-available engine. Instant, offline, deterministic. It is the
 * guaranteed fallback at the bottom of the getModerator() chain and the
 * pre-filter the model-backed engines escalate from.
 */
export const RulesModerator: Moderator = {
  name: 'rules',
  async isAvailable() {
    return true;
  },
  async classify(text, { sensitivity }) {
    return classifyByRules(text, sensitivity);
  },
};
