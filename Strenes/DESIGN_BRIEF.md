# Strenes — Design Brief for Claude

> Paste this entire file into any Claude session before asking for UI work.
> Goal: produce a messaging app that makes WhatsApp look ten years old.

---

## 1. What We Are Building

**Strenes** is a messaging PWA where the *recipient* controls an on-device AI that screens every incoming message before it reaches them. No cloud. No servers. No compromise.

The design must communicate three things at a glance:
1. **Intelligence** — AI is working for you, silently, in the background
2. **Control** — you set the rules; the app enforces them
3. **Privacy** — everything happens on your device, nothing leaves

The emotional target: the feeling you get opening Linear, Raycast, or Arc for the first time. "This was clearly made by people who care." That feeling — but for a messaging app.

---

## 2. Design Philosophy

### Calm Clarity
Every screen has one primary action. Supporting information recedes. Nothing fights for attention. Inspired by Calm app's spatial hierarchy + Linear's information density.

### AI as Infrastructure, Not Feature
The AI is not a chatbot you talk to. It is a silent guard. It should feel like:
- A security system that's always on
- A post office that sorts your mail before you open it
- A bouncer at the door — invisible until it acts

Never show loading spinners for AI. Use subtle state changes instead: a message that was held simply *appears* in Review, already blurred.

### Motion with Purpose
Every animation communicates state change. Spring physics, not ease-in-out. Micro-interactions on every interactive element. But never gratuitous — if removing the animation loses no information, cut it.

### Research-Backed Language
Every label, every tooltip, every empty state should feel like it came from a product team that read the papers. Use precise technical vocabulary alongside human language:
- Not "filter" → "civility gate"
- Not "AI check" → "on-device classification"
- Not "settings" → "your rules"
- Not "blocked" → "held for review"
- Not "spam folder" → "noise sorted by model"

---

## 3. Design System

### Color Tokens

```
/* LIGHT MODE — Daylight theme (default) */
--base:     #f8f9fc       /* page background */
--surface:  #ffffff       /* card / panel surface */
--surface2: #f0f2f7       /* nested surface */
--border:   rgba(0,0,0,0.08)
--accent:   #5b5fcb       /* primary action — indigo */
--accent2:  #0ea5c9       /* secondary — cyan */
--text:     #0d0f1a       /* primary text */
--sub:      #4b5068       /* secondary text */
--dim:      #8892a8       /* tertiary / hint */

/* DARK MODE — Aurora theme */
--base:     #0b1020
--surface:  rgba(255,255,255,0.04)
--surface2: rgba(255,255,255,0.07)
--border:   rgba(255,255,255,0.09)
--accent:   #7c83ff
--accent2:  #22d3ee
--text:     #eef1ff
--sub:      #8892b0
--dim:      rgba(238,241,255,0.35)

/* CATEGORY COLORS — same across themes */
--c-clean:    #10b981   /* emerald */
--c-abusive:  #f43f5e   /* rose */
--c-spam:     #f59e0b   /* amber */
--c-business: #22d3ee   /* cyan */
--c-promo:    #a78bfa   /* violet */
--c-held:     #f59e0b   /* amber, same as spam */
```

### Typography

```
Font stack:  -apple-system, 'Inter Variable', 'Geist', system-ui, sans-serif
Mono stack:  'Geist Mono', 'JetBrains Mono', 'Fira Code', monospace

Scale:
  --t-xs:   11px / 1.4   weight 500   letter-spacing +0.2px
  --t-sm:   13px / 1.5   weight 450
  --t-base: 15px / 1.65  weight 400
  --t-md:   17px / 1.55  weight 500
  --t-lg:   20px / 1.3   weight 700   letter-spacing -0.3px
  --t-xl:   28px / 1.1   weight 800   letter-spacing -0.8px
  --t-hero: 48px / 1.0   weight 900   letter-spacing -2px
```

### Spacing (8px base grid)

```
4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80 / 96
```

### Border Radius

```
--r-xs:   6px   (chips, tags)
--r-sm:   10px  (inputs, small cards)
--r-md:   14px  (message bubbles, cards)
--r-lg:   20px  (panels, modals)
--r-xl:   28px  (phone frame, bottom sheets)
--r-pill: 999px (badges, toggles)
```

