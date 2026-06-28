export type Folder = 'primary' | 'business' | 'promotions' | 'review';
export type Category = 'clean' | 'abusive' | 'spam' | 'business' | 'promo';
export type BlockAction = 'review' | 'silentDrop' | 'askPerMessage';
export type MessageRoute = 'ip' | 'sms' | 'queued';
export type ThemeName = 'aurora' | 'sunset' | 'noir' | 'daylight' | 'terminal';
export type DisappearingMessageMode = 'off' | 'onRead' | '1m' | '5m' | '1h' | '24h' | 'custom';
export type MessageTone = 'polite' | 'neutral' | 'assertive' | 'aggressive' | 'harsh';
export type DrunkModeAction = 'prevent' | 'warn';

export type ModerationEngine = 'rules' | 'apple-fm' | 'gemini-nano' | 'executorch' | 'anthropic-claude';
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
  contactId: string;
  condition: string;
  action: 'block' | 'review';
  enabled: boolean;
  createdAt: number;
}

export interface Contact {
  id: string;
  name: string;
  trusted: boolean;
  grad: string;
  isEmergency?: boolean;
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
}

export interface RouteResult {
  folder: Folder;
  status: 'delivered' | 'held' | 'dropped';
  autoReply?: boolean;
  ask?: boolean;
}
