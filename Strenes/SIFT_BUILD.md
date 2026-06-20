# SIFT — Build Instructions for Claude Code

> **What this is:** the kickoff brief + living spec for building **Sift**, a private, AI-filtered messaging app. Read this top to bottom, then start at **Milestone 0**. Build one milestone at a time, run it, and tick the acceptance checks before moving on.

## How to use this file with Claude Code

1. Create an empty repo and drop in three files: this `SIFT_BUILD.md`, `SIFT_SPEC.md` (product spec), and `reference/sift-glass.jsx` (the working demo).
2. Start Claude Code in the repo and say: *"Read SIFT_BUILD.md and reference/sift-glass.jsx, then build Milestone 0."*
3. **`reference/sift-glass.jsx` is the source of truth** for UX, screen logic, the moderation rules, the data shapes, and the visual design tokens. Port from it; don't reinvent it.
4. Keep a short `CLAUDE.md` in the repo root (Milestone 0 creates it) so context persists across sessions.

---

## 1. Product in one paragraph

Sift is a WhatsApp-style messenger where the **recipient** controls an AI filter that screens every incoming message **on-device** before it reaches them. Abusive messages are held (blurred) or dropped; business messages and promos auto-sort into their own folders; spam/forwards are blocked. The sender sees an honest status ("Under review" / "Auto-rejected"). The filter runs **on the user's phone**, never on a server — which is the entire point: it's the only filtering model compatible with end-to-end encryption, and it's now free to run on both iOS and Android.

The differentiator is **on-device moderation**. Protect that property in every decision.

---

## 2. Tech stack (pin these; verify latest patch versions at build time)

