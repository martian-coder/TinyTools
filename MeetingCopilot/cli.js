#!/usr/bin/env node

'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawn } = require('child_process');
const { program } = require('commander');

// ── ANSI helpers (no external dep) ──────────────────────────────────────────
const dim = s => `\x1b[2m${s}\x1b[0m`;
const bold = s => `\x1b[1m${s}\x1b[0m`;
const cyan = s => `\x1b[36m${s}\x1b[0m`;
const green = s => `\x1b[32m${s}\x1b[0m`;
const yellow = s => `\x1b[33m${s}\x1b[0m`;
const hr = () => dim('─'.repeat(60));

// ── VAD (same thresholds as the desktop app's VERY_AGGRESSIVE mode) ─────────
const VAD = { energyThreshold: 0.02, speechFramesRequired: 2, silenceFramesRequired: 15 };

// ── Audio constants ──────────────────────────────────────────────────────────
const SAMPLE_RATE_IN = 24000;   // SystemAudioDump / sox output rate
const CHUNK_BYTES = Math.floor(SAMPLE_RATE_IN * 0.1) * 2; // 100 ms of 16-bit mono

// ── CLI definition ───────────────────────────────────────────────────────────
program
    .name('meeting-copilot')
    .description('AI meeting assistant — listens, transcribes with Whisper, suggests replies with Claude')
    .version('1.0.0');

program
    .command('start', { isDefault: true })
    .description('Start a meeting session')
    .option('-k, --key <key>',      'Anthropic API key (or ANTHROPIC_API_KEY env var)')
    .option('-m, --model <model>',  'Claude model', 'claude-sonnet-4-6')
    .option('-c, --context <path>', 'Pre-meeting context: text string or path to a .md/.txt file')
    .option('-p, --profile <name>', 'Profile: interview | meeting | sales | presentation | negotiation', 'meeting')
    .option('-w, --whisper <model>','Whisper model', 'Xenova/whisper-small')
    .option('--mic',                'Capture microphone instead of system audio (default on non-macOS)')
    .action(run);

program.parse();

// ── Main ─────────────────────────────────────────────────────────────────────
async function run(opts) {
    const apiKey = opts.key || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        console.error('Error: Anthropic API key required.\n  Pass --key <key>  or  set ANTHROPIC_API_KEY.');
        process.exit(1);
    }

    // Resolve context
    let context = '';
    if (opts.context) {
        if (fs.existsSync(opts.context)) {
            context = fs.readFileSync(opts.context, 'utf8').trim();
            console.log(dim(`Context loaded from: ${opts.context}`));
        } else {
            context = opts.context.trim();
        }
    }

    console.log(`\n${bold('Meeting Copilot')}`);
    console.log(dim(`Model: ${opts.model}  |  Whisper: ${opts.whisper}  |  Profile: ${opts.profile}`));
    if (context) console.log(dim(`Context: "${context.slice(0, 90)}${context.length > 90 ? '…' : ''}"`));
    console.log();

    // Load Whisper
    process.stdout.write('Loading Whisper model (first run downloads ~250 MB)… ');
    const pipe = await loadWhisper(opts.whisper);
    console.log(green('ready'));

    // Claude client + system prompt
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey });
    const { getSystemPrompt } = require('./src/utils/prompts');
    const systemPrompt = getSystemPrompt(opts.profile, context, false);
    let history = [];

    console.log(green('✓ Claude API ready'));
    console.log(dim('Ctrl+C to quit\n'));

    // Speech handler
    let busy = false;
    async function onSpeechEnd(pcm16kBuffer) {
        if (busy) return;
        busy = true;

        const text = await transcribe(pipe, pcm16kBuffer);
        if (!text || text.trim().length < 2) { busy = false; return; }

        console.log(hr());
        console.log(cyan('Heard: ') + `"${text.trim()}"`);
        console.log(hr());
        process.stdout.write('\n');

        history.push({ role: 'user', content: text.trim() });
        if (history.length > 20) history = history.slice(-20);

        try {
            const stream = client.messages.stream({
                model: opts.model,
                max_tokens: 1024,
                system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
                messages: history,
            });

            let full = '';
            for await (const event of stream) {
                if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                    process.stdout.write(event.delta.text);
                    full += event.delta.text;
                }
            }

            const final = await stream.finalMessage();
            const cached = final.usage?.cache_read_input_tokens ?? 0;
            const footer = `cache:${cached > 0 ? '✓' : '—'}  in:${final.usage.input_tokens}  out:${final.usage.output_tokens}`;
            process.stdout.write(`\n\n${dim(`[${footer}]`)}\n`);

            if (full.trim()) history.push({ role: 'assistant', content: full.trim() });
        } catch (err) {
            console.error(yellow(`\nClaude error: ${err.message}`));
        }

        console.log('\n' + dim('Listening…') + '\n');
        busy = false;
    }

    startAudio(opts.mic, onSpeechEnd);
}

