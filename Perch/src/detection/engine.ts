/**
 * engine — Perch's on-device threat detection for notification text.
 *
 * Ported from Strenes Guardian mode and extended with bullying and
 * self-harm categories. Runs entirely on-device: no message content ever
 * leaves the phone. Each group carries a severity and a plain-language
 * reason written to be read by a parent OR a kid.
 *
 * NOTE: android/…/Detection.java is a hand-port of this file. If you
 * change a pattern here, mirror it there.
 *
 * severity 'alert' → parent is pinged immediately
 * severity 'watch' → goes into the daily digest, no instant ping
 */

import type { Severity, ThreatCategory } from '../types';

export interface DetectionHit {
  category: ThreatCategory;
  severity: Severity;
  reason: string;
}

interface ThreatGroup {
  category: ThreatCategory;
  severity: Severity;
  reason: string;
  patterns: RegExp[];
}

const GROUPS: ThreatGroup[] = [
  {
    category: 'grooming',
    severity: 'alert',
    reason: 'secrecy pressure — asking to hide this conversation from parents or adults',
    patterns: [
      /\bdon'?t\s+tell\s+(?:your\s+)?(?:parents?|mom|mum|dad|anyone|adults?|teachers?)\b/i,
      /\bour\s+(?:little\s+)?secret\b/i,
      /\bkeep\s+(?:this|it)\s+between\s+us\b/i,
      /\bdelete\s+(?:this|these|our)\s+(?:message|chat|conversation)s?\b/i,
      /\bdo\s+your\s+parents?\s+(?:check|see|read|look\s+at)\b/i,
      /\bare\s+you\s+alone\b/i,
      /\bare\s+your\s+parents?\s+(?:home|around|there)\b/i,
      /\bnobody\s+(?:has\s+to|needs?\s+to|will)\s+know\b/i,
    ],
  },
  {
    category: 'photo-request',
    severity: 'alert',
    reason: 'requesting photos or camera access',
    patterns: [
      /\bsend\s+(?:me\s+)?(?:a\s+)?(?:photo|pic|picture|selfie|snap)s?\s*(?:of\s+(?:you|yourself|ur?self))?\b/i,
      /\bwhat\s+are\s+you\s+wearing\b/i,
      /\bturn\s+on\s+(?:your\s+)?(?:camera|cam|video)\b/i,
      /\bshow\s+me\s+(?:your|ur)\b/i,
      /\b(?:nudes?|n4n)\b/i,
    ],
  },
  {
    category: 'meetup',
    severity: 'alert',
    reason: 'pressure to meet in person or accept a ride',
    patterns: [
      /\bmeet\s+(?:me|up)\b.{0,30}\b(?:alone|secret|don'?t\s+tell)\b/i,
      /\bi(?:\s+can|\s+will|'ll)\s+pick\s+you\s+up\b/i,
      /\bdon'?t\s+bring\s+(?:anyone|your\s+friends?)\b/i,
      /\bcome\s+(?:to\s+my|over\s+to\s+my)\s+(?:place|house|apartment|hotel)\b/i,
      /\bget\s+in\s+(?:my|the)\s+car\b/i,
    ],
  },
  {
    category: 'explicit',
    severity: 'alert',
    reason: 'sexually explicit content sent to this phone',
    patterns: [
      /\bsex(?:t|ting|ual)?\b/i,
      /\bhorny\b/i,
      /\b(?:dick|cock|pussy|boobs?|tits)\b/i,
      /\bvirgin(?:ity)?\b/i,
    ],
  },
  {
    category: 'self-harm',
    severity: 'alert',
    reason: 'a contact may be talking about self-harm or suicide — they might need help',
    patterns: [
      /\bkill\s+(?:myself|me)\b/i,
      /\b(?:kms|kys)\b/i,
      /\bwant\s+to\s+die\b/i,
      /\b(?:suicide|suicidal)\b/i,
      /\b(?:cutting|cut)\s+(?:myself|my\s+(?:arms?|wrists?|legs?))\b/i,
      /\bself\s*-?\s*harm\b/i,
      /\bbetter\s+off\s+without\s+me\b/i,
      /\bno\s+reason\s+to\s+(?:live|be\s+here|go\s+on)\b/i,
    ],
  },
  {
    category: 'bullying',
    severity: 'watch',
    reason: 'targeted insults or exclusion — possible bullying',
    patterns: [
      /\bkill\s+yourself\b/i,
      /\b(?:nobody|no\s+one)\s+(?:likes?|wants?)\s+you\b/i,
      /\beveryone\s+(?:hates?|laughs?\s+at)\s+you\b/i,
      /\byou'?re?\s+(?:so\s+)?(?:ugly|fat|worthless|pathetic|a\s+loser|a\s+freak)\b/i,
      /\byou\s+(?:have|got)\s+no\s+friends\b/i,
      /\bwhy\s+are\s+you\s+(?:even|still)\s+(?:here|alive|at\s+this\s+school)\b/i,
    ],
  },
  {
    category: 'lure',
    severity: 'watch',
    reason: 'gift or reward offered by a contact — a common grooming opener',
    patterns: [
      /\bi(?:'ll|\s+will)\s+(?:buy|give|send|get)\s+you\s+(?:money|cash|a\s+gift|gift\s*cards?|robux|v-?bucks|skins?|nitro|credits?)\b/i,
      /\bfree\s+(?:robux|v-?bucks|skins?|nitro|gift\s*cards?|money)\b/i,
      /\bhow\s+old\s+are\s+you\b/i,
      /\bwhat\s+school\s+do\s+you\s+(?:go|attend)\b/i,
      /\badd\s+me\s+on\s+(?:snap(?:chat)?|telegram|whats\s?app|discord|insta(?:gram)?|kik)\b.{0,40}\b(?:secret|private|don'?t\s+tell)\b/i,
    ],
  },
  {
    category: 'scam',
    severity: 'watch',
    reason: 'classic scam pattern — fake prize, account threat, or payment demand',
    patterns: [
      /\byou(?:'ve|\s+have)?\s+won\b/i,
      /\bclaim\s+your\s+(?:prize|reward|gift)\b/i,
      /\bverify\s+your\s+account\b/i,
      /\bsend\s+(?:your\s+)?(?:password|otp|code|pin)\b/i,
      /\bclick\s+(?:this|the)\s+link\b.{0,40}\b(?:free|claim|win|prize)\b/i,
      /\baccount\s+(?:will\s+be\s+)?(?:suspended|deleted|banned)\b/i,
    ],
  },
];

/** Normalize obfuscations predators actually use: l33t, repeats, spacing. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/\$/g, 's')
    .replace(/(.)\1{2,}/g, '$1')       // "parentsss" → "parents" (runs of 3+ → 1; doubles like "tell" survive)
    .replace(/\s+/g, ' ');
}

/**
 * Scan one piece of incoming text. Returns the FIRST hit by severity order
 * (alert-level groups are listed before watch-level ones), or null.
 * A hit on EITHER the raw or the normalized form counts — normalization
 * can mangle legit l33t words.
 */
export function detectThreat(text: string): DetectionHit | null {
  const t = normalize(text);
  for (const g of GROUPS) {
    for (const re of g.patterns) {
      if (re.test(t) || re.test(text)) {
        return { category: g.category, severity: g.severity, reason: g.reason };
      }
    }
  }
  return null;
}

/** Human labels for each category, used in alert cards and digests. */
export const CATEGORY_LABELS: Record<ThreatCategory, string> = {
  'grooming': 'Grooming / secrecy',
  'photo-request': 'Photo request',
  'meetup': 'Meet-up pressure',
  'explicit': 'Explicit content',
  'lure': 'Gift lure',
  'scam': 'Scam',
  'bullying': 'Bullying',
  'self-harm': 'Self-harm mention',
};

export const CATEGORY_EMOJI: Record<ThreatCategory, string> = {
  'grooming': '🚨',
  'photo-request': '📸',
  'meetup': '📍',
  'explicit': '🔞',
  'lure': '🎁',
  'scam': '🎣',
  'bullying': '💢',
  'self-harm': '🆘',
};

/** Apps the native watcher listens to (package → label). Mirrored in Java. */
export const WATCHED_APPS: Record<string, string> = {
  'com.whatsapp': 'WhatsApp',
  'com.whatsapp.w4b': 'WhatsApp Business',
  'com.instagram.android': 'Instagram',
  'com.snapchat.android': 'Snapchat',
  'org.telegram.messenger': 'Telegram',
  'com.discord': 'Discord',
  'com.facebook.orca': 'Messenger',
  'com.google.android.apps.messaging': 'Messages (SMS)',
  'com.samsung.android.messaging': 'Messages (SMS)',
  'kik.android': 'Kik',
  'com.strenes.app': 'Strenes',
};
