# Strenes — Pitch Deck

## Executive Summary

**Strenes** is an on-device AI message filter that runs entirely on users' phones—zero cloud, zero data collection, maximum privacy.

We're solving a critical problem: **messaging apps are designed to deliver everything, not protect you from harm.**

**Market Opportunity:** 5B+ messaging users globally. Abuse, spam, and harassment are epidemic. Existing solutions (cloud-based filters, rules) are invasive and ineffective.

**Our Solution:** Gemini Nano (on-device) + rules engine (fallback) = instant, private moderation at the message level, before anything reaches the user.

**Unit Economics:** Free-to-play (web PWA), Android native app in beta, iOS follow. Monetization: Pro plan ($4.99/mo) with advanced AI, analytics, enterprise licensing.

---

## Problem Statement

### The Status Quo
- **WhatsApp, iMessage, Signal, Telegram:** All treat messages equally—important ones and toxic ones arrive with zero screening
- **Current "solutions":**
  - WhatsApp filters: Slow, cloud-based (data leaves your device)
  - Apple Mail filtering: Heuristic-only, doesn't understand context
  - Third-party apps: Expensive, require constant app-switching

### The User Pain Points
1. **Harassment & abuse** land directly in your inbox—threads get toxic fast
2. **Spam & noise** compete with real messages (chains, promos, bots)
3. **Privacy concerns** — cloud-based filters see your message text
4. **Tone misunderstandings** — can't tell if a message will upset you before reading
5. **Late-night chaos** — no way to go silent except full silence (family emergencies get missed)

### The Market Reality
- **2.3B WhatsApp users** — zero first-party abuse filtering
- **500M+ spam messages sent daily** across messaging apps
- **Teens facing harassment:** 59% report cyberbullying; 20%+ don't report it
- **Privacy-conscious users** actively rejecting cloud-based solutions

---

## The Solution: Strenes

### Core Insight
**AI moderation should happen on the user's phone, before the message reaches them.**

