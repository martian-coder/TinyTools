#!/usr/bin/env node

'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const { program } = require('commander');

// ── ANSI helpers (no external dep) ──────────────────────────────────────────
const dim    = s => `\x1b[2m${s}\x1b[0m`;
const bold   = s => `\x1b[1m${s}\x1b[0m`;
const cyan   = s => `\x1b[36m${s}\x1b[0m`;
const green  = s => `\x1b[32m${s}\x1b[0m`;
const yellow = s => `\x1b[33m${s}\x1b[0m`;
const hr     = () => dim('─'.repeat(60));

// ── VAD (VERY_AGGRESSIVE mode) ───────────────────────────────────────────────
const VAD = { energyThreshold: 0.02, speechFramesRequired: 2, silenceFramesRequired: 15 };

// ── Audio constants ──────────────────────────────────────────────────────────
const SAMPLE_RATE_IN = 24000;
const CHUNK_BYTES    = Math.floor(SAMPLE_RATE_IN * 0.1) * 2; // 100 ms of 16-bit mono

// ── CLI definition ───────────────────────────────────────────────────────────
program
    .name('meeting-copilot')
    .description('AI meeting assistant — listens, transcribes with Whisper, suggests replies with Claude')
    .version('1.0.0');

program
    .command('start', { isDefault: true })
    .description('Start a meeting session')
    .option('-k, --key <key>',             'Anthropic API key (or ANTHROPIC_API_KEY env var)')
    .option('-m, --model <model>',         'Claude model', 'claude-sonnet-4-6')
    .option('-c, --context <path>',        'Pre-meeting context: text string or path to a .md/.txt file')
    .option('-p, --profile <name>',        'Profile: interview | meeting | sales | presentation | negotiation', 'meeting')
    .option('-w, --whisper <model>',       'Whisper model', 'Xenova/whisper-small')
    .option('--mic',                       'Capture microphone (default on non-macOS; forced on Android/Termux)')
    .option('--loopback <device>',         'Linux PulseAudio/PipeWire monitor source for system audio (e.g. alsa_output.pci.analog-stereo.monitor)')
    .option('--serve [port]',              'Serve a live web overlay on <port> (default 3001) — open on Android/tablet browser')
    .option('--lang <code>',               'Force a specific language for transcription, e.g. en, fr, zh (disables auto-translate)')
    .action(run);

program.parse();

// ── SSE broadcast ────────────────────────────────────────────────────────────
let sseClients = [];

function broadcast(event, data) {
    if (sseClients.length === 0) return;
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    sseClients.forEach(c => { try { c.write(msg); } catch { /* ignore closed */ } });
}

