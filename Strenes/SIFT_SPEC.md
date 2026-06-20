# Sift — Build Spec (for Claude Code)

> **Working name:** Sift (rename freely). A messaging app like WhatsApp, but the **recipient** controls an AI filter that screens, sorts, and blocks incoming messages before they reach the inbox.

---

## 1. The one-line pitch

A clean, WhatsApp-style chat app where *you* decide what's allowed to reach you: abusive/foul-language messages get filtered, business and promo messages auto-sort into their own folders, and junk forwards get blocked — all controlled by simple per-category settings.

## 2. What to build (scope for v1)

Build a **clickable concept demo**:

- **Platform:** Mobile-styled **web app / PWA** (installable to home screen, behaves like a phone app). Use a phone-frame layout — full-bleed on actual mobile, centered phone frame on desktop.
- **No backend, no auth, no real message delivery.** Everything runs locally with **seeded demo data** so the concept is fully visible and tappable.
- **Moderation:** built-in smart rules for now, hidden behind **one swappable module** so it can later call a real AI model with no UI rewrite (see §6).

### Explicitly OUT of scope for this demo
- Real two-device messaging / servers / sockets
- Login, accounts, phone-number verification
- End-to-end encryption
- App-store packaging

(These are noted in §10 as the future path — don't build them now.)

## 3. Tech stack

- **React + Vite** + **TypeScript**
- **Tailwind CSS** for styling
- **PWA**: include `manifest.json` + service worker so "Add to Home Screen" works
- **State:** local React state + a small in-memory store (e.g. Zustand or Context). Persist to `localStorage` so settings/seeded chats survive refresh.
- **No external API calls** in the demo build.

## 4. Core features

### 4.1 Chat experience (the familiar WhatsApp part)
- **Chat list** screen: avatar, name, last-message preview, timestamp, unread badge, folder tabs.
- **Conversation** screen: message bubbles (sent/received), timestamps, text input + send.
- Smooth, native-feeling transitions between list ↔ conversation.

### 4.2 The AI filter (the differentiator)
Every **incoming** message passes through the moderation module and gets a verdict, then routed by the user's settings.

**Categories detected:** `clean`, `abusive` (foul/abusive language), `spam` (junk/forward), `business`, `promo`.

**Civility filter** — when a message is `abusive`, the action depends on the user's setting:
- `review` → message held in the **Review** folder (default)
- `silentDrop` → message discarded, user never sees it
- `askPerMessage` → user gets a "A message was filtered — view it?" prompt and decides each time
- If **notify sender** is on → sender automatically gets: *"[name] doesn't accept messages containing abusive language."*

**Trusted contacts** bypass all filters (whitelist).

### 4.3 Smart folders (inbox categories)
Tabs/folders at the top of the chat list:
- **Primary** — normal personal chats
- **Business** — messages classified `business` auto-routed here
- **Promotions** — `promo` / forwarded junk
- **Review** — held `abusive`/`spam` messages awaiting the user's decision

### 4.4 Review folder UX
For each held message: show the content (with a subtle "filtered" tag), and **Approve** (moves it to Primary) or **Reject** (deletes + optionally notifies sender). Bulk "clear all" too.

### 4.5 Settings screen
One toggle group per filter, matching the model in §5:
- Civility filter: on/off, sensitivity (low/med/high), on-block action, notify-sender on/off
- Business sorting: on/off
- Spam/forward filter: on/off, on-block action
- Trusted contacts: simple add/remove list

### 4.6 "Test it yourself" simulator
A small panel (e.g. a dev/demo drawer) where the user **types a message as if an incoming sender**, hits "Receive," and watches the verdict + routing happen live. This is what sells the concept — make it satisfying (show the category badge + where it landed).

## 5. Data model

```ts
type Folder = 'primary' | 'business' | 'promotions' | 'review';
type Category = 'clean' | 'abusive' | 'spam' | 'business' | 'promo';
type BlockAction = 'review' | 'silentDrop' | 'askPerMessage';

interface Contact { id: string; name: string; avatar?: string; trusted: boolean; }

interface Message {
  id: string;
  contactId: string;
  text: string;
  direction: 'in' | 'out';
  timestamp: number;
  verdict?: ModerationVerdict;   // set for incoming
  folder: Folder;
  status: 'delivered' | 'held' | 'dropped' | 'approved' | 'rejected';
}

interface UserSettings {
  civility: { enabled: boolean; sensitivity: 'low'|'medium'|'high';
              onBlock: BlockAction; notifySender: boolean; };
  business: { enabled: boolean; };
  spam:     { enabled: boolean; onBlock: BlockAction; };
}
```

## 6. The moderation module (keep it swappable!)

This is the most important architectural rule: **all classification lives behind one interface** so the rules engine can be replaced by a real AI later without touching the UI.

```ts
interface ModerationVerdict {
  category: Category;
  confidence: number;        // 0..1
  flaggedTerms?: string[];
  reason?: string;
}

// v1 = local rules. Future = swap this function body to call a real model.
function moderate(text: string, settings: UserSettings): ModerationVerdict
```

**v1 rules engine** (no AI, runs offline):
- `abusive`: match against a configurable foul/abuse wordlist; sensitivity raises/lowers thresholds.
- `spam`: heuristics — "Forwarded", many emojis/links, ALL-CAPS, "share with 10 friends", etc.
- `business`/`promo`: keywords like order, invoice, OTP, sale, discount, offer, delivery.
- else `clean`.

Routing function takes `(verdict, settings)` → returns `{ folder, status, senderAutoReply? }`.

## 7. Seeded demo data

Ship the demo pre-loaded so every path is visible immediately:
- A **clean** personal chat (a friend) → Primary
- An **abusive** message → Review folder, with a sender auto-reply shown
- A **business** message (e.g. order/delivery update) → Business folder
- A **promo/forward** ("Forwarded many times… share with 10 people!") → Promotions
- One **trusted contact** whose abusive-ish message still comes through (to show whitelist works)

## 8. Screens & navigation

```
Chat List (folder tabs: Primary | Business | Promotions | Review)
  └─ Conversation
Settings
Test-it-yourself simulator (drawer or tab)
```

## 9. Design direction

Familiar enough to feel like WhatsApp, distinct enough to feel like its own product. Clean, calm, confident.
- A single strong accent color that is **not** WhatsApp green (suggest a deep teal or indigo) so it reads as its own brand.
- Rounded message bubbles, generous spacing, soft shadows, a clear "filtered" tag style (subtle, not alarming).
- Category badges with quiet color coding (e.g. business = blue, promo = amber, review = muted red).
- Mobile-first; phone frame when viewed on desktop.

## 10. Future path (do NOT build now — note in README)
- Swap `moderate()` to call a real AI model for true semantic understanding (tone, context, sarcasm).
- Real backend + real-time delivery between two devices.
- Accounts + encryption.
- Package the PWA as an installable iOS/Android app.

## 11. Build order (suggested milestones)
1. Scaffold Vite + React + TS + Tailwind + PWA manifest.
2. Data model + in-memory store + localStorage persistence + seed data.
3. Chat list + conversation UI (static, looks like WhatsApp).
4. Moderation module (`moderate()`) + routing function with unit-testable verdicts.
5. Folder tabs + Review folder approve/reject + sender auto-reply.
6. Settings screen wired to live filtering.
7. "Test it yourself" simulator.
8. Polish: transitions, badges, empty states, design pass.

## 12. Acceptance check (demo is done when…)
- Typing an abusive message in the simulator sends it to **Review** and shows the sender auto-reply.
- Toggling civility filter to **silentDrop** makes the same message vanish.
- A business and a promo test message land in the right folders.
- A trusted contact's flagged message still reaches Primary.
- App installs to home screen (PWA) and survives a refresh.
