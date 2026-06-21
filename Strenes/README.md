# Strenes — AI Message Filter PWA

> Every message that reaches you should spark joy. Filter out the noise, abuse, and spam — on-device, offline, and under your control.

A WhatsApp-style PWA where **you** control an on-device AI filter that screens every incoming message before it reaches you. Built with React 19, Vite, and Chrome's built-in Gemini Nano LLM.

---

## ✨ Features

### AI Inbox Assistant
- **Commander** — conversational AI inbox briefing. Chat with your inbox: "reply Maya yes I'll be there", "open Alex", "show held messages", "approve all". Streams one bubble per sender, iMessage-style.

### Message Filtering
- **Civility Guard** — dual-engine AI classifier (Gemini Nano on-device + rules fallback) flags abusive, spam, business, and promo messages before they reach you. Tunable sensitivity (low / medium / high).
- **Smart Inbox Folders** — Primary, Business, Promotions, Review. Messages auto-route based on content.
- **Review Queue** — held messages are blurred by default. Tap to reveal, then approve or discard.
- **Trusted Contact Bypass** — mark contacts as trusted to let their messages skip all filters.
- **Business Folder Auto-sort** — OTPs, invoices, delivery updates, appointments → Business folder automatically.

### Outgoing Message Controls
- **Tone Analyzer** — warns you before sending if your message sounds aggressive or harsh. 5-level tone scale.
- **Style-aware Spell Check** — learns your casual writing style (slang, contractions, internet speak) and catches real typos without being annoying.
- **Drunk Mode Detection** — analyzes typing pattern (caps ratio, speed, typos, emoji ratio) and can warn or block sends.
- **Unhinged Mode** — instantly bypasses all filters when you want zero moderation.

### Privacy Scheduling
- **Do Not Disturb** — quiet hours with custom start/end. Allows trusted contacts and emergency exceptions.
- **Disappearing Messages** — set messages to vanish after read, 1m, 5m, 1h, or 24h. Countdown timer in bubble.

### AI Reply Suggestions
- **Claude AI Suggestions** — powered by Claude Haiku via your own API key. Suggests 3 contextual replies based on conversation history and the other person's style.

### Call Integration
- **In-call Overlay** — tap the phone icon in any conversation for a simulated call UI with avatar, timer, mute, and speaker controls.

### Appearance
- **5 Themes** — Aurora (default), Sunset, Noir, Daylight, Terminal. Glassmorphism surfaces with CSS custom properties throughout. Switch in Settings, persists to localStorage.
- **Installable PWA** — Add to home screen. Works on iOS (Safari 16.4+), Android (Chrome), and desktop.

### Safety & Privacy
- **On-device AI** — Gemini Nano via Chrome Prompt API. Message plaintext never leaves your device.
- **Offline-first** — zero network calls during moderation.
- **Rules fallback** — deterministic wordlist engine kicks in instantly if Gemini Nano is unavailable.

---

## 🎯 Why Strenes?

| Feature | Strenes | WhatsApp | iMessage | Telegram | Signal |
|---------|---------|----------|----------|----------|--------|
| AI inbox assistant | ✓ | ✗ | ✗ | ✗ | ✗ |
| On-device AI moderation | ✓ | ✗ | ✗ | ✗ | ✗ |
| Civility filter | ✓ | ✗ | ✗ | ✗ | ✗ |
| Smart auto-sort folders | ✓ | ✓ | ✗ | ✓ | ✗ |
| Blur-to-reveal review | ✓ | ✗ | ✗ | ✗ | ✗ |
| Tone analysis before send | ✓ | ✗ | ✗ | ✗ | ✗ |
| Drunk mode detection | ✓ | ✗ | ✗ | ✗ | ✗ |
| Disappearing messages | ✓ | ✓ | ✓ | ✓ | ✓ |
| Do Not Disturb scheduling | ✓ | ✓ | ✓ | ✓ | ✗ |
| E2E encryption | Future | ✓ | ✓ | ✓ | ✓ |
| Works offline | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## 🚀 Try It Now

**Marketing landing page:** https://martian-coder.github.io/TinyTools/strenes-home/  
→ 15-screen interactive carousel showcasing all features

**Live PWA app:** https://martian-coder.github.io/TinyTools/strenes/  
→ Install to home screen or use in browser. Works on Chrome, Edge, Samsung Internet, and Safari (iOS 16.4+).

---

## 📋 Architecture

### Moderation Pipeline

All classification flows through a swappable `Moderator` interface:

1. **Rules Pre-filter** (`RulesModerator`) — instant wordlist classification. Catches obvious cases.
2. **Escalation** — borderline messages pass to the AI model.
3. **Model** (`GeminiNanoModerator`) — Chrome's Prompt API (Gemini Nano, fully on-device).
4. **Routing** (`routeVerdict()`) — maps verdict + settings + trust + DND/unhinged flags → folder + status.

Key routing rules in `route.ts`:
- **Unhinged mode on** → bypass all filters, deliver to Primary
- **Emergency contact + DND allowEmergency** → bypass DND, deliver
- **DND active** → silence (drop or hold silently based on `notifyButSilent`)
- **Trusted sender** → skip content filters, deliver to Primary
- **Abusive** → Review queue (silentDrop / hold / askPerMessage)
- **Spam** → Review queue or Promotions
- **Business** → Business folder (if business sorting enabled)
- **Promo** → Promotions folder

### Tech Stack

