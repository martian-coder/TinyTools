import type { Contact, Message, UserSettings } from '../types';

const GRADS = [
  'linear-gradient(135deg,#7c83ff,#22d3ee)',
  'linear-gradient(135deg,#fb7185,#fb923c)',
  'linear-gradient(135deg,#34d399,#06b6d4)',
  'linear-gradient(135deg,#a78bfa,#f472b6)',
  'linear-gradient(135deg,#38bdf8,#6366f1)',
];

export const SEED_CONTACTS: Contact[] = [
  { id: 'maya',     name: 'Maya',           trusted: false, grad: GRADS[0] },
  { id: 'unknown',  name: '+1 (555) 0142',  trusted: false, grad: 'linear-gradient(135deg,#94a3b8,#64748b)' },
  { id: 'quickcart',name: 'QuickCart',      trusted: false, grad: GRADS[4] },
  { id: 'megadeals',name: 'MegaDeals',      trusted: false, grad: GRADS[3] },
  { id: 'groupfwd', name: 'Group Forward',  trusted: false, grad: GRADS[1] },
  { id: 'dad',      name: 'Dad',            trusted: true,  grad: GRADS[2] },
];

export const SEED_MESSAGES: Message[] = [
  { id: 'm1', contactId: 'maya',      text: "Hey! Are we still on for Saturday?",                                              dir: 'in',  ts: 1, time: '9:41', folder: 'primary',    status: 'delivered', verdict: { category: 'clean',    confidence: 0.92, flaggedTerms: [], engine: 'rules' } },
  { id: 'm2', contactId: 'maya',      text: "I found a great trail 🥾",                                                        dir: 'in',  ts: 2, time: '9:42', folder: 'primary',    status: 'delivered', verdict: { category: 'clean',    confidence: 0.92, flaggedTerms: [], engine: 'rules' } },
  { id: 'm3', contactId: 'dad',       text: "this stupid traffic is killing me, running late lol",                             dir: 'in',  ts: 3, time: '8:30', folder: 'primary',    status: 'delivered', verdict: { category: 'abusive',  confidence: 0.74, flaggedTerms: ['stupid'], engine: 'rules' } },
  { id: 'm4', contactId: 'quickcart', text: "Your order #4821 has shipped — track delivery here.",                             dir: 'in',  ts: 4, time: 'Tue',  folder: 'business',   status: 'delivered', verdict: { category: 'business', confidence: 0.82, flaggedTerms: ['order','shipped'], engine: 'rules' } },
  { id: 'm5', contactId: 'megadeals', text: "Limited time! 50% off everything — shop the sale now.",                          dir: 'in',  ts: 5, time: 'Mon',  folder: 'promotions', status: 'delivered', verdict: { category: 'promo',    confidence: 0.80, flaggedTerms: ['limited time','sale'], engine: 'rules' } },
  { id: 'm6', contactId: 'unknown',   text: "you're such an idiot, I hate you",                                                dir: 'in',  ts: 6, time: '7:12', folder: 'review',     status: 'held',      verdict: { category: 'abusive',  confidence: 0.94, flaggedTerms: ['idiot','hate you'], engine: 'rules' }, autoReply: true },
  { id: 'm7', contactId: 'groupfwd',  text: "URGENT!! Forward this to 10 people or bad luck 😱😱😱",                           dir: 'in',  ts: 7, time: '6:05', folder: 'review',     status: 'held',      verdict: { category: 'spam',     confidence: 0.91, flaggedTerms: ['forward','10 people'], engine: 'rules' } },
];

export const DEFAULT_SETTINGS: UserSettings = {
  civility: { enabled: true, sensitivity: 'medium', onBlock: 'review', notifySender: true },
  business: { enabled: true },
  spam:     { enabled: true, onBlock: 'review' },
  theme:    'aurora',
  trustedIds: ['dad'],
  disappearingMessages: { enabled: false, defaultMode: 'off', customMinutes: 60 },
  dnd: { enabled: false, startHour: 22, endHour: 7, allowTrusted: true, allowEmergency: true, notifyButSilent: false },
  drunkMode: { enabled: false, autoDetect: true, action: 'prevent', typingSpeedThreshold: 80 },
  unhingedMode: { enabled: false },
  toneChecker: { enabled: true, warnOnAggressive: true },
  spellCheck: { enabled: true },
  aiReplies: { enabled: true, anthropicKey: '' },
  smsFallback: { enabled: false },
};
