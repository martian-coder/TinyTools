# Strenes — Investor Quick Start Guide

**Welcome! Here's everything you need to understand and try Strenes.**

---

## 📱 Try It Right Now

### Web Version (Instant, No Install)
**Live demo:** https://martian-coder.github.io/TinyTools/strenes/

Just open in your browser. The app is a fully-functional PWA:
- Send messages to fake contacts
- Enable filters (civility, spam, business sorting)
- See what gets blocked, archived, or delivered
- Try the new features: drunk mode, tone analyzer, spell-check, DND, disappearing messages
- **Zero servers. All processing happens in your browser.**

### Android Version (Beta)
Follow [BUILD_APK_LOCALLY.md](./BUILD_APK_LOCALLY.md) to build the native Android app.
Takes ~30 minutes first time, then 2-5 minutes for rebuilds.

---

## 🎯 What to Try in the Demo

### 1. **Civility Filter** ✅
- Type an abusive message (e.g., "you're stupid")
- See it get **blocked** before reaching the contact
- Adjust sensitivity: Low → Medium → High
- Try "notify sender" toggle

### 2. **Tone Analyzer** 🧠 (NEW)
- In Settings: Enable "Tone Checker"
- Type a message >10 chars
- See the **Brain icon** appear next to send button
- Click it to see:
  - Detected tone: polite, neutral, assertive, aggressive, harsh
  - Confidence score (0-100%)
  - **Anxiety warning** if message might upset someone
  - Suggestions to soften language

### 3. **Drunk Mode** 🍺 (NEW)
- In Settings: Enable "Drunk Mode" → Auto-detect ON
- Type quickly with:
  - HIGH caps lock usage (LIKE THIS)
  - Lots of typos (watsapp, bruuh)
  - Lots of exclamation marks!!!
- See **drunk warning card** appear (mild/moderate/high)
- Toggle "action" to Prevent or Warn

### 4. **Spell-Check** ✨ (NEW)
- In Settings: Enable "Style-Aware Spell Check"
- Type with typos: "watsapp", "ur", "bruuh", "tmrw"
- Before sending, see suggestions in AI-learned style
- Accept corrections or send as-is

### 5. **Do Not Disturb (DND)** 🔇 (NEW)
- In Settings: Enable "Do Not Disturb"
- Set start hour (22 = 10pm) and end hour (7 = 7am)
- Toggle "Allow trusted contacts" and "Allow emergency contacts"
- Mark a contact as "Emergency contact" in Trusted list
- Messages from non-emergency contacts arrive silently during quiet hours

### 6. **Disappearing Messages** ⏰ (NEW)
- In Settings: Enable "Disappearing Messages"
- Choose when to auto-delete: On read, 1m, 5m, 1h, 24h
- Messages self-destruct after selected time

### 7. **Unhinged Mode** 😈 (NEW)
- In Settings: Enable "Unhinged Mode"
- Bypasses ALL filters — use for testing or just vibing
- Useful for trolling yourself or trusted friends

---

## 🔐 Security Demo

**The key differentiator: Zero cloud, zero data collection.**

### Verify This Yourself

1. **Open DevTools** (F12 in browser)
2. Go to **Network tab**
3. Send a message through the app
4. Check the requests: **ZERO API calls for message processing**
   - You'll only see GitHub Pages static file loads
   - No message text leaves your device
5. Go to **Application** → **Local Storage**
   - Settings are encrypted locally
   - Message text is never stored anywhere

**For Android:**
- Use Android Studio's Network Profiler
- Same result: zero outbound calls during moderation

---

## 📊 Business Model

| Plan | Price | Features |
|------|-------|----------|
| **Free** | $0 | Core filters (civility, spam, tone) |
| **Pro** | $4.99/mo | DND + drunk mode + spell-check + analytics |
| **Business** | $99+/mo | Teams, API, white-label |
| **Enterprise** | Custom | On-prem, compliance, SLA |

**Unit Economics:**
- CAC (organic): $0.50
- Pro conversion: 3–5%
- Pro LTV: $149.70 (30-month)
- **LTV:CAC: 300:1**
- Payback period: <1 month

---

## 📚 Deep Dives

- **Pitch deck:** [PITCH.md](./PITCH.md) — Market opportunity ($50B TAM), roadmap, funding ask
- **Security audit:** [SECURITY.md](./SECURITY.md) — Threat model, GDPR/CCPA compliance, encryption details
- **Tech overview:** [README_VC.md](./README_VC.md) — Tech stack, architecture, metrics
- **Build guide:** [BUILD_APK_LOCALLY.md](./BUILD_APK_LOCALLY.md) — How to build the Android APK

---

## 🏗️ Tech Stack (One Codebase, Three Platforms)

- **Frontend:** React 19 + TypeScript + Tailwind CSS v4
- **State:** Zustand v5 (on-device persistence via localStorage)
- **AI:** Gemini Nano (on-device, no cloud)
- **Mobile:** Capacitor (iOS/Android from same React codebase)
- **Hosting:** GitHub Pages (static, stateless)

**No external API calls for moderation. Ever.**

---

## 🎨 Features at a Glance

### Core (All Plans)
✅ Civility filter (blocks abuse)  
✅ Smart inbox sorting (business/promo)  
✅ Spam detection  
✅ Trusted contacts (bypass filters)  
✅ **Tone analyzer** (new)  
✅ **Spell-check** (new)  
✅ 4 themes (aurora, slate, emerald, **terminal**)  

### Pro ($4.99/mo)
✅ **Do Not Disturb** (quiet hours + emergency bypass)  
✅ **Drunk mode** (detects intoxicated typing)  
✅ **Unhinged mode** (all filters off)  
✅ Analytics (what was filtered, trends)  

---

## ❓ FAQ

**Q: Is this only for WhatsApp?**  
A: Strenes works as a standalone app or layer on top of any messaging app (WhatsApp, iMessage, Signal, Telegram, etc.). Users copy/paste messages into Strenes or integrate via API.

**Q: How do you make money if all processing is on-device?**  
A: Pro tier features (DND, drunk mode, analytics) and enterprise licensing. The free tier is a trust-builder; 3–5% convert to paid.

**Q: What if Gemini Nano isn't available?**  
A: Falls back to on-device rules engine (Trie + pattern matching). Quality drops slightly, but app keeps working offline.

**Q: GDPR/CCPA compliant?**  
A: Yes. Message text never leaves the device, so no data collection, no tracking, no profiling. See [SECURITY.md](./SECURITY.md) for details.

**Q: Can I audit the code?**  
A: Open source coming Q4 2025. For now, inspect network traffic in browser DevTools (proves zero API calls) or request a technical walkthrough.

---

## 🚀 Timeline

**Q3 2025:** Web PWA live ✅ | Android beta | Spell-check upgrade  
**Q4 2025:** Android public launch | Pro monetization | iOS beta  
**Q1 2026:** iOS launch | Series A fundraising  
**H2 2026+:** Business tier | Enterprise deployments  

---

## 💬 Next Steps

1. **Try the web demo:** https://martian-coder.github.io/TinyTools/strenes/
2. **Read the pitch:** [PITCH.md](./PITCH.md)
3. **Check security:** [SECURITY.md](./SECURITY.md)
4. **Build Android APK:** [BUILD_APK_LOCALLY.md](./BUILD_APK_LOCALLY.md)
5. **Schedule a call:** [Founder contact info]

---

**Strenes: The private AI layer for messaging.**  
*Your messages. Your rules. Your device. No servers.* 🔒

---

**For questions or demo requests, reach out to the founder.**