### Shadow System

```
--shadow-sm:  0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)
--shadow-md:  0 4px 16px -2px rgba(0,0,0,0.10)
--shadow-lg:  0 12px 40px -8px rgba(0,0,0,0.18)
--shadow-acc: 0 6px 24px -6px rgba(91,95,203,0.45)   /* accent glow */
--shadow-inset: inset 0 1px 0 rgba(255,255,255,0.08)
```

### Glass Surface (dark mode only)

```css
.glass {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.10);
  backdrop-filter: blur(20px) saturate(160%);
}
.glass-2 {
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.14);
}
```

---

## 4. Logo

### Concept
The Strenes mark is a **shield with a neural wave through it**. The shield = protection. The wave = AI signal processing. Together: an intelligent guardian.

### Construction
- Outer shape: rounded shield (like iOS security icons)
- Inner element: a single sinusoidal wave line that passes through the center, with 3 nodes (dots) on it representing classification points
- The wave is thinner than the shield outline
- No fill — just strokes on transparent

### Wordmark
- "Strenes" in Inter Black, letter-spacing -1.5px
- The "e" at position 4 has a subtle accent-color underline OR the dot above a letter (like the neural node) is colored
- Alternatively: "S" ligature that incorporates the wave

### Color Variations
- Default: accent gradient left-to-right (`#5b5fcb → #0ea5c9`)
- Monochrome: `currentColor` for dark-on-light
- Inverted: white on dark backgrounds
- Icon-only (app icon): shield mark on gradient background, white stroke

### Don'ts
- Never use drop shadow on the logo
- Never stretch the aspect ratio
- Minimum size: 24px height for the mark, 80px for wordmark

---

## 5. Component Library

### Message Bubble

```
INCOMING (left-aligned):
  bg: var(--surface)
  border: 1px solid var(--border)
  border-radius: 4px 16px 16px 16px  ← sharp top-left = "coming from them"
  padding: 10px 14px
  max-width: 78%
  
OUTGOING (right-aligned):
  bg: linear-gradient(135deg, var(--accent), var(--accent) 60%, var(--accent2))
  border-radius: 16px 4px 16px 16px  ← sharp top-right = "going from you"
  padding: 10px 14px
  box-shadow: var(--shadow-acc)
  
HELD / BLURRED:
  Same as incoming but filter: blur(3px)
  After: overlay with amber tag "held · tap to reveal"
  Tap → spring-scale to 1, blur fades out in 200ms
  
CATEGORY TAG (below bubble):
  font-size: 10px, weight: 700, uppercase, letter-spacing: 1.5px
  color: var(--c-{category})
  display: flex; align-items: center; gap: 4px
  Include the engine: "Gemini Nano · 97% clean" or "Rules engine · spam"
```

### Action Chips

```
Base:   border: 1px solid var(--border), bg: var(--surface), color: var(--sub)
Active: bg: var(--accent), color: #fff, border: transparent, shadow: var(--shadow-acc)
Hover:  border-color: var(--accent), color: var(--text)
Size:   padding: 5px 14px, border-radius: var(--r-pill), font-size: 12px, weight: 700
```

### Toggle Switch

```
Track off:  bg: var(--border), width: 44px, height: 26px, radius: 99px
Track on:   bg: linear-gradient(135deg, var(--accent), var(--accent2))
Knob:       white circle, 20px, shadow, translates 18px on-state
Transition: spring(stiffness: 400, damping: 28) — feels physical
```

### AI Status Pill

```
Shape:   pill badge, height: 22px
Content: colored dot (pulse animation) + text
States:
  "Gemini Nano · on-device"  → accent dot
  "Rules engine · fallback"  → amber dot
  "Classifying…"             → spinning dot
  "Offline · queued"         → dim dot
```

### Category Badge

```
Background: 10% opacity of category color
Border:     20% opacity of category color
Text:       category color, 11px, 700, uppercase
Icon:       16px lucide icon matching category

clean:    ✓ Shield icon, emerald
abusive:  ⚑ Flag icon, rose
spam:     ⊗ Circle-slash, amber
business: ◈ Briefcase, cyan
promo:    ★ Star, violet
held:     ⏸ Pause, amber
```

