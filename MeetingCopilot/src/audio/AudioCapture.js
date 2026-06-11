const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const os = require('os');

// 512 Int16LE samples = 1024 bytes — exact frame size for Silero VAD
const CHUNK_BYTES = 1024;

class AudioCapture extends EventEmitter {
    constructor() {
        super();
        this._proc = null;
        this._remainder = Buffer.alloc(0);
        this._platform = os.platform();
    }

    start() {
        if (this._proc) return;

        let ffmpegArgs;

        if (this._platform === 'darwin') {
            // macOS: BlackHole virtual audio device for system audio
            ffmpegArgs = [
                '-f', 'avfoundation',
                '-i', ':BlackHole 2ch',
                '-ar', '16000',
                '-ac', '1',
                '-f', 's16le',
                '-'
            ];
        } else if (this._platform === 'win32') {
            // Windows: WASAPI loopback
            ffmpegArgs = [
                '-f', 'dshow',
                '-i', 'audio=virtual-audio-capturer',
                '-ar', '16000',
                '-ac', '1',
                '-f', 's16le',
                '-'
            ];
        } else {
            // Linux: PulseAudio monitor source
            ffmpegArgs = [
                '-f', 'pulse',
                '-i', 'default.monitor',
                '-ar', '16000',
                '-ac', '1',
                '-f', 's16le',
                '-'
            ];
        }

        let ffmpegBin;
        try {
            ffmpegBin = require('ffmpeg-static');
        } catch {
            ffmpegBin = 'ffmpeg';
        }

        this._proc = spawn(ffmpegBin, ffmpegArgs, { stdio: ['ignore', 'pipe', 'ignore'] });

        this._proc.stdout.on('data', chunk => this._handleData(chunk));

        this._proc.on('close', code => {
            this._proc = null;
            this.emit('close', code);
        });

        this._proc.on('error', err => {
            this._proc = null;
            this.emit('error', err);
        });
    }

    stop() {
        if (this._proc) {
            this._proc.kill('SIGTERM');
            this._proc = null;
        }
        this._remainder = Buffer.alloc(0);
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