**App (PWA):**
- **React 19 + Vite** — Fast SPA, instant HMR
- **TypeScript** — type-safe moderation, routing, store
- **Tailwind CSS v4** — glassmorphism design with 5 themes
- **Zustand v5** — lightweight state, persisted to localStorage
- **vite-plugin-pwa** — PWA manifest, service worker, offline support

**AI engines:**
- **Gemini Nano** — Chrome's built-in Prompt API (`window.ai.languageModel`)
- **Claude Haiku** — optional Anthropic API key for Commander NLP + reply suggestions
- **Rules engine** — deterministic fallback, always available

**Marketing landing page:**
- HTML5 + Vanilla JS, no frameworks
- 15-screen auto-scroll carousel with IntersectionObserver
- Responsive (mobile / tablet / desktop)

### Folder Structure

```
Strenes/
├── src/
│   ├── moderation/
│   │   ├── types.ts          — Moderator interface, Sensitivity
│   │   ├── rules.ts          — RulesModerator (wordlist, always-on fallback)
│   │   ├── gemini-nano.ts    — GeminiNanoModerator (Chrome Prompt API)
│   │   ├── index.ts          — getModerator() factory chain
│   │   ├── route.ts          — routeVerdict(verdict, settings, trusted, isEmergency)
│   │   ├── commander.ts      — parseIntent() for Commander NL commands
│   │   ├── tone-analyzer.ts  — analyzeTone() → MessageTone + anxiety flag
│   │   ├── spell-check.ts    — style-aware spell check (learns from history)
│   │   ├── drunk-detection.ts— analyzeTypingPattern() → DrunkLevel
│   │   ├── reply-suggest.ts  — suggestReplies() via Claude Haiku
│   │   └── summarize.ts      — summarizeMessages() for Digest
│   ├── screens/
│   │   ├── Commander.tsx     — AI inbox assistant (streaming chat UI)
│   │   ├── ChatList.tsx      — folder tabs + conversation list
│   │   ├── Conversation.tsx  — thread + review + call overlay + disappearing timer
│   │   ├── Settings.tsx      — all settings: civility, DND, drunk mode, spell check, etc.
│   │   ├── Simulator.tsx     — test the moderation engine live
│   │   └── Digest.tsx        — daily message digest
│   ├── store/index.ts        — Zustand store + selectors
│   ├── theme/index.ts        — 5 themes (Aurora, Sunset, Noir, Daylight, Terminal)
│   ├── types/index.ts        — shared TypeScript types
│   ├── components/ui/        — Glass, Badge, Avatar, BottomNav, Switch, Segment
│   ├── seed/index.ts         — demo contacts + messages + default settings
│   └── App.tsx               — root: phone frame + screen router
├── landing/
│   └── index.html            — 15-screen marketing carousel
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 🛠️ Development

### Local Setup

```bash
cd Strenes
npm install
npm run dev
# Opens http://localhost:5173
```

### Build for Production

```bash
npm run build
# Output: dist/
```

### Commander (AI Inbox Assistant)

The Commander screen works without an API key using heuristic intent parsing. For full NL understanding, add your Anthropic API key in Settings → AI Replies. It's used for both Commander intent parsing and reply suggestions.

Supported commands:
- `reply [name] [message]` — sends a reply
- `open [name]` / `show [name]` — opens the conversation
- `approve all` / `approve [name]` — approves held messages
- `reject [name]` — rejects held messages
- `show held` / `show review` — navigates to the review queue

### Test the Simulator

1. Start dev server
2. Navigate to the Test tab (flask icon)
3. Type test messages — see the AI classify them in real time
4. Toggle DND / Unhinged mode in Settings and re-test

---

## 🎨 Themes

Five color schemes, all with glassmorphism surfaces:

- **Aurora** (default) — deep indigo base + cyan/purple accents
- **Sunset** — dark warm purple base + orange/pink accents
- **Noir** — near-black base + slate accents
- **Daylight** — light grey/white base for daytime use
- **Terminal** — black base + green monospace type

Switch in Settings → Theme (or via the Palette icon in ChatList). Persists to localStorage.

---

## 🔐 Security & Privacy

- **Zero network calls during moderation** — all classification runs on-device.
- **No logging** — messages never leave your device.
- **Offline-first** — no internet required to moderate messages.
- **Optional cloud AI** — Claude API is opt-in (your own key, only for Commander + suggestions).

**Future (M3):** Real backend + E2E encryption (libsignal + Convex/Supabase).

---

## 📦 Milestones

- [x] **M0** — Scaffold: Vite + React + TS + PWA + Zustand + aurora UI
- [x] **M1** — UI: ChatList, Conversation, Settings, Simulator, 5 themes, seed data, call overlay
- [x] **M2** — Real AI moderation: Gemini Nano + RulesModerator + routeVerdict
- [x] **M2.5** — Extended features: tone analyzer, spell check, drunk detection, reply suggestions, disappearing messages, DND enforcement, unhinged mode, Commander AI assistant, Digest, 15-screen landing page
- [ ] **M3** — Backend: real message delivery + E2E encryption
- [ ] **M4** — Polish: push notifications, accessibility, React Native builds

---

## 📄 License

**Proprietary** — See LICENSE file.

Free to use, install, and share. You **cannot**:
- Fork or clone the source code
- Redistribute or rebrand as a different product
- Create competing products based on Strenes's design or logic

© 2026 Strenes. All rights reserved.

---

Made with ✨ by martian-coder