- **App:** React Native + **Expo (SDK 54+)**, New Architecture enabled, **TypeScript**, **Expo Router** for navigation.
- **State:** Zustand. **Local DB:** `expo-sqlite` (or `op-sqlite`) for messages; **MMKV** for settings/flags.
- **Styling:** the demo uses a CSS-variable glass system; replicate it in RN with a small theme provider + `StyleSheet`/`expo-blur` (`BlurView`) for frosted surfaces and `react-native-reanimated` v3 for motion. (See §6.)
- **Backend / realtime:** **Convex** *or* **Supabase** (Postgres + realtime). The server is a **relay only** — it stores and forwards ciphertext and never sees plaintext.
- **E2E encryption:** **libsignal** (Signal protocol). Messages are encrypted client-side before they leave the device.
- **Auth:** phone-number OTP (provider's auth, or Clerk).
- **On-device AI (the star — see §5):** Apple **Foundation Models** (iOS 26+), **Gemini Nano** via **ML Kit GenAI Prompt API** (Android/AICore), **react-native-executorch** as the cross-platform fallback, plus a deterministic rules pre-filter.

Requires a **custom Expo dev client** (native modules; Expo Go won't work). Build release/test on **real devices** (on-device models don't run in the iOS simulator).

---

## 3. The keystone: the Moderator interface

All classification lives behind **one interface** so the engine is swappable. The demo's `moderate()` function is the v1 body of `RulesModerator`. Native on-device models implement the same interface later.

```ts
// src/moderation/types.ts
export type Category = "clean" | "abusive" | "spam" | "business" | "promo";

export interface ModerationVerdict {
  category: Category;
  confidence: number;        // 0..1
  flaggedTerms?: string[];
  reason?: string;           // short, human-readable
  engine: "rules" | "apple-fm" | "gemini-nano" | "executorch";
}

export interface Moderator {
  readonly name: ModerationVerdict["engine"];
  isAvailable(): Promise<boolean>;
  classify(text: string, opts: { sensitivity: "low" | "medium" | "high" }): Promise<ModerationVerdict>;
}
```

**Routing is separate from classification.** Port `routeVerdict(verdict, settings, trusted)` from the demo verbatim — it maps a verdict + the user's settings to `{ folder, status, autoReply?, ask? }`. Do not bake routing into the model.

**Engine selection (runtime):**
```
RulesModerator   → always runs first (instant, offline). Resolves obvious cases.
  ↓ if ambiguous / borderline confidence
Best native model available:
  iOS 26+        → AppleFMModerator
  Android+AICore → GeminiNanoModerator
  else           → ExecuTorchModerator (small local model)
  else           → RulesModerator verdict stands
```
A `getModerator()` factory probes `isAvailable()` and returns the best one. **No network calls in any path.**

---

## 4. Data model (align with the demo exactly)

```ts
type Folder = "primary" | "business" | "promotions" | "review";
type Status = "delivered" | "held" | "dropped" | "approved" | "rejected";
type BlockAction = "review" | "askPerMessage" | "silentDrop";

interface Contact { id: string; name: string; trusted: boolean; grad: string; }

interface Message {
  id: string; contactId: string; name: string;
  text: string;                 // plaintext only on-device; ciphertext on the wire
  dir: "in" | "out";
  ts: number; time: string;
  verdict?: ModerationVerdict;  // set for incoming
  folder: Folder; status: Status;
  autoReply?: boolean;
}

interface Settings {
  civility: { enabled: boolean; sensitivity: "low"|"medium"|"high"; onBlock: BlockAction; notifySender: boolean };
  business: { enabled: boolean };
  spam:     { enabled: boolean; onBlock: BlockAction };
  theme: "aurora" | "sunset" | "noir" | "daylight";
}
```

Folders, the held/dropped/approve/reject lifecycle, trusted-contact bypass, and the sender-facing status strings are all already implemented in the demo — copy that behavior.

---

## 5. On-device moderation — platform notes

**Shared classification prompt** (used by all model-backed engines). Force structured output:
```
System: You are a message-safety classifier running privately on the user's phone.
Classify the message into exactly one category: clean | abusive | spam | business | promo.
"abusive" = insults, harassment, threats, hateful or demeaning language.
Sensitivity is {sensitivity}: higher = flag milder language as abusive.
Return ONLY JSON: {"category": "...", "confidence": 0.0-1.0, "reason": "<=8 words"}.
User: <message text>
```

- **iOS — Apple Foundation Models (iOS 26+):** native Swift module exposing `classify`. Use **guided generation** (`@Generable` struct) so the ~3B on-device model returns the JSON shape directly — no parsing guesswork. Free, offline, no API key. Gate behind an availability + Apple-Intelligence-enabled check; fall back if unavailable.
- **Android — Gemini Nano via ML Kit GenAI Prompt API:** native Kotlin module on **AICore**. Runs fully on-device. Requires an AICore-capable device (flagship, 12 GB+); **must** degrade gracefully — call `isAvailable()` and fall back to ExecuTorch/rules on unsupported hardware. (Google's own on-device "Scam Detection" is the precedent for the spam path.)
- **Cross-platform fallback — react-native-executorch:** bundle/download a small model (Llama 3.2 1B / Qwen 3 / SmolLM2) via the Expo resource fetcher; `useLLM` / direct call for inference. Keeps the feature working on devices without native OS models.
- **Always-on rules pre-filter:** port the demo's wordlist + heuristic `moderate()` as `RulesModerator`. It guarantees instant, offline classification and handles the common cases so the LLM only runs on borderline input (saves battery).

**Hard rule:** message plaintext must never be sent off-device for moderation. If no on-device model is available, the rules engine is the answer — not a cloud call.

---

## 6. Design system (port these exact tokens from the demo)

The look is **animated aurora gradient behind frosted glass**, switchable themes, spring-physics motion. Pull values straight from `sift-glass.jsx`.

**Theme tokens** (CSS vars in the demo → put in a TS theme map):
- `aurora` — base `#0b1020`, accent `#7c83ff`, accent2 `#22d3ee`, text `#eef1ff`
- `sunset` — base `#1a0b14`, accent `#fb7185`, accent2 `#fb923c`
- `noir` — base `#08080d`, accent `#60a5fa`, accent2 `#818cf8`
- `daylight` (light) — base `#e9ecf9`, accent `#6366f1`, accent2 `#06b6d4`, text `#1c2030`
- Glass: surface `rgba(255,255,255,.07)`, strong `.13`, border `.14`; incoming bubble `rgba(255,255,255,.10)`. (Daylight inverts to light translucency + dark text.)

**Materials & motion:**
- Frosted surfaces: `expo-blur` `BlurView` (intensity ~18–28, saturation boost). Background: an animated multi-radial gradient (`expo-linear-gradient` layers or a Skia shader) drifting on a ~22s loop.
- Accent fills are `linear-gradient(135deg, accent, accent2)` with a soft accent-colored shadow/glow.
- Bubbles & cards: spring pop-in (`popIn`, ~0.36s, slight overshoot) via Reanimated. Screen change: fade+translateY. Send button & nav items scale on press. Respect `prefers-reduced-motion`.
- Radii: cards 18–22, pills/nav 24, full-round for avatars/inputs. Floating glass bottom nav with a gradient active pill.

**Category colors** (semantic, keep constant across themes): clean=emerald, abusive=rose, spam=amber, business=sky, promo=violet — each as a translucent tint + matching text + hairline border (values in demo).

**Signature element:** the **"Checking on your device…"** scan animation (pulsing lock + shimmer) that plays before a verdict appears, then the category badge springs in with an **"on-device"** chip and a filling confidence bar. This is the privacy story made visible — keep it.

---

## 7. App structure

```
sift/
  app/                      # expo-router
    (auth)/                 # phone OTP onboarding
    (tabs)/
      chats.tsx             # folder tabs + thread list / Review
      test.tsx              # filter simulator (keep for QA + demo)
      settings.tsx
    chat/[id].tsx           # conversation
  src/
    moderation/             # types.ts, rules.ts, appleFM.ts, geminiNano.ts, executorch.ts, factory.ts, route.ts
    crypto/                 # libsignal wrappers
    data/                   # sqlite store, models, sync
    net/                    # convex|supabase client (relay)
    state/                  # zustand stores
    ui/                     # theme.ts, Glass.tsx, Bubble.tsx, Switch.tsx, Segment.tsx, Badge.tsx, Avatar.tsx, BottomNav.tsx
    seed/                   # demo data for dev
  modules/                  # native: ios FoundationModels, android MlKitGenAI
  reference/sift-glass.jsx  # SOURCE OF TRUTH for UX + logic
```

---

## 8. Build milestones (do in order; meet acceptance before advancing)

**M0 — Scaffold.** Expo SDK 54 + TS + Router + New Arch, dev client, Zustand, theme provider, base UI atoms (Glass, Switch, Segment, Badge, Avatar), animated gradient background, floating glass nav. Add `CLAUDE.md`.
- ✅ App boots on a real iOS + Android device with the aurora background and working bottom-nav tabs.

**M1 — UI + local data (no network, no real AI).** Port the entire demo: folders, thread list, conversation, Review (blurred held messages + approve/reject), Settings (all toggles), the Test simulator, the four themes, all animations. Wire to the SQLite store seeded from `src/seed`. Use `RulesModerator` + `routeVerdict`.
- ✅ Visually and behaviorally matches `sift-glass.jsx` on device, including the scan→verdict animation, blur-reveal, and sender-status view. Reset works.

**M2 — Moderator abstraction + native engines.** Implement the `Moderator` interface and `getModerator()` factory. Build `AppleFMModerator` (iOS 26 guided generation) and `GeminiNanoModerator` (ML Kit Prompt API), each behind `isAvailable()`, with `ExecuTorchModerator` and `RulesModerator` fallbacks.
- ✅ On a supported device, incoming text is classified by the on-device model; on an unsupported device it silently falls back; **no network request is made** during classification (verify with a proxy).

**M3 — Accounts + E2E messaging.** Phone OTP onboarding; libsignal sessions; Convex/Supabase relay that stores/forwards ciphertext only. Two real devices can message each other; incoming messages run through the moderator on the **recipient's** device and route into folders.
- ✅ Device A messages Device B; the server payload is ciphertext; B's filter sorts/holds/blocks per B's settings; sender sees the correct status.

**M4 — Polish & ship.** Push notifications, empty/error/loading states (write them in the interface's voice), haptics on key actions, accessibility (focus, dynamic type, reduced motion), app icons/splash, EAS build config.
- ✅ Passes the acceptance suite in §9 on both platforms; TestFlight/Internal-testing build produced.

---

## 9. Definition of done (acceptance suite)

- Typing an abusive message routes it to **Review, blurred**, and the sender sees **"Under review"**; revealing un-blurs it.
- Switching civility `onBlock` to **Silent drop** makes the same message vanish; with **notify sender** on, the sender sees **"Auto-rejected"** stating the sensitivity level.
- Business and promo messages land in the correct folders; a **trusted** contact's flagged message reaches **Primary**.
- All four themes apply instantly and look correct (incl. light **Daylight**); reduced-motion is honored.
- Classification runs **on-device** with **zero network calls**; unsupported devices fall back without error.
- Real E2E message between two devices works; server stores only ciphertext.

---

## 10. Scope guards (do NOT do these)

- ❌ No server-side moderation or any cloud call that sees message plaintext. Ever.
- ❌ No giant bundled models — lean on the free OS models + a small fallback.
- ❌ Don't fork classification logic across screens — everything goes through `Moderator` + `routeVerdict`.
- ❌ Don't drop the Test simulator; it's the fastest way to QA and demo the filter.
- ❌ Don't restyle ad hoc — derive every color/radius/motion value from the theme tokens in §6.

## 11. First commands

```bash
npx create-expo-app@latest sift -t expo-template-blank-typescript
cd sift && npx expo install expo-router expo-blur expo-linear-gradient react-native-reanimated
npm i zustand react-native-mmkv
npx expo install expo-sqlite
# dev client (needed for native AI modules):
npx expo install expo-dev-client && npx expo run:ios   # and run:android
```
Then build **M0**.
