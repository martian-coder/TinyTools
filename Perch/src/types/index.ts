/** Which side of Perch this install is. */
export type Role = 'unset' | 'parent' | 'kid';

export type ThreatCategory =
  | 'grooming'
  | 'photo-request'
  | 'meetup'
  | 'explicit'
  | 'lure'
  | 'scam'
  | 'bullying'
  | 'self-harm';

/**
 * severity 'alert' → parent is pinged immediately
 * severity 'watch' → goes into the daily digest, no instant ping
 */
export type Severity = 'alert' | 'watch';

/**
 * One flag raised by the watcher. This is the ONLY thing that ever leaves
 * the protected phone: category + reason + which app + sender display name.
 * Never the message content.
 */
export interface PerchEvent {
  id: string;
  category: ThreatCategory;
  severity: Severity;
  /** Plain-language explanation, written to be read by a parent OR a kid. */
  reason: string;
  /** Source app label, e.g. "WhatsApp". */
  app: string;
  /** Notification title = sender display name (metadata, not content). */
  sender: string;
  /** Epoch ms. */
  at: number;
}

export interface ChatMsg {
  id: string;
  role: 'parent' | 'perch';
  text: string;
  at: number;
}

export type ParentTab = 'home' | 'chat' | 'shield' | 'settings';