### Sensitivity Slider (3-position)

```
Not a standard HTML range. Three labeled segments:
  [  Low  ] [  Medium  ] [  High  ]
Active segment fills with accent gradient.
Tap to select, slides with spring physics.
Label below: explains what this sensitivity level actually does in plain English.
```

---

## 6. Screen Designs

### Commander (home screen)

**Purpose:** Chat with your inbox. The AI briefs you on what arrived while you were gone.

**Layout:**
```
Header bar (52px):
  Left: Shield logo mark (24px) + "Commander" wordmark
  Right: Avatar (your profile), notification count badge

Briefing area (flex, fills space):
  AI bubbles stream in from the left, one per sender group
  Each bubble: sender name bold + message preview + category badge
  Action chips appear below each group: "Open ›", "Reply…", "Dismiss"
  
  Example bubble copy:
    "Maya sent 2 messages — clean ✓
     'Are we still on for Saturday?'"
    [Open Maya ›]  [Dismiss]
    
  Held message bubble:
    "1 message held from +1 (555) 0142 — abusive (94% confidence)
     [View in Review ›]  [Drop]"

Input bar (54px):
  Pill input: "Ask anything… 'reply Maya yes', 'show held', 'mute Sam'"
  Send button: accent gradient circle

Bottom nav: Commander (active) | Chats | Test | Settings
```

**Micro-interactions:**
- Briefing bubbles enter with staggered slide-up + fade (60ms each)
- Chips appear 120ms after their bubble
- Send triggers a brief "thinking" state (three dots) before AI responds

### Conversation Screen

**Purpose:** One-on-one chat with real-time AI guard visible but unobtrusive.

**Layout:**
```
Header (52px):
  Back arrow | Avatar + online indicator | Name + AI status pill | Call icon

Civility indicator (subtle, below header):
  Thin 2px progress-style bar in accent color when guard is active
  Or: small pill "🔒 High civility · on"

Message list (fills space):
  Bubbles as specified above
  Timestamps: only when gap > 2 minutes, centered dim text
  Category tags: only on non-clean messages

Input bar:
  Left: attachment icon
  Center: pill input with placeholder "Message…" or "[guard active]"
  Right: tone indicator dot (green=calm / amber=assertive / red=aggressive)
         then send button
  
  When tone analyzer fires:
    Pill border turns amber
    Small card slides up ABOVE input bar:
      "🧠 Assertive tone · 78% — might read as aggressive"
      [Rephrase ›] [Send anyway]
```

**Held message card:**
```
Appears inline in message list where the message would be
bg: amber/10, border: amber/20, border-left: 3px amber
Blurred preview text (blur: 4px)
Below: "⏸ Held · tap to reveal · abusive · 94%"
         [Approve] [Reject]
```

### Review Queue

**Purpose:** Decide on borderline messages without anxiety.

**Layout:**
```
No list. One card at a time, full-width, centered.
  
Card:
  Sender info (avatar + name + when)
  Blurred message text (4px)
  Category badge + confidence score
  "Reveal" toggle — tap once to un-blur and read
  
  Two big buttons below:
    [✓ Approve — let it through]  [✗ Reject — discard]
  
  Progress: "2 remaining" pill at top

Empty state:
  Large icon (shield with checkmark)
  "Inbox is clean."
  Sub: "Strenes held 0 messages today."
```

### Settings

**Purpose:** Your rules. Every control is a statement about what you want.

**Layout:**
```
Not a list of toggles. Organized as named cards.

Card structure:
  Title row: icon + name + toggle (if binary)
  When expanded or always-expanded:
    Sub-controls with real English labels
    Not: "Sensitivity: Low/Medium/High"
    Yes: "Screen messages that are [mildly assertive / clearly aggressive / anything flagged]"

Section order:
  1. Your Guard (Civility filter, AI engine status)
  2. Your Silence (Do Not Disturb, quiet hours)
  3. Your Voice (Tone analyzer, spell-check)
  4. Safe Mode (Drunk mode, disappearing messages)
  5. Trusted People (contact list)
  6. Danger Zone (Unhinged mode — visually separated, red tint)
  
AI Engine card (always visible at top of section 1):
  Shows: primary engine + fallback + latency
  "Gemini Nano · on-device · avg 48ms"
  "Fallback: Rules engine · instant"
  "0 messages sent to cloud — ever"
```

