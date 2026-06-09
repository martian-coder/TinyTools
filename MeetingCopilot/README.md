# Meeting Copilot

A personal AI assistant that sits as a transparent overlay during Zoom/Teams calls. It listens to the other person, transcribes their speech locally (Whisper), and streams a suggested reply from Claude the moment they pause.

## Overlay (Electron desktop app)

![Overlay UI](./docs/screenshot-ui.svg)

## CLI (terminal)

![CLI](./docs/screenshot-cli.svg)

## How it works

1. Before the meeting: paste context (agenda, your role, talking points) into the text area
2. Start session — the overlay appears
3. The other person speaks → Whisper transcribes → Claude streams a suggested reply
4. Glance at the overlay, adapt, keep talking

Context is sent once as a **cached system prompt** — only the live transcript is sent on each turn, so latency and cost stay low.

## Setup

### 1. Install

```
cd MeetingCopilot
npm install
npm start
```

Requires Node 18+ and a working Electron environment.

### 2. macOS — system audio

The first run will ask for Screen Recording permission. Grant it in System Preferences → Privacy & Security. Without it, audio capture will not work.

### 3. Windows — system audio

Uses `getDisplayMedia` with loopback audio. When prompted to share a screen, select the window/screen you want to capture audio from.

### 4. Claude API key

Get one at [console.anthropic.com](https://console.anthropic.com/settings/keys). Paste it in the Meeting Copilot window and choose a model (Sonnet 4.6 is recommended).

## Modes

| Mode | What it uses |
|------|-------------|
| **Claude API** (default) | Claude API + local Whisper transcription |
| **Local AI** | Ollama LLM + local Whisper transcription |
| **Gemini BYOK** | Gemini Live API + Groq (bring your own keys) |

## Quick demo (no microphone needed)

1. Start in Claude API mode with your key
2. Leave the context textarea as-is or paste some context
3. Click **Start Session**
4. Type a question in the bottom text bar and press Enter
5. Claude's suggested reply streams in the overlay

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl+\` | Show/hide overlay |
| `Cmd/Ctrl+M` | Toggle click-through |
| `Cmd/Ctrl+Enter` | Analyze screen |
| `Cmd/Ctrl+[` / `]` | Previous/next response |
| `Cmd/Ctrl+Shift+E` | Emergency hide + quit |

## License

GPL-3.0
