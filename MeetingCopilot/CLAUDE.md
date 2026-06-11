# Meeting Copilot — Build Plan for Claude Code

> This file lives at `MeetingCopilot/CLAUDE.md` and is the persistent project brief for all Claude Code sessions on this feature.

## What we're building

A **personal, on-screen meeting copilot**. Before a meeting I paste in context (agenda, history, my role, talking points). During the meeting it listens to the *other person's* audio, transcribes it live, and — whenever they finish a thought — generates a suggested reply and streams it to a small always-on-top overlay so I can glance at it while I talk.

This is for my own use. **Do not spend any effort on stealth / undetectability / hiding from screen recording.** That is an explicit non-goal. Optimize for low latency and answer quality instead.

## Phase 0 — Base repo decision (COMPLETE)

**Decision: fork `sohzm/cheating-daddy`.**

See Phase 0 analysis below. Confirmed by user before proceeding.

### Phase 0 analysis

Both repos were evaluated across four axes:

#### cheating-daddy (`sohzm/cheating-daddy`)

| Axis | Implementation |
|------|---------------|
| System audio | macOS: spawns `SystemAudioDump` binary → PCM stream → stereo→mono → 100ms chunks. Windows: loopback. Linux: mic only. |
| STT | **Dual path.** Primary: audio streamed raw to **Gemini Live API** (transcription happens inside Gemini, no separate STT hop). Secondary (localai.js): **local Whisper** via `@huggingface/transformers` with VAD-based chunking — exactly what the plan calls for. |
| LLM | `gemini.js` (Gemini Live streaming), `cloud.js` (Groq), `localai.js` (Ollama via `ollama` npm, streaming). Three files, each self-contained. |
| Overlay | Electron `BrowserWindow`: `transparent`, `alwaysOnTop`, `frame:false`, `setContentProtection(true)`, `setIgnoreMouseEvents()` toggle, `setVisibleOnAllWorkspaces`. Clean and minimal. |
| Runtime deps | **5** (`@google/genai`, `@huggingface/transformers`, `ollama`, `ws`, `electron-squirrel-startup`) |
| License | BUSL-1.1 |

#### Glass (`pickle-com/glass`)

| Axis | Implementation |
|------|---------------|
| System audio | macOS: `startMacOSAudioCapture()` (similar subprocess approach), also mic. Captured as base64 stereo→mono chunks. |
| STT | Cloud-only: Whisper (OpenAI API), Deepgram, Gemini, OpenAI — all via WebSocket. 2-second debounce for turn detection; no local/offline option. |
| LLM | `createStreamingLLM()` factory — supports OpenAI, Anthropic, Gemini, Ollama. Well-abstracted but wrapped in a Next.js/Firebase service layer. |
| Overlay | Electron + **Next.js** + **Firebase** (runtime dependency). Firebase is in `dependencies`, not `devDependencies` — required at runtime. |
| Runtime deps | **19+** including `firebase`, `firebase-admin`, `express`, Anthropic SDK, OpenAI SDK, Next.js |
| License | BUSL-1.1 |

#### Why cheating-daddy wins

1. **System audio is equivalent** on macOS — both spawn a native subprocess. No advantage to Glass.
2. **cheating-daddy already has the local Whisper + VAD path** (localai.js) — this is the exact "whisper-local" STT option the plan calls for. Glass only has cloud STT.
3. **No Firebase.** Glass requires Firebase at runtime — cloud auth/storage for a personal tool that should run fully local. cheating-daddy has zero cloud infrastructure requirements.
4. **5 vs 19 runtime deps.** cheating-daddy's codebase is auditable in an afternoon. Glass's Next.js + Firebase stack adds layers that are friction, not value, for this use case.
5. **Natural seams for provider abstraction.** `gemini.js` / `localai.js` / `cloud.js` map directly to the `LLMProvider` and `STTProvider` interfaces we need to build. Refactoring three files is easier than untangling a Next.js service layer.

