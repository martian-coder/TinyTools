<p align="center">
  <img src="./banner.png" alt="TinyTools Banner" width="100%">
</p>

<p align="center">
  <a href="https://martian-coder.github.io/TinyTools/sift-home/"><img src="https://img.shields.io/badge/Sift-Live%20Demo-7c83ff?style=for-the-badge&logo=pwa&logoColor=white" alt="Sift Live Demo"></a>
  <a href="https://martian-coder.github.io/TinyTools/sift/"><img src="https://img.shields.io/badge/Sift%20PWA-Install-22d3ee?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Install Sift PWA"></a>
  <img src="https://img.shields.io/github/deployments/martian-coder/TinyTools/github-pages?style=for-the-badge&label=Pages&color=0b1020" alt="GitHub Pages">
</p>

# TinyTools

> A collection of stupid-delightful tiny tools — built with love, made for an audience of one.

Inspired by [Scott Hanselman's TinyToolTown](https://tinytooltown.com) — _"Vibe coding is the GeoCities of the AI era."_

---

## The Tools

### Featured

<table>
<tr>
<td width="60%">

**[Sift — AI Message Filter](https://martian-coder.github.io/TinyTools/sift-home/)**

A WhatsApp-style PWA where *you* control an AI filter that screens every incoming message before it reaches you. Spam, abuse, and noise stay out. Signal gets through.

- On-device AI via Gemini Nano (Chrome built-in) — message plaintext never leaves your device
- Rules engine fallback for instant offline classification
- 4 smart folders: Primary, Business, Promos, Review
- Civility filter with blur-to-reveal for borderline messages
- Installable PWA — works offline, feels native

**[→ See why Sift beats WhatsApp, iMessage & Telegram](https://martian-coder.github.io/TinyTools/sift-home/)** &nbsp;·&nbsp; **[→ Install the app](https://martian-coder.github.io/TinyTools/sift/)**

</td>
<td width="40%" align="center">

```
┌─────────────────────┐
│  Sift               │
│  ─────────────────  │
│  Primary    (3)  ▸  │
│  Business   (1)  ▸  │
│  Promos     (0)  ▸  │
│  Review     (2)  ▸  │
│                     │
│  ✓ clean            │
│  ⚑ business         │
│  ░░░░░░░ held       │
│  ✗ blocked          │
└─────────────────────┘
```

</td>
</tr>
</table>

---

### All Tools

| Tool | What it does | Stack | Platform |
|------|-------------|-------|---------|
| [**Sift**](https://martian-coder.github.io/TinyTools/sift-home/) | AI-filtered messaging PWA — on-device Gemini Nano screens every message before it reaches you | React 19 + Vite + PWA | Any browser |
| [**MeetingCopilot**](./MeetingCopilot/) | On-screen AI copilot — listens to meeting audio, transcribes with local Whisper, streams reply suggestions with Claude in a transparent overlay | Node.js / Electron | Windows / macOS / Linux / Android |
| [**Olus**](./Olus/) | A featherweight browser — real Chromium via WebView2, never-lose-your-tabs sessions, Tor/proxy region routing, switchable search engine | Rust / Tauri 2 | Windows |
| [**MarkdownZipped**](./MarkdownZipped/) | Compress LLM prompts through a 4-stage pipeline (minify → rewrite → dedup → cache) and pack them into a `.mdz` file | Python 3 | Windows / macOS / Linux |
| [**CmdLog**](./CmdLog/) | Interactive history browser — search, categorize, bookmark and re-run commands with full context (directory, branch, timing, exit code) | Python 3 | Windows / macOS / Linux |
| [**SmartRecover**](./SmartRecover/) | When your machine crashes — pick up where you left off. Snapshots tmux / browser / clipboard on a schedule, restores from any past timeline state | Python 3 | Linux |
| [**JumpDir**](./JumpDir/) | Interactive fuzzy directory navigator for your terminal | Python 3 | Windows / macOS / Linux |
| [**CodeBlaster**](./CodeBlaster/) | Arcade game — shoot falling code asteroids with the correct keyword | HTML / JS | Any browser |
| [**CopyToLLM**](./CopyToLLM/) | Screen capture → clipboard → paste into any AI chat in one hotkey | C# / .NET 9 | Windows |
| [**WingetDiff**](./WingetDiff/) | Diff two `winget export` JSON files with a gorgeous terminal UI | C# / .NET 8 | Windows |

---

## ✨ Philosophy

Every tool in this repo follows the same principles:

- **Tiny** — Single-purpose, small codebase, no bloat
- **Zero dependencies** — No NuGet packages, no pip installs, just the standard library
- **Just works** — Clone, build, run. That's it.
- **Delightful** — If it doesn't spark joy, it doesn't ship

---

## 🚀 Quick Start

### CopyToLLM
```bash
cd CopyToLLM
dotnet run
# Press Ctrl+Shift+S → capture screen → auto-paste into ChatGPT/Claude/Gemini
```

### WingetDiff
```bash
cd WingetDiff
dotnet run -- laptop.json desktop.json
```

### JumpDir
```bash
cd JumpDir
python jumpdir.py --make-bat   # Windows one-time setup
j                               # Launch interactive picker
```

### SmartRecover
```bash
cd SmartRecover
python3 smartrecover.py daemon &   # autosave every 10 min in the background
python3 smartrecover.py            # browse the timeline — restore tmux, tabs, clipboard
```

### CmdLog
```bash
cd CmdLog
python3 cmdlog.py                     # auto-imports history, opens interactive TUI
python3 cmdlog.py --install bash      # install rich shell hooks (one-time setup)
```

### MarkdownZipped
```bash
cd MarkdownZipped
python3 mdzip.py zip examples/verbose_prompt.xml   # compress -> .mdz
python3 mdzip.py info examples/verbose_prompt.mdz  # show savings
open web/index.html                                # or use the browser studio (zero install)
```

### MeetingCopilot
```bash
cd MeetingCopilot
npm install

# Desktop overlay (Electron)
ANTHROPIC_API_KEY=sk-ant-... npm start

# CLI — terminal only
node cli.js --key sk-ant-... --context "context about the meeting"

# CLI with web overlay — open on phone/tablet (same WiFi)
node cli.js --key sk-ant-... --serve
# → Open http://<your-ip>:3001 on any device
```

---

## 📦 Building

Each tool is self-contained in its own directory. No solution file, no monorepo build system — just `cd` into the folder and build.

```bash
# .NET tools
dotnet build CopyToLLM/
dotnet build WingetDiff/

# Python tool — no build needed
python JumpDir/jumpdir.py --help
```

---

## 🤝 Contributing

Got a tiny tool that sparks joy? Open a PR! The bar is:
1. Does it solve a real itch?
2. Is it small enough to understand in one sitting?
3. Does it have zero (or near-zero) external dependencies?

---

## 📄 License

[MIT](./LICENSE) — Do whatever you want with it.

---

<p align="center">
  <i>Made with ✨ vibes ✨ by <a href="https://github.com/martian-coder">martian-coder</a></i>
</p>
