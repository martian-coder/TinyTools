const { EventEmitter } = require('events');
const crypto = require('crypto');
const { AudioCapture } = require('./AudioCapture');
const { SileroVAD } = require('./SileroVAD');

const STATE = { WAITING: 'WAITING', SPEAKING: 'SPEAKING' };

const SAMPLE_RATE = 16000;
const BYTES_PER_SAMPLE = 2;
const FRAME_BYTES = 1024;            // 512 Int16LE samples — exact Silero VAD frame
const FRAME_DURATION_MS = (FRAME_BYTES / BYTES_PER_SAMPLE / SAMPLE_RATE) * 1000; // 32ms

const DEFAULT_PRE_SPEECH_MS = 500;   // ring buffer kept before speech onset
const DEFAULT_MAX_SPEECH_MS = 45000; // auto-flush long monologues
const DEFAULT_MIN_SPEECH_MS = 96;    // ~3 frames before we trust it's speech
const DEFAULT_MIN_SILENCE_MS = 640;  // ~0.64s pause ends a turn

// Cap the pending-frame queue so a slow VAD inference can never grow memory
// without bound; at 32ms/frame this is ~12s of backlog before we drop oldest.
const MAX_QUEUE_FRAMES = 375;

// Self-contained capture → VAD → utterance pipeline. Owns its own 16kHz mono
// ffmpeg capture (AudioCapture) and Silero VAD; callers just listen for events.
class AudioPipeline extends EventEmitter {
    constructor(options = {}) {
        super();

        const preSpeechMs = options.preSpeechBufferMs ?? options.preSpeechMs ?? DEFAULT_PRE_SPEECH_MS;
        const maxSpeechMs = options.maxSpeechMs ?? DEFAULT_MAX_SPEECH_MS;
        const minSpeechMs = options.minSpeechMs ?? DEFAULT_MIN_SPEECH_MS;
        const minSilenceMs = options.minSilenceMs ?? DEFAULT_MIN_SILENCE_MS;

        this._ringMax = Math.max(1, Math.ceil(preSpeechMs / FRAME_DURATION_MS));
        this._maxSpeechMs = maxSpeechMs;
        this._minSpeechFrames = Math.max(1, Math.round(minSpeechMs / FRAME_DURATION_MS));
        this._minSilenceFrames = Math.max(1, Math.round(minSilenceMs / FRAME_DURATION_MS));

        this._vad = new SileroVAD({ threshold: options.vadThreshold ?? 0.5 });
        this._capture = new AudioCapture();

        this._state = STATE.WAITING;
        this._ring = [];
        this._speechBuffers = [];
        this._speechMs = 0;
        this._silenceCount = 0;
        this._speechCount = 0;
        this._lastTranscriptHash = null;

        // Frames arrive synchronously from capture but VAD inference is async,
        // so we serialize frames through a queue and process strictly in order.
        this._queue = [];
        this._draining = false;
        this._running = false;
    }

    async start() {
        if (this._running) return;

        this.emit('status', 'Loading audio model...');
        await this._vad.load();
        this.emit('vad-ready');

        this._capture.on('data', frame => {
            this._queue.push(frame);
            if (this._queue.length > MAX_QUEUE_FRAMES) this._queue.shift();
            this._drain();
        });
        this._capture.on('error', err => this.emit('error', err));
        this._capture.on('close', code => {
            if (this._running && code) {
                this.emit('error', new Error(`Audio capture exited with code ${code}`));
            }
        });

        this._running = true;
        this._capture.start();
        this.emit('status', 'Listening...');
    }

    stop() {
        this._running = false;
        this._capture.stop();
        this._queue = [];
        this._ring = [];
        this._speechBuffers = [];
        this._state = STATE.WAITING;
        this._speechMs = 0;
        this._silenceCount = 0;
        this._speechCount = 0;
    }

    async _drain() {
        if (this._draining) return;
        this._draining = true;
        try {
            while (this._running && this._queue.length > 0) {
                const frame = this._queue.shift();
                let voiced = false;
                try {
                    voiced = await this._vad.isVoicedAsync(frame);
                } catch (err) {
                    this.emit('error', err);
                    continue;
                }
                this._processFrame(frame, voiced);
            }
        } finally {
            this._draining = false;
        }
    }

    _processFrame(frame, voiced) {
        if (this._state === STATE.WAITING) {
            this._ring.push(frame);
            if (this._ring.length > this._ringMax) this._ring.shift();

            if (voiced) {
                this._speechCount++;
                if (this._speechCount >= this._minSpeechFrames) {
                    this._state = STATE.SPEAKING;
                    this._speechBuffers = this._ring.slice();
                    this._speechMs = this._ring.length * FRAME_DURATION_MS;
                    this._silenceCount = 0;
                    this._ring = [];
                    this.emit('speech-start');
                }
            } else {
                this._speechCount = 0;
            }
        } else {
            this._speechBuffers.push(frame);
            this._speechMs += FRAME_DURATION_MS;

            if (voiced) {
                this._silenceCount = 0;
            } else {
                this._silenceCount++;
                if (this._silenceCount >= this._minSilenceFrames || this._speechMs >= this._maxSpeechMs) {
                    this._flush();
                }
            }
        }
    }

    forceFlush() {
        if (this._state === STATE.SPEAKING && this._speechBuffers.length > 0) {
            this._flush();
        }
    }

    setLastTranscript(text) {
        this._lastTranscriptHash = text
            ? crypto.createHash('md5').update(text.trim().toLowerCase()).digest('hex')
            : null;
    }

    isDuplicateTranscript(text) {
        if (!text || !this._lastTranscriptHash) return false;
        const hash = crypto.createHash('md5').update(text.trim().toLowerCase()).digest('hex');
        return hash === this._lastTranscriptHash;
    }

    _flush() {
        const audio = Buffer.concat(this._speechBuffers);
        this._state = STATE.WAITING;
        this._speechBuffers = [];
        this._speechMs = 0;
        this._silenceCount = 0;
        this._speechCount = 0;
        this.emit('speech-end', { audio });
    }
}

module.exports = { AudioPipeline };
