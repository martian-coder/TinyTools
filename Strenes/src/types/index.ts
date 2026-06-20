export type Folder = 'primary' | 'business' | 'promotions' | 'review';
export type Category = 'clean' | 'abusive' | 'spam' | 'business' | 'promo';
export type BlockAction = 'review' | 'silentDrop' | 'askPerMessage';
export type ThemeName = 'aurora' | 'sunset' | 'noir' | 'daylight' | 'terminal';
export type DisappearingMessageMode = 'off' | 'onRead' | '1m' | '5m' | '1h' | '24h' | 'custom';
export type DrunkModeAction = 'prevent' | 'warn';
export type MessageTone = 'polite' | 'neutral' | 'assertive' | 'aggressive' | 'harsh';

export interface ToneAnalysis {
  tone: MessageTone;
  confidence: number;
  mightCauseAnxiety: boolean;
  suggestion?: string;
}

export type ModerationEngine = 'rules' | 'apple-fm' | 'gemini-nano' | 'executorch';

export interface ModerationVerdict {
  category: Category;
  confidence: number;
  flaggedTerms?: string[];
  reason?: string;
  engine: ModerationEngine;
}

export interface Contact {
  id: string;
  name: string;
  trusted: boolean;
  grad: string;
  isEmergency?: boolean;
}

export interface DNDSettings {
  enabled: boolean;
  startHour: number;
  endHour: number;
  allowTrusted: boolean;
  allowEmergency: boolean;
  notifyButSilent: boolean;
}

export interface DrunkModeSettings {
  enabled: boolean;
  autoDetect: boolean;
  action: DrunkModeAction;
  typingSpeedThreshold: number;
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
  disappearingMode?: DisappearingMessageMode;
  disappearingExpiresAt?: number;
  isRead?: boolean;
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
  theme: ThemeName;
  trustedIds: string[];
  disappearingMessages: {
    enabled: boolean;
    defaultMode: DisappearingMessageMode;
    customMinutes?: number;
  };
  dnd: DNDSettings;
  drunkMode: DrunkModeSettings;
  unhingedMode: {
    enabled: boolean;
  };
  toneChecker: {
    enabled: boolean;
    warnOnAggressive: boolean;
  };
}

export interface RouteResult {
  folder: Folder;
  status: 'delivered' | 'held' | 'dropped';
  autoReply?: boolean;
  ask?: boolean;
}