### Simulator / Test Lab

**Purpose:** Prove to a friend that the AI works in real time.

**Layout:**
```
Two-panel feel (stacked on mobile):
  Top: input area "Type any message…" with big send button
  Bottom: live result card
    
Result card:
  Category badge (large, centered)
  Confidence bar (full width, category color)
  "Engine: Gemini Nano · 47ms"
  Flagged terms highlighted inline
  Routing: "Would land in: Review queue · blurred"
  
Preset examples row:
  Chips you can tap to auto-fill
  "Hey friend 👋"  "You're an idiot"  "Your OTP: 847291"  "50% OFF NOW!"
```

---

## 7. Animation System

### Principles
- Use spring physics everywhere (stiffness 280–420, damping 24–32)
- Duration hints: 120ms micro / 220ms transition / 380ms entrance / 500ms exit
- Never block interaction during animation
- Reduce motion: wrap all non-essential animations in `@media (prefers-reduced-motion: no-preference)`

### Core Animations

```css
/* Entrance — slide up + fade */
@keyframes enter {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Pop — scale from 0.94 */
@keyframes pop {
  from { opacity: 0; transform: scale(0.94); }
  to   { opacity: 1; transform: scale(1); }
}

/* Held reveal — blur dissolve */
transition: filter 280ms cubic-bezier(0.34, 1.56, 0.64, 1);

/* Message send — bubble slides in from right edge */
@keyframes send {
  from { opacity: 0; transform: translateX(24px) scale(0.95); }
  to   { opacity: 1; transform: translateX(0) scale(1); }
}

/* Category badge — stamp effect */
@keyframes stamp {
  0%   { opacity: 0; transform: scale(1.3); }
  60%  { transform: scale(0.96); }
  100% { opacity: 1; transform: scale(1); }
}

/* Typing indicator — three dots with stagger */
@keyframes blink {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
  40%            { transform: scale(1.0); opacity: 1; }
}
```

### Screen Transitions
- Navigate forward: new screen slides in from right (translateX: 40px → 0)
- Navigate back: old screen slides out to right (translateX: 0 → 40px)
- Modal/sheet: slides up from bottom (translateY: 100% → 0)
- All transitions: 280ms, cubic-bezier(0.25, 0.46, 0.45, 0.94)

---

## 8. Logo Mark — SVG Specification

```svg
<!-- Strenes shield mark — 32×36px viewBox -->
<svg viewBox="0 0 32 36" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Shield outline -->
  <path d="M16 2L3 7.5V18C3 25.5 9 32 16 34C23 32 29 25.5 29 18V7.5L16 2Z"
        stroke="url(#grad)" stroke-width="2" stroke-linejoin="round" fill="none"/>
  <!-- Neural wave — passes through center horizontally -->
  <path d="M7 18 C9 18 10 14 12 14 C14 14 14 22 16 22 C18 22 18 14 20 14 C22 14 23 18 25 18"
        stroke="url(#grad)" stroke-width="2" stroke-linecap="round" fill="none"/>
  <!-- Node dots on the wave at key points -->
  <circle cx="12" cy="14" r="1.5" fill="url(#grad)"/>
  <circle cx="16" cy="22" r="1.5" fill="url(#grad)"/>
  <circle cx="20" cy="14" r="1.5" fill="url(#grad)"/>
  <defs>
    <linearGradient id="grad" x1="3" y1="2" x2="29" y2="34" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#5b5fcb"/>
      <stop offset="100%" stop-color="#0ea5c9"/>
    </linearGradient>
  </defs>
</svg>
```

---

## 9. Copy Voice & Labels

### Tone
- Smart but not smug
- Precise but not clinical
- Empowering, never paternalistic
- Research-informed, not jargon-heavy

### Label Dictionary

| Old label | Strenes label |
|---|---|
| Filter messages | Civility gate |
| AI check | On-device classification |
| Settings | Your rules |
| Blocked | Held for review |
| Spam folder | Noise, sorted by model |
| Sensitivity | Screening threshold |
| Enable | Turn on your guard |
| Low sensitivity | Screen only obvious abuse |
| High sensitivity | Screen anything flagged |
| Block | Drop from inbox |
| Review | You decide |
| Trusted | Always through |
| Business | Auto-sorted, model-verified |
| AI engine | Gemini Nano · on-device |
| Fallback | Rules engine · instant |

