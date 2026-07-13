# Perch 🦉

**The AI guardian that watches over your kid's phone — without reading over
their shoulder.**

One install on the kid's Android phone. Perch scans incoming notifications
from WhatsApp, Instagram, Snapchat, Telegram, SMS and more — **entirely
on-device** — for grooming, predator patterns, scams, bullying and self-harm
signals. When something's wrong, the paired parent gets a flag that says
*why*. Never the message.

- 🏠 Landing: `/perch-home/` · 📱 Live demo: `/perch/`
- ⬇️ APK: rolling release `perch-android-latest`
- 🔒 Privacy model: message content has no code path off the phone. Only
  flag metadata (category, reason, app, sender name, time) is relayed.
- 👀 Transparency: the kid sees the same flag list the parent sees.
- 🤖 Ask Perch: the parent chats with an AI grounded in the flag log —
  own Gemini/Claude key → managed proxy → on-device Gemini Nano →
  deterministic fallback.

## Setup (once)

1. Run `supabase/migrations/001_perch_pairings_and_events.sql` in the
   Supabase SQL editor (same project as Strenes).
2. `npm install && npm run dev` for the web app.
3. Android: `npm run build:android:debug` (or let CI build the APK).

See `CLAUDE.md` for architecture notes.

Built by **Martian Coders** · martian.coders.x@gmail.com
