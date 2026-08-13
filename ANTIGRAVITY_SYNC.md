# 🛸 Antigravity Project Handover & Sync Status

> **Last Updated**: 2026-08-14 (Termux Session)  
> **Repository**: [`martian-coder/TinyTools`](https://github.com/martian-coder/TinyTools)  
> **Active Sub-Project**: `podcast-hub/` (Podcast Hub — AI Podcast Intelligence & Monetization Studio)  
> **Live GitHub Pages URL**: [https://martian-coder.github.io/TinyTools/podcasthub/](https://martian-coder.github.io/TinyTools/podcasthub/)  
> **Local Dev Server**: `http://localhost:3000` / `http://127.0.0.1:3000`

---

## 🎯 Current Project State & Accomplishments

### 1. ⚡ AI Model Optimization (Gemini 2.5 Flash)
- **Problem**: Earlier analysis took ~10 mins or hung due to deprecated model names (`gemini-3.5-flash`, `gemini-3.6-flash`).
- **Fix**: Replaced all model calls in `server.ts` with `gemini-2.5-flash` using `@google/genai` (`^2.4.0`).
- **Performance**: Reduced episode analysis latency from **10 minutes down to ~2–4 seconds**.
- **YouTube Scraper**: Added `AbortSignal.timeout(3500)` in `server.ts` to prevent mobile network hangs.

### 2. 💾 Database & State Persistence (IndexedDB + Dexie.js)
- **File**: `src/lib/db.ts`
- **Stores**:
  - `podcasts`: All imported/summarized episodes, monetization models, timestamps, reflection quizzes, and tags.
  - `userProfiles`: User profile info, strategic goals, personal notes, and saved insights.
  - `knowledgeGroups`: Thematic multi-video learning hub groups and synthesized blueprints.
  - `collections`: Playlist folders and tags.
  - `chatHistories`: Interactive AI chatbot history per podcast episode.
- **Migration**: Automatically migrates old `localStorage` data into `IndexedDB` on initial app boot.
- **Benefits**: 0ms latency, zero-config, stores gigabytes of transcripts/data locally on device.

### 3. ☁️ Supabase Cloud Sync Engine (Ready)
- **File**: `src/lib/supabase.ts`
- **Tables Schema**:
  ```sql
  CREATE TABLE IF NOT EXISTS user_libraries (user_id TEXT PRIMARY KEY, podcasts_data JSONB NOT NULL DEFAULT '[]'::jsonb, updated_at TIMESTAMPTZ DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS user_profiles (user_id TEXT PRIMARY KEY, profile_data JSONB NOT NULL DEFAULT '{}'::jsonb, updated_at TIMESTAMPTZ DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS user_knowledge_groups (user_id TEXT PRIMARY KEY, groups_data JSONB NOT NULL DEFAULT '[]'::jsonb, updated_at TIMESTAMPTZ DEFAULT NOW());
  ```
- **Sync Behavior**: Hybrid architecture in `App.tsx` — reads from local IndexedDB first for instant UI rendering, syncs to Supabase in the background when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are provided.

### 4. 🔑 Authentication & Profile System
- **File**: `src/components/GoogleSignInCard.tsx` & `src/lib/auth.ts`
- **Features**:
  - **1-Click Instant Guest Sign-In**: Works without needing Google Cloud OAuth client credentials.
  - **YouTube Channel Handle Connect**: Allows setting custom avatar, handle, and display name.
  - **OAuth 2.0 Backend**: Full server redirect flow supported in `server.ts` if `GOOGLE_CLIENT_ID` is set in `.env`.

### 5. 🚀 Universal Deployment Setup (GitHub Pages + Local)
- **Vite Base**: `base: process.env.VITE_BASE || (command === 'build' ? './' : '/')` in `vite.config.ts`.
  - Development mode (`npm run dev`) runs at root `/`.
  - Production builds (`npm run deploy-gh`) use relative paths (`./assets/...`) so it works inside the subfolder `/TinyTools/podcasthub/`.
- **Deploy Command**: `npm run deploy-gh`
  - Runs `npx vite build && npx gh-pages -d dist -e podcasthub -a --nojekyll`.
  - The `-a` (`--add`) flag ensures other sub-tools (`strenes`, `agent-standup`) on `gh-pages` branch are NOT overwritten.
- **GitHub Pages Configuration**: Set to deploy from `gh-pages` branch root `/`.
- **Error Boundary**: Global `ErrorBoundary` in `src/main.tsx` prevents blank screens and allows 1-click cache resets.

---

## 📁 Key File Structure & Locations

```
TinyTools/
├── ANTIGRAVITY_SYNC.md                <-- Handover & sync status file
├── podcast-hub/
│   ├── .env                           <-- GEMINI_API_KEY, PORT=3000
│   ├── ANTIGRAVITY_SYNC.md            <-- Subproject handover document
│   ├── index.html                     <-- Page entrypoint with metadata
│   ├── package.json                   <-- Scripts (dev, build, deploy-gh, lint)
│   ├── server.ts                      <-- Express + Gemini AI + YouTube backend
│   ├── vite.config.ts                 <-- Vite config with relative build base
│   └── src/
│       ├── main.tsx                   <-- Root render + ErrorBoundary
│       ├── App.tsx                    <-- Tab routing, IndexedDB & Supabase state sync
│       ├── types.ts                   <-- Full TypeScript interfaces
│       ├── lib/
│       │   ├── db.ts                  <-- Dexie IndexedDB stores & CRUD helpers
│       │   ├── supabase.ts            <-- Supabase sync engine
│       │   └── auth.ts                <-- Auth redirect & token resolvers
│       └── components/
│           ├── Navbar.tsx             <-- Top navigation & stats
│           ├── Sidebar.tsx            <-- Left glance navigation sidebar
│           ├── LibraryView.tsx        <-- Main library dashboard & video importer
│           ├── PodcastDetailView.tsx  <-- Deep intelligence, timestamps, takeaways
│           ├── EpisodeChatbot.tsx     <-- AI chatbot with IndexedDB history
│           ├── YouTubeSearchView.tsx  <-- YouTube search & direct import
│           ├── MonetizationHubView.tsx<-- SaaS monetization blueprint matrix
│           ├── EthicsHubView.tsx      <-- Ethics & mental discipline hub
│           ├── KnowledgeGroupsView.tsx<-- Multi-video learning hubs
│           ├── ContentStudioView.tsx  <-- AI script, thread, and newsletter generator
│           └── GoogleSignInCard.tsx   <-- 1-click guest & handle login
```

---

## 🛠️ Common Commands

| Action | Command | Working Directory |
| :--- | :--- | :--- |
| **Start Local Dev Server** | `npm run dev` (or `node ./node_modules/tsx/dist/cli.mjs server.ts`) | `TinyTools/podcast-hub` |
| **Build for Production** | `npm run build` | `TinyTools/podcast-hub` |
| **Deploy to GitHub Pages** | `npm run deploy-gh` | `TinyTools/podcast-hub` |
| **Run TypeScript Lint** | `npm run lint` (`tsc --noEmit`) | `TinyTools/podcast-hub` |
| **Push Git Changes** | `git push origin main` | `TinyTools` |

---

## 📋 Outstanding / Next Step Roadmap

1. **Client-Side Gemini Fallback for Static Hosting**:
   - Optional: Add direct client-side Gemini API calls so features like live YouTube AI search and episode summarization can work directly on GitHub Pages when a user provides their own Gemini API key in settings.
2. **Export / Import Library**:
   - Add a JSON backup export/import button in `UserProfileView` so users can download or restore their IndexedDB library across devices.
3. **PWA / Offline Service Worker**:
   - Add PWA manifest and service worker for mobile installation as a standalone app.
