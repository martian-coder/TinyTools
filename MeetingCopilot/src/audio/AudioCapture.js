'use strict';

const { EventEmitter } = require('events');
const { spawn, exec, execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

// Every 'data' event carries exactly one Silero VAD frame: 512 Int16LE samples
const CHUNK_BYTES = 1024;

function ffmpegBin() {
    return require('ffmpeg-static');
}

function plt() {
    return process.platform;
}

// ── Device discovery ──────────────────────────────────────────────────────────

async function listMacDevices() {
    const ff = ffmpegBin();
    try {
        // ffmpeg -list_devices exits non-zero intentionally; catch and use stderr
        const { stderr } = await execFileAsync(
            ff,
            ['-f', 'avfoundation', '-list_devices', 'true', '-i', ''],
            { timeout: 8000 }
        ).catch((err) => ({ stderr: err.stderr || '' }));
        return stderr.split('\n').filter((l) => l.includes('[AVFoundation'));
    } catch {
        return [];
    }
}

async function listWindowsDirectShowDevices() {
    const ff = ffmpegBin();
    try {
        const { stderr } = await execFileAsync(
            ff,
            ['-f', 'dshow', '-list_devices', 'true', '-i', 'dummy'],
            { timeout: 8000 }
        ).catch((err) => ({ stderr: err.stderr || '' }));
        const names = [];
        for (const line of stderr.split('\n')) {
            const m = line.match(/"([^"]+)"\s+\(audio\)/);
            if (m) names.push(m[1]);
        }
        return names;
    } catch {
        return [];
    }
}

async function listLinuxPulseSources() {
    try {
        const { stdout } = await execAsync('pactl list short sources', { timeout: 5000 });
        return stdout
            .split('\n')
            .map((l) => l.split('\t')[1])
            .filter(Boolean);
    } catch {
        return [];
    }
}

// ── Command builder ───────────────────────────────────────────────────────────

// Returns [binaryPath, argsArray] — loglevel is NOT included here so
// start() can inject it at the front of the final args list.
async function buildCommand(source, sampleRate, channels) {
    const ff = ffmpegBin();
    const outArgs = ['-ar', String(sampleRate), '-ac', String(channels), '-f', 's16le', 'pipe:1'];
    const p = plt();

    if (p === 'darwin') {
        if (source === 'system') {
            const deviceLines = await listMacDevices();
            const hasBlackHole = deviceLines.some((l) => /BlackHole/i.test(l));
            if (hasBlackHole) {
                return [ff, ['-f', 'avfoundation', '-i', 'none:BlackHole 2ch', ...outArgs]];
            }
            // BlackHole is a free virtual audio driver that routes system audio into ffmpeg.
            // Without it macOS blocks loopback capture entirely — there is no native API.
            console.warn(
                '[AudioCapture] WARNING: BlackHole virtual audio driver not found.\n' +
                    'Falling back to default microphone input — system audio will NOT be captured.\n' +
                    'Install BlackHole to enable system audio: https://github.com/ExistentialAudio/BlackHole'
            );
            return [ff, ['-f', 'avfoundation', '-i', 'none:default', ...outArgs]];
        }
        return [ff, ['-f', 'avfoundation', '-i', ':0', ...outArgs]];
    }

    if (p === 'win32') {
        if (source === 'system') {
            const devices = await listWindowsDirectShowDevices();
            const loopback = devices.find((d) => /stereo mix|loopback|what u hear/i.test(d));
            if (loopback) {
                return [ff, ['-f', 'dshow', '-i', `audio=${loopback}`, ...outArgs]];
            }
            // WASAPI loopback (-loopback) is natively supported on Windows 10+ without
            // a separate virtual device driver — prefer it over DirectShow when available.
            return [ff, ['-f', 'wasapi', '-loopback', '-i', 'default', ...outArgs]];
        }
        return [ff, ['-f', 'dshow', '-i', 'audio=Microphone (default)', ...outArgs]];
    }

    if (p === 'linux') {
        if (source === 'system') {
            const sources = await listLinuxPulseSources();
            const monitor = sources.find((s) => s.endsWith('.monitor'));
            // Fall back to a common Intel HDA monitor name if pactl found nothing
            const inputName =
                monitor || 'alsa_output.pci-0000_00_1f.3.analog-stereo.monitor';
            return [ff, ['-f', 'pulse', '-i', inputName, ...outArgs]];
        }
        return [ff, ['-f', 'alsa', '-i', 'default', ...outArgs]];
    }

    throw new Error(`[AudioCapture] Unsupported platform: ${p}`);
}

// ── AudioCapture ──────────────────────────────────────────────────────────────

class AudioCapture extends EventEmitter {
    constructor(options) {
        super();
        if (!options) options = {};
        this._source = options.source || 'system';
        this._sampleRate = options.sampleRate || 16000;
        this._channels = options.channels || 1;
        this._proc = null;
        this._remainder = Buffer.alloc(0);
    }

    static async getAvailableDevices() {
        const p = plt();
        if (p === 'darwin') return listMacDevices();
        if (p === 'win32') return listWindowsDirectShowDevices();
        if (p === 'linux') return listLinuxPulseSources();
        return [];
    }

    async start() {
        if (this._proc) {
            throw new Error('AudioCapture is already running — call stop() before start()');
        }

        const [bin, inputArgs] = await buildCommand(
            this._source,
            this._sampleRate,
            this._channels
        );

        // -loglevel error suppresses ffmpeg's verbose banner while preserving real errors
        const args = ['-loglevel', 'error', ...inputArgs];

        this._proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });

        this._proc.stdout.on('data', (chunk) => this._handleData(chunk));

        this._proc.stderr.on('data', (raw) => {
            const msg = raw.toString().trim();
            if (msg) this.emit('error', new Error(`[AudioCapture] ffmpeg: ${msg}`));
        });

        this._proc.on('close', (code) => {
            this._proc = null;
            this.emit('close', code);
        });

        this._proc.on('error', (err) => {
            this.emit('error', err);
        });
    }

    stop() {
        if (!this._proc) return;
        const proc = this._proc;
        this._proc = null;
        this._remainder = Buffer.alloc(0);

        proc.kill('SIGTERM');

        // ffmpeg normally exits within 1 s on SIGTERM; force-kill if it hangs
        const forceKill = setTimeout(() => {
            try {
                proc.kill('SIGKILL');
            } catch {
                // process already gone
            }
        }, 2000);
        forceKill.unref();
    }

    // Reassemble arbitrary-length OS pipe chunks into exact CHUNK_BYTES slices
    // so every 'data' subscriber receives a complete Silero VAD frame.
    _handleData(incoming) {
        const buf =
            this._remainder.length > 0
                ? Buffer.concat([this._remainder, incoming])
                : incoming;

        let offset = 0;
        while (offset + CHUNK_BYTES <= buf.length) {
            this.emit('data', buf.slice(offset, offset + CHUNK_BYTES));
            offset += CHUNK_BYTES;
        }

        this._remainder =
            offset < buf.length ? buf.slice(offset) : Buffer.alloc(0);
    }
}

module.exports = AudioCapture;