### Research References (use in tooltips, empty states, onboarding)

| Where | Text |
|---|---|
| AI engine status | "Powered by Gemini Nano via Chrome's Prompt API (Google I/O 2024) — zero network calls" |
| Civility filter | "Transformer-based classifier, >90% F1 on harassment detection (ACL 2023)" |
| Federated / privacy | "Federated learning architecture — McMahan et al., Google Research 2017" |
| Business sorting | "Intent classification adapted from NLP research — your OTPs and receipts, automatically" |
| Roadmap E2E | "Coming: Double Ratchet E2EE (Signal Protocol) — the same algorithm as WhatsApp" |
| On first load | "Everything you see happened on your device. Strenes made 0 network calls to classify your messages." |

### Empty States (must not feel sad)

```
Review queue empty:
  Icon: shield with checkmark
  Title: "Inbox is clean."
  Sub: "Gemini Nano screened X messages today. Zero held."

No messages yet:
  Icon: wave/signal icon
  Title: "Guard is active."
  Sub: "Messages from unknown senders will be classified before they reach you."

Simulator no result:
  Icon: flask
  Title: "Type anything."
  Sub: "The model will classify it in under 50ms — on your device."
```

---

## 10. Onboarding Flow (3 screens, skip-able)

### Screen 1 — The Guard
```
Large illustration: shield with wave, animated (wave oscillates)
Title: "Your inbox, finally working for you."
Body: "Strenes screens every message with AI before it reaches you.
       Nothing goes to a server. Not even to us."
CTA: "Set up my guard →"
```

### Screen 2 — Your Rules
```
Illustration: slider / sensitivity control with animated selection
Title: "You decide what gets through."
Body: "Set your civility threshold. Mark people you always trust.
       Define quiet hours. The AI enforces your rules — not ours."
CTA: "Looks good →"
```

### Screen 3 — The Research
```
Illustration: academic paper icon + neural network nodes
Title: "Built on a decade of AI research."
Body: "Gemini Nano (Google I/O 2024). Transformer NLP (ACL).
       Federated learning (McMahan et al. 2017).
       All running on your device, right now."
CTA: "Open Strenes"
Small link: "Read the research ↗"
```

---

## 11. Implementation Notes for Claude

When building any screen in this app:

1. **Always use CSS custom properties** from the design system above — never hardcode colors
2. **All AI-triggered UI** should animate in using the `enter` keyframe — never just appear
3. **Category colors** use the `--c-{category}` tokens — consistent across every screen
4. **Research copy** belongs in `title` attributes and aria-labels too — not just visible text
5. **Held messages** are always blurred and tagged — never just hidden
6. **The AI engine attribution** ("Gemini Nano · 47ms" or "Rules engine · fallback") appears wherever a classification result is shown — this is non-negotiable, it's the product's credibility
7. **Mobile-first** — the primary surface is 390px wide (iPhone 14 Pro). Design there first.
8. **Reduce motion** — wrap entrance animations: `@media (prefers-reduced-motion: no-preference) { ... }`
9. **Every interactive element** has a hover state, active state (scale: 0.97), and focus ring (2px accent, 2px offset)
10. **Bottom nav** is 58px tall with safe-area-inset-bottom padding for notched phones

---

## 12. Competitive Reference (what to beat)

| App | What it does well | What Strenes beats it on |
|---|---|---|
| WhatsApp | Ubiquity, reliability | AI guard, privacy, modern design, no ads |
| iMessage | iOS polish, Tapback | Cross-platform, AI classification, open |
| Telegram | Speed, features | Privacy (no server), AI moderation, simplicity |
| Signal | E2EE, trust | Commander, UI quality, ease of use, features |
| Linear | Design quality | N/A — match this energy for a messaging app |

**The one-sentence brief:** Build a messaging app with Linear's design craft, Signal's privacy ethos, and Gmail's smart inbox — running entirely on your device.

---

*This brief is the source of truth. When in doubt: make it simpler, make it faster, make it feel like the future.*
