# Meeting Copilot

A personal AI meeting assistant that sits as a transparent overlay during Zoom/Teams calls. It listens to the other speaker, transcribes their speech locally with Whisper, and streams a concise talking point from Claude the moment they pause — so you always have something clear and confident to say.

## 🌍 Multilingual — the standout feature

**The other person can speak any language. You always see English.**

Chinese, French, Hindi, Arabic, Spanish, Japanese, German — or any of the ~100 languages Whisper understands — Meeting Copilot transcribes and translates to English in real time. No translation API, no extra cost, no added latency. Whisper's built-in `translate` task does speech recognition and English translation in a single pass.

This is on by default. Toggle it off in the setup screen for English-only meetings.

---

## Overlay (Electron desktop app)

![Overlay UI](./docs/screenshot-ui.svg)

## CLI (terminal)

![CLI](./docs/screenshot-cli.svg)

---

## How it works

1. Before the meeting: paste context (agenda, your role, talking points) into the text area
2. Start session — the overlay appears
3. The other person speaks → Whisper transcribes (+ translates to English if needed) → Claude streams a suggested reply
4. Glance at the overlay, adapt, keep talking

Context is sent once as a **cached system prompt** — only the live transcript changes per API call, so latency and cost stay low.

---

## Setup

### 1. Install

```bash
cd MeetingCopilot
npm install
npm start
```

Requires Node 18+.

### 2. macOS — system audio

The first run will ask for Screen Recording permission. Grant it in System Preferences → Privacy & Security. Without it, audio capture will not work.

### 3. Windows — system audio

Uses ffmpeg WASAPI loopback. Install once:
```
winget install Gyan.FFmpeg
```

### 4. Linux — system audio

```bash
apt install pulseaudio-utils
pactl list sources short        # find your monitor source
# then set --loopback <name> in CLI, or use mic
```

### 5. Claude API key

Get one at [console.anthropic.com](https://console.anthropic.com/settings/keys). Paste it into the setup screen and pick a model (Sonnet 4.6 recommended).

---

## Modes

| Mode | What it uses |
|------|-------------|
| **Claude API** (default) | Claude API + local Whisper transcription |
| **Local AI** | Ollama LLM + local Whisper transcription |
| **Gemini BYOK** | Gemini Live API (bring your own keys) |

---

## CLI

Run the full pipeline directly from terminal — no Electron needed:

```bash
# Default: any language → English
node cli.js --key sk-ant-... --context "Q4 planning meeting — budget review, roadmap sign-off"

# Web overlay on your phone/tablet (same WiFi)
node cli.js --key sk-ant-... --serve

# English-only mode (skip translation step)
node cli.js --key sk-ant-... --lang en

# All options
node cli.js start --help
```

**Platform audio:**
- macOS: system audio (Teams/Zoom output) by default
- Windows: ffmpeg WASAPI loopback (`winget install Gyan.FFmpeg`)
- Linux: `--loopback <pulse-monitor-device>` for system audio, or `--mic`
- Android/Termux: `--mic` + `--serve` to view on phone

---

## Quick demo (no microphone needed)

1. Start in Claude API mode with your key
2. Click **Start Session**
3. Type a question in the bottom text bar and press Enter
4. Claude's suggested reply streams in the overlay

---

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl+\` | Show/hide overlay |
| `Cmd/Ctrl+M` | Toggle click-through |
| `Cmd/Ctrl+Enter` | Analyze screen |
| `Cmd/Ctrl+[` / `]` | Previous/next response |
| `Cmd/Ctrl+Shift+Up/Down` | Scroll response |

---

## Profiles

| Profile | Best for |
|---------|---------|
| **Meeting** (default) | Team meetings, standups, discussions |
| **Sales** | Client calls, business development |
| **Presentation** | Pitches, demos, public talks |
| **General** | Any professional conversation |

---

## Trial & License

Meeting Copilot runs free for 25 days. After that a licence is required.

Source is available under the [Business Source License 1.1](./LICENSE). It converts to GPL-2.0+ on 2029-01-01.