// ── Web overlay HTML (served to browsers / Android) ─────────────────────────
function overlayHtml() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Meeting Copilot</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0d0d0d;color:#e8e8e8;font-family:system-ui,-apple-system,sans-serif;padding:16px;min-height:100vh}
  #header{display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:1px solid #1e1e1e;margin-bottom:12px}
  #title{font-size:13px;font-weight:600;color:#aaa;letter-spacing:.5px;text-transform:uppercase}
  #dot{width:7px;height:7px;border-radius:50%;background:#3f7de5;animation:pulse 2s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
  #transcript{margin-bottom:12px}
  .heard-label{font-size:10px;color:#3f7de5;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
  .t-line{font-size:12px;color:#555;padding:2px 0;line-height:1.4}
  .t-line:last-child{color:#888}
  #response{font-size:15px;line-height:1.65;white-space:pre-wrap;word-break:break-word;min-height:60px}
  #status{margin-top:14px;font-size:11px;color:#333}
  #status.active{color:#555}
</style>
</head>
<body>
<div id="header"><span id="title">Meeting Copilot</span><div id="dot"></div></div>
<div id="transcript"><div class="heard-label">Heard</div><div id="t-lines"></div></div>
<div id="response"></div>
<div id="status">Connecting…</div>
<script>
const resp   = document.getElementById('response');
const tLines = document.getElementById('t-lines');
const status = document.getElementById('status');

const es = new EventSource('/events');

es.addEventListener('transcript', e => {
  const { text } = JSON.parse(e.data);
  const nodes = tLines.querySelectorAll('.t-line');
  if (nodes.length >= 3) nodes[0].remove();
  const el = document.createElement('div');
  el.className = 't-line';
  el.textContent = '"' + text + '"';
  tLines.appendChild(el);
});

es.addEventListener('response-start', () => {
  resp.textContent = '';
  status.textContent = 'Responding…';
  status.className = 'active';
});

es.addEventListener('response-chunk', e => {
  resp.textContent += JSON.parse(e.data).text;
  window.scrollTo(0, document.body.scrollHeight);
});

es.addEventListener('response-done', e => {
  const { footer } = JSON.parse(e.data);
  status.textContent = footer + '  ·  Listening…';
  status.className = '';
});

es.onopen  = () => { status.textContent = 'Listening…'; status.className = ''; };
es.onerror = () => { status.textContent = 'Reconnecting…'; status.className = ''; };
</script>
</body>
</html>`;
}

// ── Local IP helper ──────────────────────────────────────────────────────────
function localIp() {
    const nets = os.networkInterfaces();
    for (const iface of Object.values(nets)) {
        for (const entry of iface) {
            if (entry.family === 'IPv4' && !entry.internal) return entry.address;
        }
    }
    return 'localhost';
}

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

    // ── Optional web server ──────────────────────────────────────────────────
    if (opts.serve !== undefined) {
        const port = (opts.serve && /^\d+$/.test(String(opts.serve))) ? Number(opts.serve) : 3001;
        const ip   = localIp();
        const server = http.createServer((req, res) => {
            if (req.url === '/events') {
                res.writeHead(200, {
                    'Content-Type':                'text/event-stream',
                    'Cache-Control':               'no-cache',
                    'Connection':                  'keep-alive',
                    'Access-Control-Allow-Origin': '*',
                });
                res.write('retry: 3000\n\n');
                sseClients.push(res);
                req.on('close', () => { sseClients = sseClients.filter(c => c !== res); });
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(overlayHtml());
            }
        });
        server.listen(port, '0.0.0.0', () => {
            console.log(green(`✓ Web overlay at http://${ip}:${port}`));
            console.log(dim(`  Open this URL on your phone/tablet (same WiFi)\n`));
        });
    }

    // Load Whisper
    process.stdout.write('Loading Whisper model (first run downloads ~250 MB)… ');
    const pipe = await loadWhisper(opts.whisper);
    if (opts.lang) pipe._lang = opts.lang; // store for transcribe()
    console.log(green('ready'));
    if (opts.lang) {
        console.log(dim(`Language locked: ${opts.lang} (transcribe only, no translation)`));
    } else {
        console.log(dim('Multilingual mode: any language → English'));
    }

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

        const heard = text.trim();
        console.log(hr());
        console.log(cyan('Heard: ') + `"${heard}"`);
        console.log(hr());
        process.stdout.write('\n');

        broadcast('transcript', { text: heard });

        history.push({ role: 'user', content: heard });
        if (history.length > 20) history = history.slice(-20);

        broadcast('response-start', {});

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
                    broadcast('response-chunk', { text: event.delta.text });
                }
            }

            const final  = await stream.finalMessage();
            const cached = final.usage?.cache_read_input_tokens ?? 0;
            const footer = `cache:${cached > 0 ? '✓' : '—'}  in:${final.usage.input_tokens}  out:${final.usage.output_tokens}`;
            process.stdout.write(`\n\n${dim(`[${footer}]`)}\n`);
            broadcast('response-done', { footer });

            if (full.trim()) history.push({ role: 'assistant', content: full.trim() });
        } catch (err) {
            console.error(yellow(`\nClaude error: ${err.message}`));
        }

        console.log('\n' + dim('Listening…') + '\n');
        busy = false;
    }

    startAudio(opts, onSpeechEnd);
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
        // No language forced → translate task: any language in, English out.
        // --lang set → transcribe in that language without translation.
        const taskOpts = pipe._lang
            ? { task: 'transcribe', language: pipe._lang }
            : { task: 'translate' };
        const result = await pipe(f32, { sampling_rate: 16000, ...taskOpts });
        return result.text?.trim() ?? '';
    } catch {
        return '';
    }
}

// ── Resample 24 kHz → 16 kHz (linear interpolation) ─────────────────────────
function resample(input, remainder) {
    const combined  = Buffer.concat([remainder, input]);
    const inSamples = Math.floor(combined.length / 2);
    const outSamples = Math.floor((inSamples * 2) / 3);
    const out = Buffer.alloc(outSamples * 2);

    for (let i = 0; i < outSamples; i++) {
        const pos  = (i * 3) / 2;
        const idx  = Math.floor(pos);
        const frac = pos - idx;
        const s0   = combined.readInt16LE(idx * 2);
        const s1   = idx + 1 < inSamples ? combined.readInt16LE((idx + 1) * 2) : s0;
        out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(s0 + frac * (s1 - s0)))), i * 2);
    }

    const consumed     = Math.ceil((outSamples * 3) / 2);
    const newRemainder = consumed * 2 < combined.length ? combined.slice(consumed * 2) : Buffer.alloc(0);
    return { out, remainder: newRemainder };
}

