# Perch — Claude Context

## What this is
Perch 🦉 is an AI guardian for kids' phones. One install on the kid's Android
phone; it scans incoming notifications from messaging apps (WhatsApp,
Instagram, Snapchat, Telegram, SMS…) **on-device** for grooming, predators,
scams, bullying and self-harm signals, and relays ONLY flag metadata (never
message content) to the paired parent's Perch, where an AI chat answers
questions like "anything to worry about this week?".

Sibling product to Strenes (same repo, same Supabase project, same
Martian Coders brand). Positioning: privacy-first alternative to cloud
scanners like Bark — detection without surveillance.

## Tech stack
- React 19 + Vite + TypeScript + Tailwind CSS v4, vite-plugin-pwa, Zustand v5
- Capacitor 8 Android app with a native `NotificationListenerService` (Java)
- Supabase (shared project with Strenes): `perch_*` tables + SECURITY DEFINER RPCs

## Architecture rules
1. **Detection is duplicated by design**: `src/detection/engine.ts` (web) and
   `android/…/Detection.java` (native, runs with webview closed) — **change
   one, mirror the other**. Tests live in `engine.test.ts`.
2. **Nothing but flag metadata ever crosses the wire**: category, severity,
   reason, app label, sender display name, timestamp. There is no
   message-content column in `perch_events` — don't add one.
3. **Capability security**: `perch_pairings.id` (UUID) is the read token;
   the 6-char code is one-shot and consumed by `perch_claim_pairing()`.
   No anon SELECT on tables — reads go through RPCs only.
4. AI chain (`src/ai/analyst.ts`): pasted key (Gemini/Claude, detected by
   shape) → managed proxy (20 free calls) → Gemini Nano on-device →
   deterministic analyst. Never throws; deterministic floor always answers.
5. Single theme (nightwatch); tokens are CSS vars in `src/index.css`.

## Key files
```
src/detection/engine.ts         — threat groups + normalize() + detectThreat()
src/ai/analyst.ts               — askPerch() + briefing() (digest text)
src/lib/relay.ts                — pairing + event sync (Supabase RPCs)
src/lib/native.ts               — PerchWatcher plugin JS bridge
src/store/index.ts              — Zustand store (role, pairing, events, chat)
src/screens/                    — Welcome, ParentHome, Chat, Shield, Settings, KidSetup, KidHome
android/…/NotificationWatcherService.java — the always-on scanner (kid phone)
android/…/ParentWatchService.java — instant alerts (parent phone): foreground
                                    service polls perch_fetch_events every 60s
                                    → high-priority notifications; BootReceiver
                                    re-arms after reboot; specialUse FGS type
android/…/Detection.java        — Java mirror of engine.ts
android/…/PerchWatcherPlugin.java — Capacitor plugin (setup + transparency +
                                    startParentWatch/stopParentWatch)
supabase/migrations/001_….sql   — run once in the shared Supabase project
```

## Roles / flows
- **parent**: create pairing → show code → poll claim → poll events (20s) →
  digest + alert feed + Ask Perch chat.
- **kid**: consent screens → claim code → grant notification access →
  transparency screen (sees the same flags the parent sees).
- **demo**: seeded week of events, full parent UI, runs anywhere (gh-pages).

## Deploys
- `/perch/` PWA + `/perch-home/` landing via `.github/workflows/pages.yml` (main only)
- APK via `.github/workflows/build-perch-apk.yml`: builds on main AND claude/**
  branches (compile check); releases `perch-android-latest` tag on main only —
  `make_latest: false` so Strenes' `releases/latest` links keep working.

## Running locally
```bash
npm run dev    # http://localhost:5173
npm test       # vitest — detection engine suite
npm run build  # tsc -b && vite build
```