Glass's `createStreamingLLM()` factory is more polished, but we're building that abstraction anyway in Phase 2 — we don't need to inherit someone else's version.

---

## Locked-in design decisions (don't re-litigate these)

- **Audio is the primary signal.** Screenshots are optional and off by default — only wire screen capture in if it's trivial to keep.
- **Trigger on end-of-turn, not continuously.** Use voice-activity detection (VAD): when the speaker pauses for ~1 second, fire the model once. Continuous per-word generation is banned (jittery + expensive).
- **Static context goes in the system prompt and is cached.** The live transcript is a rolling window appended as the user message. Never resend the full context on every call.
- **Pluggable providers.** Model and transcription must each sit behind an interface so I can swap implementations from a config file.

## Provider abstractions to build

**LLM provider** (`interface LLMProvider { generate(systemPrompt, transcriptWindow): stream }`):
- `AnthropicProvider` — Messages API, streaming on, **prompt caching** on the static context block, vision support if screenshots are enabled.
- `OllamaProvider` — local, OpenAI-compatible endpoint at `http://localhost:11434/v1`. Configurable model name.

**Transcription provider** (`interface STTProvider { stream(audioChunks): transcriptEvents }`):
- Keep whatever the base repo already uses as one option.
- Add a **local whisper** option (`faster-whisper` as a Python sidecar, or `whisper.cpp`), with VAD-based chunking so it emits text on pauses.

Selection via a `config.json` (or `.env`): `{ llm: "anthropic" | "ollama", stt: "whisper-local" | "<existing>", model: "...", ... }`. API keys from env vars, never hardcoded.

## Build phases (checkpoint after each)

**Phase 1 — Fork & run.** Fork `sohzm/cheating-daddy`, get it building and running locally unchanged. Confirm the overlay appears and basic capture works. Checkpoint.

**Phase 2 — Provider abstraction.** Refactor the hardcoded LLM and STT calls behind the two interfaces above. Wire in `AnthropicProvider` and `OllamaProvider`, switchable via config. Verify both produce output. Checkpoint.

**Phase 3 — Context loading.** Add a way to load my pre-meeting context (a text area in the UI *and* a `context.md` file it reads at session start). This becomes the cached system prompt. Verify the model's answers reflect the loaded context. Checkpoint.

**Phase 4 — System-audio transcription.** Ensure it captures and transcribes the *other person's* audio reliably, maintaining a rolling transcript window (keep ~last 30s, plus a running summary of older turns if it gets long). Show the live transcript somewhere for debugging. Checkpoint.

**Phase 5 — The trigger loop (the core feature).** Implement VAD-based end-of-turn detection → on ~1s pause, send `systemPrompt (cached) + transcriptWindow` to the LLM → stream the suggested reply to the overlay. Add a manual hotkey to force-generate on demand. Checkpoint.

**Phase 6 — Overlay UX polish.** Suggested reply shows a one-line gist first, with fuller detail below. Hotkeys to show/hide the overlay and to force-generate. Keep it readable at a glance. Checkpoint.

## Acceptance criteria

- I paste context, join a test call, and the other person's speech appears as live transcript.
- When they pause, a relevant suggested reply streams to the overlay within a couple of seconds.
- I can switch between Claude API and local Ollama by editing one config value.
- No secrets in source; everything stealth-related is absent by design.

## Notes & gotchas

- **Latency:** local Ollama (vision + generation) may feel laggy without a strong GPU. A good hybrid is **local whisper for transcription + Claude API for generation**. Build it so this combo is possible.
- **Prompt caching** on the static context block is the single biggest latency/cost win for the Anthropic path — make sure it's actually applied, not just intended.
- **Permissions:** macOS needs Screen Recording + Microphone permissions for system-audio capture; surface a clear setup step if missing.
- Work in small commits. After each phase, summarize what changed and how to test it.
- **Base repo location:** `sohzm/cheating-daddy` (BUSL-1.1). The fork will live at `MeetingCopilot/` in this repo.