// ── Whisper ──────────────────────────────────────────────────────────────────
async function loadWhisper(modelName) {
    try {
        const { pipeline, env } = await import('@huggingface/transformers');
        env.cacheDir = path.join(os.homedir(), '.meeting-copilot', 'whisper-models');
        return await pipeline('automatic-speech-recognition', modelName, { dtype: 'q8', device: 'auto' });
    } catch (err) {
        console.error('\nFailed to load Whisper:', err.message);
        process.exit(1);
    }
}

async function transcribe(pipe, pcm16kBuffer) {
    try {
        const samples = pcm16kBuffer.length / 2;
        const f32 = new Float32Array(samples);
        for (let i = 0; i < samples; i++) f32[i] = pcm16kBuffer.readInt16LE(i * 2) / 32768;
        const result = await pipe(f32, { sampling_rate: 16000, language: 'en', task: 'transcribe' });
        return result.text?.trim() ?? '';
    } catch {
        return '';
    }
}

// ── Resample 24 kHz → 16 kHz (linear interpolation) ─────────────────────────
function resample(input, remainder) {
    const combined = Buffer.concat([remainder, input]);
    const inSamples = Math.floor(combined.length / 2);
    const outSamples = Math.floor((inSamples * 2) / 3);
    const out = Buffer.alloc(outSamples * 2);

    for (let i = 0; i < outSamples; i++) {
        const pos = (i * 3) / 2;
        const idx = Math.floor(pos);
        const frac = pos - idx;
        const s0 = combined.readInt16LE(idx * 2);
        const s1 = idx + 1 < inSamples ? combined.readInt16LE((idx + 1) * 2) : s0;
        out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(s0 + frac * (s1 - s0)))), i * 2);
    }

    const consumed = Math.ceil((outSamples * 3) / 2);
    const newRemainder = consumed * 2 < combined.length ? combined.slice(consumed * 2) : Buffer.alloc(0);
    return { out, remainder: newRemainder };
}

// ── Audio capture ─────────────────────────────────────────────────────────────
function startAudio(useMic, onSpeechEnd) {
    const isMac = process.platform === 'darwin';
    let proc;

    if (isMac && !useMic) {
        const bin = path.join(__dirname, 'src/assets/SystemAudioDump');
        if (!fs.existsSync(bin)) {
            console.error(
                'SystemAudioDump binary not found at src/assets/SystemAudioDump.\n' +
                'Run with --mic to capture from microphone instead.'
            );
            process.exit(1);
        }
        proc = spawn(bin, [], { stdio: ['ignore', 'pipe', 'ignore'] });
        console.log(green('✓ System audio capture started (macOS)'));
    } else {
        // sox must be installed: brew install sox  /  apt install sox
        proc = spawn('rec', ['-r', '24000', '-c', '1', '-e', 'signed-integer', '-b', '16', '-t', 'raw', '-'], {
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        proc.stderr?.on('data', () => {}); // silence sox warnings
        console.log(green(`✓ Microphone capture started`));
    }

    proc.on('error', err => {
        if (err.code === 'ENOENT') {
            const hint = (!isMac || useMic) ? 'Install sox: brew install sox  or  apt install sox' : '';
            console.error(`\nAudio capture failed: command not found. ${hint}`);
        } else {
            console.error('\nAudio capture error:', err.message);
        }
        process.exit(1);
    });

    // VAD state
    let speaking = false, speechCount = 0, silenceCount = 0;
    let speechBuffers = [], rawBuf = Buffer.alloc(0), rem = Buffer.alloc(0);

    console.log(dim('Listening…\n'));

    proc.stdout.on('data', chunk => {
        rawBuf = Buffer.concat([rawBuf, chunk]);

        while (rawBuf.length >= CHUNK_BYTES) {
            const raw = rawBuf.slice(0, CHUNK_BYTES);
            rawBuf = rawBuf.slice(CHUNK_BYTES);

            const { out: pcm16k, remainder: newRem } = resample(raw, rem);
            rem = newRem;
            if (pcm16k.length === 0) continue;

            // RMS energy
            const n = pcm16k.length / 2;
            let sq = 0;
            for (let i = 0; i < n; i++) { const s = pcm16k.readInt16LE(i * 2) / 32768; sq += s * s; }
            const rms = Math.sqrt(sq / n);
            const voiced = rms > VAD.energyThreshold;

            if (voiced) {
                speechCount++;
                silenceCount = 0;
                if (!speaking && speechCount >= VAD.speechFramesRequired) {
                    speaking = true;
                    speechBuffers = [];
                }
            } else {
                silenceCount++;
                speechCount = 0;
                if (speaking && silenceCount >= VAD.silenceFramesRequired) {
                    speaking = false;
                    const audio = Buffer.concat(speechBuffers);
                    speechBuffers = [];
                    if (audio.length >= 16000) onSpeechEnd(audio); // ~0.5 s minimum
                    return;
                }
            }

            if (speaking) speechBuffers.push(Buffer.from(pcm16k));
        }
    });

    process.on('SIGINT', () => {
        proc.kill();
        console.log('\nSession ended.');
        process.exit(0);
    });
}
