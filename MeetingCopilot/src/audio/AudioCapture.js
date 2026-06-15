const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const os = require('os');

// 512 Int16LE samples = 1024 bytes — exact frame size for Silero VAD
const CHUNK_BYTES = 1024;

// Windows: try WASAPI loopback first (no extra drivers), fall back to dshow
// virtual-audio-capturer (VB-Cable) which requires VB-Audio Virtual Cable.
const WINDOWS_WASAPI_ARGS = [
    '-f', 'wasapi',
    '-i', 'default',       // default loopback output device
    '-loopback', '1',
    '-ar', '16000',
    '-ac', '1',
    '-f', 's16le',
    '-',
];

const WINDOWS_DSHOW_ARGS = [
    '-f', 'dshow',
    '-i', 'audio=virtual-audio-capturer',
    '-ar', '16000',
    '-ac', '1',
    '-f', 's16le',
    '-',
];

class AudioCapture extends EventEmitter {
    constructor() {
        super();
        this._proc = null;
        this._remainder = Buffer.alloc(0);
        this._platform = os.platform();
        this._stderrChunks = [];
        this._windowsFallbackAttempted = false;
    }

    start() {
        if (this._proc) return;
        this._stderrChunks = [];
        this._windowsFallbackAttempted = false;
        this._spawn(this._buildArgs());
    }

    _buildArgs(fallback = false) {
        if (this._platform === 'darwin') {
            // macOS: BlackHole virtual audio device for system audio.
            // Install BlackHole 2ch (free, open-source): https://existential.audio/blackhole/
            return [
                '-f', 'avfoundation',
                '-i', ':BlackHole 2ch',
                '-ar', '16000',
                '-ac', '1',
                '-f', 's16le',
                '-',
            ];
        }

        if (this._platform === 'win32') {
            return fallback ? WINDOWS_DSHOW_ARGS : WINDOWS_WASAPI_ARGS;
        }

        // Linux: PulseAudio / PipeWire monitor source
        return [
            '-f', 'pulse',
            '-i', 'default.monitor',
            '-ar', '16000',
            '-ac', '1',
            '-f', 's16le',
            '-',
        ];
    }

    _spawn(ffmpegArgs) {
        let ffmpegBin;
        try {
            ffmpegBin = require('ffmpeg-static');
        } catch {
            ffmpegBin = 'ffmpeg';
        }

        this._proc = spawn(ffmpegBin, ffmpegArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

        this._proc.stdout.on('data', chunk => this._handleData(chunk));

        this._proc.stderr.on('data', chunk => {
            this._stderrChunks.push(chunk);
        });

        this._proc.on('close', code => {
            const was = this._proc;
            this._proc = null;

            if (!code) {
                this.emit('close', 0);
                return;
            }

            const stderr = Buffer.concat(this._stderrChunks).toString('utf8').slice(-1000);

            // On Windows, WASAPI loopback fails on some systems; fall back once
            // to VB-Cable dshow before giving up.
            if (this._platform === 'win32' && !this._windowsFallbackAttempted) {
                this._windowsFallbackAttempted = true;
                this._stderrChunks = [];
                console.warn('[AudioCapture] WASAPI loopback failed, trying VB-Cable dshow...');
                this._spawn(this._buildArgs(true));
                return;
            }

            let hint = '';
            if (this._platform === 'darwin' && stderr.includes('BlackHole')) {
                hint = '\n\nFix: install BlackHole 2ch (free) → https://existential.audio/blackhole/\nThen set it as your audio output device.';
            } else if (this._platform === 'win32') {
                hint = '\n\nFix: install VB-Cable (free) → https://vb-audio.com/Cable/\nOr check that your audio output device is active.';
            } else if (this._platform === 'linux' && (stderr.includes('pulse') || stderr.includes('monitor'))) {
                hint = '\n\nFix: run `pactl list sources short` to find your monitor source, then set PULSE_SOURCE=<name>.';
            }

            this.emit('error', new Error(`Audio capture failed (exit ${code})${hint}\n\nffmpeg output: ${stderr}`));
            this.emit('close', code);
        });

        this._proc.on('error', err => {
            this._proc = null;
            if (err.code === 'ENOENT') {
                this.emit('error', new Error('ffmpeg not found. Run `npm install` inside MeetingCopilot/ to install the bundled binary.'));
            } else {
                this.emit('error', err);
            }
        });
    }

    stop() {
        if (this._proc) {
            this._proc.kill('SIGTERM');
            this._proc = null;
        }
        this._remainder = Buffer.alloc(0);
        this._stderrChunks = [];
    }

    _handleData(chunk) {
        const combined = Buffer.concat([this._remainder, chunk]);
        let offset = 0;

        while (offset + CHUNK_BYTES <= combined.length) {
            this.emit('data', combined.slice(offset, offset + CHUNK_BYTES));
            offset += CHUNK_BYTES;
        }

        this._remainder = combined.slice(offset);
    }
}

module.exports = { AudioCapture, CHUNK_BYTES };
