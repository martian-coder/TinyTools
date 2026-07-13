/** Demo-mode data: a believable, mostly-quiet week on a protected phone. */

import type { ChatMsg, PerchEvent } from '../types';
import { uid } from '../store';

const h = 3600_000;
const d = 24 * h;

export function demoEvents(): PerchEvent[] {
  const now = Date.now();
  return [
    {
      id: uid(), category: 'lure', severity: 'watch',
      reason: 'gift or reward offered by a contact — a common grooming opener',
      app: 'Snapchat', sender: 'xX_gamerguy22', at: now - 5 * d - 3 * h,
    },
    {
      id: uid(), category: 'grooming', severity: 'alert',
      reason: 'secrecy pressure — asking to hide this conversation from parents or adults',
      app: 'Snapchat', sender: 'xX_gamerguy22', at: now - 5 * d - 2 * h,
    },
    {
      id: uid(), category: 'scam', severity: 'watch',
      reason: 'classic scam pattern — fake prize, account threat, or payment demand',
      app: 'Messages (SMS)', sender: 'VM-PRIZES', at: now - 3 * d,
    },
    {
      id: uid(), category: 'bullying', severity: 'watch',
      reason: 'targeted insults or exclusion — possible bullying',
      app: 'WhatsApp', sender: 'Class 8B 🏏', at: now - 1 * d - 6 * h,
    },
  ];
}

export function demoGreeting(): ChatMsg {
  return {
    id: uid(),
    role: 'perch',
    text: "Hi — I'm Perch 🦉 I've been watching over Aryan's phone this week. Mostly quiet: one stranger on Snapchat tried the classic gift-then-secrecy move on Tuesday (I flagged both messages, Aryan didn't reply), one obvious prize scam SMS, and some rough words in the class group yesterday that are worth keeping an eye on. Ask me anything.",
    at: Date.now(),
  };
}
