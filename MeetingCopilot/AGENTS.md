# Meeting Copilot — Repo Guidelines

An Electron-based real-time AI meeting assistant. Captures system audio, transcribes with local Whisper, and streams suggested replies from Claude (or Gemini/Ollama) to a transparent always-on-top overlay.

## Getting started

```
cd MeetingCopilot
npm install
npm start
```

## Style

Run `npx prettier --write .` before committing. Settings in `.prettierrc` (four-space indent, print width 150, semicolons, single quotes).

## Architecture

| File | Role |
|------|------|
| `src/index.js` | Main Electron process — IPC setup, storage init |
| `src/utils/gemini.js` | Audio capture, provider routing, IPC handlers |
| `src/utils/anthropic.js` | Claude API streaming + prompt caching |
| `src/utils/localai.js` | Whisper + VAD pipeline, pluggable LLM |
| `src/utils/cloud.js` | Groq cloud path |
| `src/utils/prompts.js` | System prompt library by profile |
| `src/storage.js` | JSON-based persistent storage |
| `src/components/` | LitElement UI components |

## Key behaviours

- Default provider mode is `'anthropic'` (Claude API + local Whisper)
- VAD trigger: speech → ~1s silence → Whisper → Claude stream
- System prompt is **prompt-cached** — only the transcript changes per call
- Context textarea saves to `customPrompt` preference and is included in every session
