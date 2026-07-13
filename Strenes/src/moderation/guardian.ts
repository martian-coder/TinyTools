/**
 * guardian — on-device predator / grooming / scam detection for Guardian mode.
 *
 * Runs BEFORE trust checks (groomed kids often "trust" their groomer) and
 * entirely on-device: no message content ever leaves the phone. Patterns are
 * grouped by threat category; each group carries a severity and a
 * plain-language reason shown to the child and sent to the linked guardian.
 *
 * severity 'block'  → message is dropped, guardian alerted immediately
 * severity 'review' → message is held for review, guardian alerted
 */

export type ThreatCategory = 'grooming' | 'photo-request' | 'meetup' | 'explicit' | 'lure' | 'scam';

export interface GuardianHit {
  category: ThreatCategory;
  severity: 'block' | 'review';
  /** Plain-language explanation, written to be read by a parent OR a kid. */
  reason: string;
}

interface ThreatGroup {
  category: ThreatCategory;
  severity: 'block' | 'review';
  reason: string;
  patterns: RegExp[];
}

const GROUPS: ThreatGroup[] = [
  {
    category: 'grooming',
    severity: 'block',
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
    severity: 'block',
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
    severity: 'block',
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
    severity: 'block',
    reason: 'sexually explicit content sent to this phone',
    patterns: [
      /\bsex(?:t|ting|ual)?\b/i,
      /\bhorny\b/i,
      /\b(?:dick|cock|pussy|boobs?|tits)\b/i,
      /\bvirgin(?:ity)?\b/i,
    ],
  },
  {
    category: 'lure',
    severity: 'review',
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
    severity: 'review',
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

/** Normalize obfuscations kids' predators actually use: spacing, l33t, repeats. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/\$/g, 's')
    .replace(/(.)\1{2,}/g, '$1')       // "parentsss" → "parents" (runs of 3+ → 1; doubles like "tell" survive)
    .replace(/\s+/g, ' ');
}

/**
 * Scan one incoming message. Returns the FIRST hit by severity order
 * (block-level groups are listed before review-level ones), or null.
 */
export function detectThreat(text: string): GuardianHit | null {
  const t = normalize(text);
  // Also test the raw text — normalization can mangle legit l33t words,
  // so a hit on EITHER form counts.
  for (const g of GROUPS) {
    for (const re of g.patterns) {
      if (re.test(t) || re.test(text)) {
        return { category: g.category, severity: g.severity, reason: g.reason };
      }
    }
  }
  return null;
}

/** The alert message relayed to the linked guardian. Contains NO message content. */
export function guardianAlertText(senderName: string, hit: GuardianHit): string {
  const action = hit.severity === 'block' ? 'blocked' : 'held for review';
  return `🛡️ Strenes Guardian: a message from "${senderName}" was ${action} on this child's phone — ${hit.reason}. (Category: ${hit.category}.) Open Strenes together to review it.`;
}
