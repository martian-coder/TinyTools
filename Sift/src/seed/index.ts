import type { Contact, Message, UserSettings } from '../types';

export const SEED_CONTACTS: Contact[] = [
  { id: 'c1', name: 'Priya Sharma', grad: 'linear-gradient(135deg,#7c83ff,#22d3ee)', trusted: false },
  { id: 'c2', name: 'Dev Kumar',    grad: 'linear-gradient(135deg,#fb7185,#fb923c)', trusted: false },
  { id: 'c3', name: 'Acme Delivery',grad: 'linear-gradient(135deg,#38bdf8,#6366f1)', trusted: false },
  { id: 'c4', name: 'ShopZone',     grad: 'linear-gradient(135deg,#a78bfa,#f472b6)', trusted: false },
  { id: 'c5', name: 'Rahul (trusted)',grad:'linear-gradient(135deg,#34d399,#06b6d4)', trusted: true  },
];

const now = Date.now();
const mins = (n: number) => now - n * 60000;
const fmt = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const SEED_MESSAGES: Message[] = [
  // Primary — clean personal chat with Priya
  {
    id: 'm1', contactId: 'c1', text: "Hey! Are you coming to the party tonight?",
    dir: 'in', ts: mins(45), time: fmt(mins(45)),
    verdict: { category: 'clean', confidence: 0.95, reason: 'No issues', engine: 'rules' },
    folder: 'primary', status: 'delivered',
  },
  {
    id: 'm2', contactId: 'c1', text: "Yes, definitely! What time does it start?",
    dir: 'out', ts: mins(43), time: fmt(mins(43)),
    folder: 'primary', status: 'delivered',
  },
  {
    id: 'm3', contactId: 'c1', text: "Around 8pm. Bring some snacks if you can 😊",
    dir: 'in', ts: mins(40), time: fmt(mins(40)),
    verdict: { category: 'clean', confidence: 0.93, engine: 'rules' },
    folder: 'primary', status: 'delivered',
  },

  // Review — abusive message from Dev Kumar
  {
    id: 'm4', contactId: 'c2',
    text: "You're such a moron. I can't believe how stupid you are sometimes. Just shut up already.",
    dir: 'in', ts: mins(30), time: fmt(mins(30)),
    verdict: {
      category: 'abusive', confidence: 0.91,
      flaggedTerms: ['moron', 'stupid', 'shut up'],
      reason: 'Abusive language detected', engine: 'rules',
    },
    folder: 'review', status: 'held', autoReply: true,
  },

  // Business folder — Acme Delivery
  {
    id: 'm5', contactId: 'c3',
    text: "Your order #4821 has been shipped! Expected delivery tomorrow. Track your package at acme.in/track",
    dir: 'in', ts: mins(20), time: fmt(mins(20)),
    verdict: { category: 'business', confidence: 0.87, reason: 'Transactional delivery update', engine: 'rules' },
    folder: 'business', status: 'delivered',
  },
  {
    id: 'm6', contactId: 'c3',
    text: "Your OTP is 847291. Valid for 10 minutes. Do not share with anyone.",
    dir: 'in', ts: mins(15), time: fmt(mins(15)),
    verdict: { category: 'business', confidence: 0.92, reason: 'OTP / account message', engine: 'rules' },
    folder: 'business', status: 'delivered',
  },

  // Promotions folder — ShopZone forward
  {
    id: 'm7', contactId: 'c4',
    text: "🎉🎉 MEGA SALE! 70% OFF all items! Flash sale ends tonight! Shop now and save big! Limited stock — hurry! Share this with 10 friends to unlock extra 10% off! 🛍️🛍️",
    dir: 'in', ts: mins(10), time: fmt(mins(10)),
    verdict: { category: 'promo', confidence: 0.89, reason: 'Promotional content', engine: 'rules' },
    folder: 'promotions', status: 'delivered',
  },

  // Primary — trusted contact Rahul (flaggable but bypasses filter)
  {
    id: 'm8', contactId: 'c5',
    text: "Bro you're such an idiot sometimes lol 😂 anyway see you at 8!",
    dir: 'in', ts: mins(5), time: fmt(mins(5)),
    verdict: { category: 'abusive', confidence: 0.72, flaggedTerms: ['idiot'], reason: 'Mild abusive term', engine: 'rules' },
    folder: 'primary', status: 'delivered',
  },
];

export const DEFAULT_SETTINGS: UserSettings = {
  civility: {
    enabled: true,
    sensitivity: 'medium',
    onBlock: 'review',
    notifySender: true,
  },
  business: { enabled: true },
  spam: { enabled: true, onBlock: 'review' },
  theme: 'aurora',
  trustedIds: ['c5'],
};
