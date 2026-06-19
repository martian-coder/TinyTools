export type Folder = 'primary' | 'business' | 'promotions' | 'review';
export type Category = 'clean' | 'abusive' | 'spam' | 'business' | 'promo';
export type BlockAction = 'review' | 'silentDrop' | 'askPerMessage';
export type ThemeName = 'aurora' | 'sunset' | 'noir' | 'daylight';

export interface ModerationVerdict {
  category: Category;
  confidence: number;
  flaggedTerms?: string[];
  reason?: string;
  engine: 'rules';
}

export interface Contact {
  id: string;
  name: string;
  trusted: boolean;
  grad: string;
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
}

export interface RouteResult {
  folder: Folder;
  status: 'delivered' | 'held' | 'dropped';
  autoReply?: boolean;
  ask?: boolean;
}
