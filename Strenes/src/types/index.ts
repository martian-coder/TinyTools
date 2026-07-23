export type Folder = 'primary' | 'business' | 'promotions' | 'review';
export type Category = 'clean' | 'abusive' | 'spam' | 'business' | 'promo';
export type BlockAction = 'review' | 'silentDrop' | 'askPerMessage';
export type MessageRoute = 'ip' | 'sms' | 'queued';
export type ThemeName = 'aurora' | 'sunset' | 'noir' | 'daylight' | 'terminal';
export type DisappearingMessageMode = 'off' | 'onRead' | '1m' | '5m' | '1h' | '24h' | 'custom';
export type MessageTone = 'polite' | 'neutral' | 'assertive' | 'aggressive' | 'harsh';
export type DrunkModeAction = 'prevent' | 'warn';

export type ModerationEngine = 'rules' | 'apple-fm' | 'gemini-nano' | 'executorch' | 'anthropic-claude' | 'gemini-api';
export type AIProvider = 'gemini-nano' | 'anthropic-claude';

export interface SpellCheckSuggestion {
  original: string;
  suggested: string;
  reason: 'typo' | 'slang' | 'casual';
  confidence: number;
}

export interface ModerationVerdict {
  category: Category;
  confidence: number;
  flaggedTerms?: string[];
  reason?: string;
  engine: ModerationEngine;
}

export interface ToneAnalysis {
  tone: MessageTone;
  confidence: number;
  mightCauseAnxiety: boolean;
  suggestion?: string;
}

export interface DynamicRule {
  id: string;
  /** Target contact id, or '*' for a rule that applies to every sender. */
  contactId: string;
  condition: string;
  action: 'block' | 'review';
  enabled: boolean;
  createdAt: number;
  /** Epoch ms after which the rule stops applying ("for 4 hours", "today"). Absent = permanent. */
  expiresAt?: number;
  /** 'profile' = managed by a protection profile; replaced when profiles switch. */
  source?: string;
}

export type SummaryStyle = 'professional' | 'casual' | 'brief';

/** One thing the Commander remembers about the user. Local-only, never synced. */
export interface MemoryNote {
  id: string;
  text: string;
  kind: 'fact' | 'situation';
  createdAt: number;
  /** Situations can expire ("exams till friday"); facts usually don't. */
  expiresAt?: number;
}

export interface Contact {
  id: string;
  name: string;
  trusted: boolean;
  blocked?: boolean;
  grad: string;
  isEmergency?: boolean;
  /** E.164 phone number, present for contacts synced from the backend. */
  phone?: string;
  /** Relationship circle — drives briefing priority (who matters to you). */
  circle?: 'family' | 'work' | 'friends' | 'vip';
  /** Live presence, synced from the backend contact list. */
  online?: boolean;
}

export interface Message {
  id: string;
  contactId: string;
  text: string;
  dir: 'in' | 'out';
  ts: number;
  time: string;
  verdict?: ModerationVerdict;
  folder: Folder;
  status: 'delivered' | 'held' | 'dropped' | 'approved' | 'rejected';
  autoReply?: boolean;
  disappearsAt?: number;
  route?: MessageRoute;
  /** Relay row id — correlates receipts between sender and recipient. */
  relayId?: string;
  /** Outgoing only: what the recipient's device reported back. */
  receipt?: 'delivered' | 'read' | 'held' | 'filtered';
  /** Short category for held/filtered receipts (e.g. "spam"). */
  receiptReason?: string;
  /** Incoming only: read receipt already sent for this message. */
  readReceiptSent?: boolean;
}

export interface UserSettings {
  civility: {
    enabled: boolean;
    sensitivity: 'low' | 'medium' | 'high';
    onBlock: BlockAction;
    notifySender: boolean;
  };
  business: { enabled: boolean };
  spam: { enabled: boolean; onBlock: BlockAction };
  disappearingMessages: {
    enabled: boolean;
    defaultMode: DisappearingMessageMode;
    customMinutes?: number;
  };
  dnd: {
    enabled: boolean;
    startHour: number;
    endHour: number;
    allowTrusted: boolean;
    allowEmergency: boolean;
    notifyButSilent: boolean;
  };
  drunkMode: {
    enabled: boolean;
    autoDetect: boolean;
    action: DrunkModeAction;
    typingSpeedThreshold: number;
  };
  unhingedMode: {
    enabled: boolean;
  };
  toneChecker: {
    enabled: boolean;
    warnOnAggressive: boolean;
  };
  spellCheck: {
    enabled: boolean;
  };
  aiReplies: {
    enabled: boolean;
    anthropicKey: string;
  };
  aiModeration: {
    provider: AIProvider;
    anthropicKey: string;
  };
  smsFallback: {
    enabled: boolean;
  };
  theme: ThemeName;
  trustedIds: string[];
  dynamicRules: DynamicRule[];
  /** Commander preferences. Optional so settings persisted before this feature still load. */
  commander?: {
    summaryStyle: SummaryStyle;
    /** Active protection profile id, if the user picked one. */
    profile?: string;
  };
  /** contactId → epoch ms until which their updates are hidden from Commander briefings. */
  mutes?: Record<string, number>;
  /** Guardian mode: kid-safe on-device threat detection + parent alerts. */
  guardian?: {
    enabled: boolean;
    /** Contact who receives real-time alerts (content never included). */
    guardianContactId?: string;
    guardianName?: string;
    alerts: boolean;
  };
  /** Commander's memory about the user. Stored only on this device. */
  memory?: MemoryNote[];
  _onboardingComplete?: boolean;
}

export interface RouteResult {
  folder: Folder;
  status: 'delivered' | 'held' | 'dropped';
  autoReply?: boolean;
  ask?: boolean;
}

// ── Groups ─────────────────────────────────────────────────────────────────

export interface Group {
  id: string;
  name: string;
  avatar?: string;       // emoji or URL
  createdBy: string;     // userId
  createdAt: number;
  members: GroupMember[];
  /** Encrypted group key for the current user (base64). Null until key is fetched. */
  encryptedKey?: string;
  /** Creator's public key needed to decrypt the encryptedKey. */
  creatorPubKey?: string;
  /** In-memory decrypted group key — never persisted. */
  groupKeyB64?: string;
}

export interface GroupMember {
  userId: string;
  displayName?: string;
  role: 'admin' | 'member';
  joinedAt: number;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  fromUserId: string;
  fromName?: string;
  text: string;
  ts: number;
  encrypted?: boolean;
}
