# Sift — AI Message Filter PWA

> Every message that reaches you should spark joy. Filter out the noise, abuse, and spam — on-device, offline, and under your control.

A WhatsApp-style PWA where **you** control an on-device AI filter that screens every incoming message before it reaches you. Built with React 19, Vite, and Chrome's built-in Gemini Nano LLM.

---

## ✨ Features

- **On-device AI** — Powered by Gemini Nano (Chrome built-in Prompt API). Message plaintext never leaves your device.
- **Offline-first** — Works completely offline. No network calls during moderation.
- **Smart folders** — Primary, Business, Promos, Review. Route messages based on content + civility.
- **Blur-to-reveal** — Borderline messages are blurred by default. Tap to read.
- **Installable PWA** — Add to home screen. Works native on iOS, Android, and desktop.
- **Rules fallback** — If Gemini Nano unavailable, rules engine kicks in instantly.
- **Proprietary** — Licensed software. Free to use, install, and share, but not to fork or rebrand.

---

## 🎯 Why Sift?

| Feature | Sift | WhatsApp | iMessage | Telegram | Signal |
|---------|------|----------|----------|----------|--------|
| AI message filtering | ✓ | ✗ | ✗ | ✗ | ✗ |
| On-device AI | ✓ | ✗ | ✗ | ✗ | ✗ |
| Civility filter | ✓ | ✗ | ✗ | ✗ | ✗ |
| Smart folders | ✓ | ✓ | ✗ | ✓ | ✗ |
| E2E encryption | Future | ✓ | ✓ | ✓ | ✓ |
| Works offline | ✓ | ✓ | ✓ | ✓ | ✓ |
| Blur moderation UI | ✓ | ✗ | ✗ | ✗ | ✗ |
| Mood-based routing | ✓ | ✗ | ✗ | ✗ | ✗ |

---

## 🚀 Try It Now

**Live demo:** https://martian-coder.github.io/TinyTools/sift-home/

**Install PWA:** https://martian-coder.github.io/TinyTools/sift/

Add to home screen or bookmark to install. Works on Chrome, Edge, Samsung Internet, and Safari (iOS 16.4+).

---

## 📋 Architecture

### Moderation Pipeline

All classification flows through a swappable `Moderator` interface:

1. **Rules Pre-filter** (`RulesModerator`) — Instant wordlist-based classification. Catches obvious spam/abuse.
2. **Escalation** — Borderline input passes to the AI model.
3. **Model** (`GeminiNanoModerator`) — Chrome's Prompt API (Gemini Nano, fully on-device).
4. **Routing** (`routeVerdict()`) — Maps verdict to folder + styling (clean, business, promo, abusive, spam).

**Key constraint:** Message plaintext never leaves the device. If a backend call is needed, the app fails open (won't ship until real E2E encryption handles it).

### Tech Stack

- **React 19 + Vite** — Fast SPA, instant HMR
- **TypeScript** — Type-safe moderation, routing, store
- **Tailwind CSS v4** — Aurora glassmorphism design
- **Zustand v5** — Lightweight state (persists to localStorage)
- **vite-plugin-pwa** — PWA manifest, service worker, offline support

### Folder Structure

```
src/
├── moderation/           # Swappable Moderator engine
│   ├── types.ts          # Moderator interface, Sensitivity
│   ├── rules.ts          # RulesModerator (wordlist-based)
│   ├── gemini-nano.ts    # GeminiNanoModerator (Chrome Prompt API)
│   ├── index.ts          # getModerator() factory chain
│   └── route.ts          # routeVerdict(verdict, settings)
├── screens/              # 4 main screens
│   ├── ChatList.tsx      # Folder tabs + conversations
│   ├── Conversation.tsx  # Single thread + review actions
│   ├── Settings.tsx      # Theme, sensitivity, export
│   └── Simulator.tsx     # Test moderation engine
├── store/                # Zustand state
├── theme/                # Design tokens (4 themes)
├── types/                # Shared TypeScript types
├── components/ui/        # Glass, Badge, Avatar, BottomNav, etc.
├── seed/                 # Demo contacts + messages
└── App.tsx               # Root: phone frame + router
```

---

## 🛠️ Development

### Local Setup

```bash
cd Sift
npm install
npm run dev
# Opens http://localhost:5173
```

### Build for Production

```bash
npm run build
# Output: dist/
```

### Test the Simulator

1. Start dev server
2. Navigate to Settings → Simulator tab
3. Type test messages — see how the AI classifies them
4. Adjust sensitivity slider in real-time

---

## 🎨 Themes

Four color schemes, all with glassmorphism surfaces:

- **Aurora** (default) — Deep indigo base + cyan/purple accents
- **Deep Space** — Black base + blue accents
- **Forest** — Dark green base + emerald accents
- **Sunset** — Dark purple base + orange accents

Change theme in Settings. Persists to localStorage.

---

## 🔐 Security & Privacy

- **Zero network calls** — All moderation happens on-device.
- **No logging** — Messages never leave your device or are logged anywhere.
- **Offline-first** — No internet required to use the app.
- **Proprietary license** — Prevents copying or forking (see LICENSE).

**Future (M3):** Real backend + E2E encryption (libsignal + Convex/Supabase). Until then, this is a prototype.

---

## 📦 Milestones

- [x] **M0** — Scaffold: Vite + React + TS + PWA + Zustand + aurora UI
- [x] **M1** — UI: all 4 screens, themes, animations, seed data
- [x] **M2** — Real AI: Moderator interface + Gemini Nano + RulesModerator fallback
- [ ] **M3** — Backend: real message delivery + E2E encryption
- [ ] **M4** — Polish: push notifications, accessibility, native builds (React Native + Expo)

---

## 📄 License

**Proprietary** — See LICENSE file.

Free to use, install, and share. You **cannot**:
- Fork or clone the source code
- Redistribute or rebrand as a different product
- Create competing products based on Sift's design/logic

© 2026 Sift. All rights reserved.

---

## 🔗 Related Files

- `CLAUDE.md` — Development context & architecture notes
- `SIFT_SPEC.md` — Product specification
- `SIFT_BUILD.md` — Full build roadmap & design tokens

---

Made with ✨ by martian-coder
