# Strenes — Claude Context

## What this is
Strenes is a WhatsApp-style messaging PWA where the **recipient** controls an AI filter that screens every incoming message on-device before it reaches them.

## Tech stack
- **React 19 + Vite + TypeScript + Tailwind CSS v4**
- **Zustand v5** for state (persisted to localStorage via `zustand/middleware/persist`)
- **vite-plugin-pwa** for PWA / service worker / manifest

## Source of truth
- `SIFT_SPEC.md` — product spec (scope, UX, data model)
- `SIFT_BUILD.md` — full build roadmap (milestones, design tokens, native AI path)
- `reference/sift-glass.jsx` — original working demo (port UX + logic from this, don't reinvent)

## Architecture rules
1. **All classification goes through `getModerator().classify(text, { sensitivity })`** (`src/moderation/index.ts`) — the swappable `Moderator` engine. Never fork classification logic across screens.
2. **All routing goes through `src/moderation/route.ts` → `routeVerdict(verdict, settings, trusted)`** — never bake routing into UI components.
3. **No network calls during moderation.** Everything runs offline.
4. **Theme tokens** live in `src/theme/index.ts` and are applied as CSS custom properties via `applyTheme()`. Never hardcode colors in components — always use `var(--accent)`, `var(--text)`, etc.

## Key files
```
src/types/index.ts         — all shared TypeScript types
src/theme/index.ts         — THEMES map + CATEGORY_COLORS + applyTheme()
src/store/index.ts         — Zustand store + selectors
src/moderation/types.ts    — Moderator interface + Sensitivity
src/moderation/rules.ts    — classifyByRules() + RulesModerator (always-on fallback)
src/moderation/gemini-nano.ts — GeminiNanoModerator: Chrome Prompt API, on-device, zero network
src/moderation/index.ts    — getModerator() engine-selection factory + ENGINE_LABELS
src/moderation/route.ts    — routeVerdict(verdict, settings, trusted)
src/seed/index.ts          — seed contacts + messages + default settings
src/components/ui/         — Glass, Badge, Avatar, BottomNav, Switch, Segment, AuroraBackground
src/screens/               — ChatList, Conversation, Settings, Simulator
src/App.tsx                — root: phone frame + screen router + pendingAsk modal
src/index.css              — Tailwind import + CSS var defaults + keyframe animations
```

## Milestone status
- [x] **M0** — Scaffold: Vite + React + TS + Tailwind v4 + PWA + Zustand + theme + base UI atoms + aurora background + bottom nav
- [x] **M1** — UI + local data: all 4 screens, folder tabs, conversation, Review (blur/approve/reject), Settings, Simulator, all 4 themes, animations, seed data
- [x] **M2** — Real AI moderation: `Moderator` interface + `getModerator()` factory; `GeminiNanoModerator` (Chrome built-in Prompt API → Gemini Nano, fully on-device, zero network) with `RulesModerator` silent fallback. Rules pre-filter resolves obvious cases; borderline input escalates to the model. Classification flows through `getModerator().classify()`; routing stays in `routeVerdict()`.
- [ ] **M3** — Future: real backend + E2E encryption (libsignal + Convex/Supabase)
- [ ] **M4** — Future: push notifications, accessibility polish, EAS build

## Design tokens (aurora theme defaults)
- base: `#0b1020`, accent: `#7c83ff`, accent2: `#22d3ee`, text: `#eef1ff`
- Glass surface: `rgba(255,255,255,0.07)`, border: `rgba(255,255,255,0.14)`
- Category colors: clean=emerald, abusive=rose, spam=amber, business=sky, promo=violet

## Running locally
```bash
npm run dev   # http://localhost:5173
npm run build # production build
```

## Future path (do NOT build yet)
- Swap `moderate()` to call on-device AI (Apple Foundation Models iOS 26+, Gemini Nano, ExecuTorch fallback)
- Real backend + real-time delivery (Convex or Supabase relay)
- E2E encryption (libsignal / Signal protocol)
- Package as React Native + Expo for true iOS/Android app
