# 🌀 Olus

> A featherweight browser. Real Chromium rendering (via WebView2), a fraction of the RAM, a beautiful glass UI — and **you never lose your tabs.**

![Olus](./screenshot.png)

Olus is **not a new engine** — building one is thousands of engineer-years, and every "new" browser you love (Arc, Brave, Edge, Vivaldi) is really a *shell* on Chromium. Olus competes where Chrome is weak: **weight, privacy, control, and how easily a developer can bend it.**

| What matters | Chrome | Edge / others | **Olus** |
|---|---|---|---|
| Bundled engine | Chromium (~150 MB) | Chromium (~150 MB) | **WebView2 — already on Win11, 0 MB bundled** |
| App binary | — | — | **~3–10 MB** |
| Idle RAM | high | high | **low (shared system WebView2)** |
| Never lose your tabs | needs sign-in | needs sign-in | **on by default, crash-safe** |
| Browse via Tor / a country | ✗ | ✗ | **built-in dropdown** |
| Switch search engine | buried in settings | buried in settings | **top-bar toggle** |
| Telemetry / account wall | Google account | Microsoft account | **none** |
| Backend | C++ | C++ | **Rust** |
| Add a feature | fork the planet | ✗ | **one `#[tauri::command]`** |

## The headline features

- **🗂️ Never lose your tabs.** Every tab is written to disk the instant it changes and restored on launch — survives crashes, updates and restarts. Point the session file at a synced folder (OneDrive/Dropbox) and your tabs follow you between machines. *(Cloud sync is on the roadmap.)*
- **✦ AI sidebar.** One click (or `Ctrl+J`) slides an AI assistant (Claude.ai by default) in beside any page — ask about what you're reading without leaving the tab.
- **🎨 Themes.** A clean **blue light** theme (default) and a focused **dark** theme — chrome *and* start page switch together, instantly.
- **🌐 Browse from anywhere.** A top-bar dropdown routes the engine through **Tor** (if you run Tor locally) or **any country's proxy** — no extensions.
- **🔑 Sign in like normal.** A real Chrome user-agent + persistent profile, so Google, GitHub and friends let you sign in and stay signed in (no "insecure browser" walls).
- **🔍 Your search, your call.** Flip between **Google** (default), DuckDuckGo, Brave, Startpage, Bing and Ecosia from the toolbar, any time.
- **🪶 Featherweight & private.** System Chromium engine, no telemetry, no account wall.
- **🧅 Tor new identity.** When region is **Tor**, a ⟲ button requests a fresh circuit (NEWNYM) via the Tor control port (9051).
- **🛠️ Dev Dock (`Ctrl+`\`).** A bottom dock with four tools: **Console** (real Chromium DevTools), **API** client (build/send requests, see status + headers), **Terminal** (runs commands in a tracked working dir), and **Serve** (spin a zero-dep static localhost server for dev).

## How it works

Reliability-first: webview *creation* (`add_child`) only works during startup on this Tauri/WebView2 build (from a command thread it deadlocks on WebView2's async init). So Olus creates **exactly three webviews once at launch and never at runtime**:

- **`shell`** — the HTML/CSS/JS chrome (tab strip + toolbar), full window.
- **`content`** — the single page viewport. "Tabs" are saved URLs; switching navigates this one viewport (lighter than N engines, and rock-solid).
- **`sidebar`** — the AI panel, parked offscreen until toggled.

The shell calls Rust over the Tauri bridge (`invoke`); Rust navigates the viewport (JS navigation works from any thread), persists state, and emits events back (`tabs:update`, `content:navigated`). Content + sidebar run with a Chrome user-agent so logins work.

```
src/                 shell UI (vanilla, zero framework)
  index.html         toolbar + tab strip + engine/region pickers
  start.html         the marketing start / new-tab page
  styles.css
  app.js
src-tauri/
  src/lib.rs         tab engine, session + settings, commands  ← the brain
  src/main.rs
  tauri.conf.json
  capabilities/
```

State lives in `%APPDATA%\Olus\`: `session.json` (your open tabs) and `settings.json` (region/proxy).

## Run

Prereqs: **Rust** (stable) and the **WebView2 runtime** (preinstalled on Windows 11).

```powershell
cd Olus\src-tauri
cargo run            # first build pulls the dep tree — grab a coffee
```

No Node, no bundler, no Tauri CLI required — the frontend is static files embedded at build time.

## Browsing from another region (Tor / proxies)

Pick **Tor (local)** or **Custom proxy…** from the 🌐 dropdown; Olus saves it and restarts so the new route takes effect (the WebView2 proxy is fixed at engine startup).

- **Tor** expects the Tor daemon running locally on `socks5://127.0.0.1:9050` (install the Tor Expert Bundle or Tor Browser and leave it running).
- **Custom** accepts any `socks5://host:port` or `http://user:pass@host:port` — point it at a proxy in the country you want to appear from.

Real built-in country exit-nodes need network infrastructure that isn't bundled; Olus gives you the wiring and works the moment you supply Tor or a proxy.

## Shortcuts

`Ctrl+T` new tab · `Ctrl+W` close · `Ctrl+L` focus address · `Ctrl+R` reload · `Ctrl+J` AI sidebar · `` Ctrl+` `` Dev Dock

## Easy to extend — the whole point

Want a reader mode, an ad blocker, a "summarize this page with an LLM" button, vertical tabs, or a command palette? Each is a small, isolated change:

1. Add a `#[tauri::command]` in `lib.rs` (auto-exposed to the UI — no boilerplate).
2. Wire a button/shortcut in `app.js`.

```rust
#[tauri::command]
fn read_mode(app: AppHandle, label: String) {
    eval_in(&app, &label, "document.body.style.maxWidth='720px'");
}
```

## A note on the tab model

Because runtime webview creation is unreliable on this stack, tabs share one viewport: switching a tab re-navigates it (the page reloads rather than resuming from a frozen state). This keeps Olus dead-simple and extremely light (one engine, not N), and "never lose your tabs" is unaffected. True per-tab live webviews are a roadmap item pending upstream fixes.

## Roadmap

- [ ] Per-tab live webviews (resume scroll/state without reload)
- [ ] Cloud tab sync (so "never lose your tabs" is truly device-agnostic)
- [ ] Configurable AI sidebar target (ChatGPT / Perplexity / Gemini)
- [ ] Frameless custom titlebar + window controls
- [ ] History, bookmarks, downloads (Rust + a tiny SQLite file)
- [ ] Built-in content blocker (WebView2 request filtering)
- [ ] Command palette (`Ctrl+K`)

---

Part of [TinyTools](../README.md). MIT.