// ── Audio capture ─────────────────────────────────────────────────────────────
function buildAudioProc(opts) {
    const isMac   = process.platform === 'darwin';
    const isWin   = process.platform === 'win32';
    const isLinux = process.platform === 'linux';

    // ── macOS system audio ───────────────────────────────────────────────────
    if (isMac && !opts.mic) {
        const bin = path.join(__dirname, 'src/assets/SystemAudioDump');
        if (!fs.existsSync(bin)) {
            console.error(
                'SystemAudioDump binary not found at src/assets/SystemAudioDump.\n' +
                'Run with --mic to capture from microphone instead.'
            );
            process.exit(1);
        }
        return {
            proc:  spawn(bin, [], { stdio: ['ignore', 'pipe', 'ignore'] }),
            label: 'System audio (macOS)',
        };
    }

    // ── Windows system audio — ffmpeg WASAPI loopback ────────────────────────
    if (isWin && !opts.mic) {
        const args = [
            '-f', 'wasapi', '-loopback', '-i', 'default',
            '-ar', '24000', '-ac', '1', '-f', 's16le', 'pipe:1',
        ];
        return {
            proc:    spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] }),
            label:   'System audio (Windows WASAPI)',
            isWin:   true,
        };
    }

    // ── Linux system audio — PulseAudio / PipeWire monitor ───────────────────
    if (isLinux && !opts.mic) {
        const device = opts.loopback; // e.g. alsa_output.xxx.monitor
        const args   = [
            '--channels=1', '--rate=24000', '--format=s16le', '--raw',
            ...(device ? [`--device=${device}`] : []),
        ];
        return {
            proc:    spawn('parecord', args, { stdio: ['ignore', 'pipe', 'pipe'] }),
            label:   device ? `System audio (${device})` : 'System audio (default PulseAudio/PipeWire monitor)',
            isLinux: true,
        };
    }

    // ── Mic via sox — all platforms (also Termux / Android) ──────────────────
    return {
        proc:  spawn('rec', ['-r', '24000', '-c', '1', '-e', 'signed-integer', '-b', '16', '-t', 'raw', '-'], {
            stdio: ['ignore', 'pipe', 'pipe'],
        }),
        label: 'Microphone (sox)',
    };
}

function startAudio(opts, onSpeechEnd) {
    const isWin   = process.platform === 'win32';
    const isLinux = process.platform === 'linux';

    const { proc, label, isWin: winAudio, isLinux: linuxAudio } = buildAudioProc(opts);

    if (proc.stderr) proc.stderr.on('data', () => {}); // silence sox/ffmpeg/parecord warnings

    proc.on('error', err => {
        if (err.code === 'ENOENT') {
            if (winAudio) {
                console.error(
                    '\nAudio capture failed: ffmpeg not found.\n' +
                    'Install ffmpeg for Windows system audio:\n' +
                    '  winget install Gyan.FFmpeg\n' +
                    '  or: choco install ffmpeg\n' +
                    'Then retry.  Or add --mic to use the microphone instead.'
                );
            } else if (linuxAudio) {
                console.error(
                    '\nAudio capture failed: parecord not found.\n' +
                    'Install PulseAudio utils:  apt install pulseaudio-utils\n' +
                    'Then list monitor sources: pactl list sources short\n' +
                    'Pass the monitor name:     --loopback <name>\n' +
                    'Or use microphone:         --mic'
                );
            } else if (isWin) {
                console.error('\nMicrophone capture failed: sox not found.\n  choco install sox  or  scoop install sox');
            } else if (isLinux) {
                console.error('\nMicrophone capture failed: sox not found.\n  apt install sox  or  dnf install sox');
            } else {
                console.error('\nAudio capture failed: command not found.\n  brew install sox  or  apt install sox');
            }
        } else {
            console.error('\nAudio capture error:', err.message);
        }
        process.exit(1);
    });

    console.log(green(`✓ ${label} started`));

    // VAD state
    let speaking = false, speechCount = 0, silenceCount = 0;
    let speechBuffers = [], rawBuf = Buffer.alloc(0), rem = Buffer.alloc(0);

    console.log(dim('Listening…\n'));

    proc.stdout.on('data', chunk => {
        rawBuf = Buffer.concat([rawBuf, chunk]);

        while (rawBuf.length >= CHUNK_BYTES) {
            const raw = rawBuf.slice(0, CHUNK_BYTES);
            rawBuf    = rawBuf.slice(CHUNK_BYTES);

            const { out: pcm16k, remainder: newRem } = resample(raw, rem);
            rem = newRem;
            if (pcm16k.length === 0) continue;

            // RMS energy
            const n = pcm16k.length / 2;
            let sq = 0;
            for (let i = 0; i < n; i++) { const s = pcm16k.readInt16LE(i * 2) / 32768; sq += s * s; }
            const rms    = Math.sqrt(sq / n);
            const voiced = rms > VAD.energyThreshold;

            if (voiced) {
                speechCount++;
                silenceCount = 0;
                if (!speaking && speechCount >= VAD.speechFramesRequired) {
                    speaking      = true;
                    speechBuffers = [];
                }
            } else {
                silenceCount++;
                speechCount = 0;
                if (speaking && silenceCount >= VAD.silenceFramesRequired) {
                    speaking = false;
                    const audio = Buffer.concat(speechBuffers);
                    speechBuffers = [];
                    if (audio.length >= 16000) onSpeechEnd(audio);
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