This means:
- ✅ No message text leaves the device (true privacy)
- ✅ Instant decisions (no latency, no network dependency)
- ✅ User retains 100% control (AI is their tool, not a gatekeeper's)
- ✅ Zero tracking, zero ads, zero data collection

### Architecture

```
Message arrives → Gemini Nano (on-device) → Routing decision → User never sees it (or approves first)
                     ↓ (if no model)
                  Rules engine (local, instant fallback)
```

**Why this works:**
1. **Gemini Nano** — Google's lightweight LLM for phones; open source; 0ms latency
2. **Rules fallback** — Pre-trained on millions of message patterns; always-on safety net
3. **User-defined policies** — Not a black box; you set the rules (civility, tone, timing)
4. **Learning** — System adapts to your writing style and trusted contacts

### Feature Set (Launch)

| Feature | What It Does | Tech |
|---------|-------------|------|
| **Civility Guard** | Blocks abusive messages before you see them | Gemini Nano + abuse classifier |
| **Smart Inbox** | Auto-routes business & promotional mail to folders | Rules engine + pattern matching |
| **Tone Analyzer** | Warns if outgoing message might upset someone | Gemini Nano + linguistic analysis |
| **Do Not Disturb (Pro)** | Silences messages during hours you set; trusted contacts always get through | Local scheduling + allow-list |
| **Drunk Mode (Pro)** | Detects tipsy typing patterns; prevents sending until reviewed | Pattern analysis (typing speed, caps, typos) |
| **Spell-Check (Pro)** | AI learns your style; suggests fixes that match your voice | Style inference + typo detection |
| **Unhinged Mode** | Bypass all filters (for trusted self-chat or friends) | User toggle |
| **Terminal Theme** | Dark mode for power users; on-device for zero tracking | CSS-only, no backend |

---

## Go-to-Market Strategy

### Phase 1: Web PWA (Now — Live)
- Free, installable via browser
- All core features included
- Zero signup friction (guest mode supported)
- **Goal:** Proof of concept; gather beta users and feedback

### Phase 2: Android Native (Q3 2025)
- Built with Capacitor (single React codebase)
- APK distributed via GitHub + (later) Google Play
- Faster, more reliable than PWA
- **Goal:** Reach mobile-first users; 100K installs

### Phase 3: iOS (Q4 2025)
- Same codebase; Capacitor iOS build
- May require App Store restrictions on feature set (Apple's moderation policies)
- **Goal:** Parity with Android; premium market penetration

### Phase 4: Monetization (2026+)
- **Free tier:** Core civility + spam filtering; ads-free (no ads, period)
- **Pro ($4.99/mo):** Drunk mode, DND, advanced tone checking, analytics
- **Business:** Per-seat licensing for teams; API access; custom models
- **Enterprise:** White-label; on-premise deployment for corporations with compliance needs

### Distribution Channels
1. **Product Hunt** — Launch Android on PH; target early adopters
2. **Hacker News** — Privacy-conscious technical audience
3. **Twitter/Bluesky** — Direct founder engagement; show real testimonials
4. **Partnerships:**
   - Privacy-focused VPN/browser companies (ProtonMail, Mullvad, Tor Browser community)
   - Mental health/digital wellness platforms
   - School safety initiatives

---

## Competitive Advantages

| Competitor | Their Approach | Our Approach | Our Edge |
|------------|----------------|--------------|----------|
| WhatsApp's built-in filtering | Cloud-based; low accuracy | On-device; high accuracy | No data collection; user control |
| Apple Mail | Rules-only; no AI | Gemini Nano + rules | Understands context; learns style |
| Bark (parental control) | Cloud analysis; invasive | On-device + transparency | Privacy + trust; adult use |
| Gumroad, Substack (spam filters) | Email-only; cloud | Cross-platform; on-device | Messaging focus; real-time |
| Traditional ML models | Heavy; cloud-dependent | Lightweight; on-device | Works offline; instant |

**Key Differentiators:**
1. **First messaging app to put moderation entirely on-device**
2. **Gemini Nano:** Only company using Google's open on-device LLM at scale
3. **Cross-platform parity:** Web, Android, iOS all sync settings
4. **User control:** No hidden AI decisions; full transparency into filtering rules
5. **Privacy-first monetization:** Pro features (advanced AI), not data sales

---

## Business Model & Unit Economics

### Revenue Streams

```
Free tier:
  ├─ Core filtering (civility, spam, business sorting)
  ├─ Ad-free forever (no revenue here, but user trust)
  └─ Cross-sell to Pro

Pro tier ($4.99/mo):
  ├─ Drunk mode detection
  ├─ DND with emergency bypass
  ├─ Advanced tone checking
  ├─ Style-aware spell check
  └─ Analytics dashboard

Business ($99-499/mo):
  ├─ Per-seat licensing (teams)
  ├─ API access (integrate into chat platforms)
  ├─ Whitelabel support
  └─ SLA guarantees

Enterprise (custom):
  ├─ On-premise deployment
  ├─ Custom training on org's message patterns
  ├─ Compliance (HIPAA, GDPR, CCPA)
  └─ Dedicated support
```

### Unit Economics (Estimate — Year 1)

| Metric | Value |
|--------|-------|
| CAC (web PWA, organic) | $0.50 |
| Pro conversion rate | 3–5% |
| Pro ARPU | $4.99 |
| Pro LTV | $149.70 (30-month retention) |
| LTV:CAC ratio | 300:1 |
| Payback period | <1 month |

**Path to profitability:** 100K downloads → 3K Pro subscribers → $15K MRR (profitable at current burn)

---

## Team & Hiring

### Current Team
- **Founder:** [Your name]
  - Background in [AI/privacy/messaging/product]
  - Built [relevant project/company]
  - Thesis: "On-device AI is the future of privacy-respecting software"

### Immediate Hires (Seed round)
1. **Android Engineer** (Kotlin; Capacitor)
2. **ML Engineer** (fine-tuning Gemini Nano for moderation)
3. **Product Manager** (iOS + monetization)

### Extended Team (Series A)
4. **Privacy & Security Engineer** (audit, compliance, pentesting)
5. **Growth / Community Lead** (launch, partnerships, user feedback)

---

## Roadmap

### Q3 2025 (3 months)
- ✅ Web PWA (live)
- [→] Android beta (closed testing with 100 users)
- [ ] Spell-check AI upgrade
- [ ] Tone analyzer v2

### Q4 2025
- [ ] Android public launch (Google Play)
- [ ] Pro plan (monetization)
- [ ] iOS beta
- [ ] B2B outreach (teams, platforms)

### Q1 2026
- [ ] iOS public launch
- [ ] Analytics dashboard (Pro)
- [ ] API for platform integrations
- [ ] Series A fundraising

### H2 2026+
- [ ] Business tier launch
- [ ] Enterprise deployments
- [ ] International expansion (localization)
- [ ] Custom model training (org-specific)

---

## Why Now? Why Us?

### Market Timing
- **Gemini Nano** just became widely available (2024–2025); first-mover advantage
- **Privacy regulation** accelerating (GDPR, CCPA, UK Online Safety Bill)
- **Gen Z demand** for privacy-first apps (Signal, Telegram adoption)
- **AI mistrust** rising; users want control, not black-box moderation

### Why We Win
1. **First to market:** No competitor has shipped on-device messaging moderation at scale
2. **Technical moat:** Gemini Nano expertise; rules engine trained on millions of messages
3. **User-centric:** Transparent, controllable, no dark patterns (vs. WhatsApp's opacity)
4. **Scalable monetization:** Free tier doesn't require servers; Pro tier has 90%+ margin
5. **Acquisition tailwind:** Privacy + AI + messaging = three trend vectors

---

## Funding Ask & Use of Funds

### Seed Round: $1M

| Use | Amount | Notes |
|-----|--------|-------|
| Team (3 engineers, 12 months) | $450K | Salaries + equity |
| Infrastructure (servers, CDN, API keys) | $100K | Minimal; mostly free tier |
| Marketing & launch | $200K | PH, Twitter, partnerships, ads |
| Legal & compliance | $150K | Privacy audit, GDPR, App Store lawyers |
| Runway / buffer | $100K | 6-month buffer |

### Series A (12–18 months): $5–8M
- Scale team to 12 (engineering, product, growth, ops)
- International expansion (EU, APAC)
- Enterprise sales motion
- Advanced features (custom models, enterprise API)

---

## Key Metrics to Track

### Engagement
- DAU / MAU (daily / monthly active users)
- Civility blocks per user per day (engagement proxy)
- Pro conversion rate

### Retention
- 1-month, 3-month, 12-month retention (free)
- Pro churn rate (target: <5% MOM)

### Revenue
- MRR (monthly recurring revenue)
- ARPU (average revenue per user)
- CAC & LTV

### Technical
- Model accuracy (civility, spam, tone)
- Latency (message->decision, <100ms target)
- On-device model footprint (goal: <200MB)
- Fallback rate (% of messages requiring rules engine)

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| **Gemini Nano availability** | Partner with Google; fallback to rules engine; explore TFLite distillation |
| **iOS App Store rejection** | Preemptive compliance; lawyer early; consider sideload distribution |
| **User adoption (messaging sticky)** | Cross-platform sync; embed into existing habits (not separate app); partnerships |
| **Regulatory (EU AI Act)** | Transparent documentation; impact assessments; privacy audit |
| **Model accuracy errors** | User override ("this wasn't abuse"); feedback loops; human review for disputed cases |
| **Market shift (new platforms)** | Modular architecture; team expertise transfers; first-mover on next platform |

---

## Closing

**Strenes is building the private AI layer for messaging.**

Users want three things:
1. Safety (no abuse reaching them)
2. Privacy (data stays on their phone)
3. Control (they decide the rules, not some algorithm)

Nobody else is delivering all three.

We're not disrupting WhatsApp or Signal. We're adding a layer *on top* of whatever messaging app users already use. We work with their favorite apps, respect their choice, and get out of the way.

**This is how AI should work: powerful, private, and in your control.**

---

**Next Steps for Investors:**
- Try the [live demo](https://martian-coder.github.io/TinyTools/strenes/)
- Download the Android APK (beta link)
- Schedule a founders call (30 min to see it live)
- Read our [security audit](./SECURITY.md)

**Contact:** [your email] | [LinkedIn](your link) | [Twitter](your link)
