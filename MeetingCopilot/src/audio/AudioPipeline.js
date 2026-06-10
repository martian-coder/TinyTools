'use strict';

const { EventEmitter } = require('events');
const crypto = require('crypto');
const AudioCapture = require('./AudioCapture');
const SileroVAD = require('./SileroVAD');

const SAMPLE_RATE = 16000;
// 16-bit mono PCM: 2 bytes per sample, SAMPLE_RATE samples per second
const BYTES_PER_MS = (SAMPLE_RATE / 1000) * 2; // 32 bytes / ms

const WAITING = 'WAITING';
const SPEAKING = 'SPEAKING';

class AudioPipeline extends EventEmitter {
    constructor(options) {
        super();
        if (!options) options = {};

        this._captureOptions = options.captureOptions || {};
        this._vadOptions = options.vadOptions || {};
        this._cacheDir = options.cacheDir || require('os').tmpdir();
        this._preSpeechBufferMs = options.preSpeechBufferMs !== undefined
            ? options.preSpeechBufferMs : 500;
        this._maxSpeechMs = options.maxSpeechMs !== undefined
            ? options.maxSpeechMs : 45000;
        this._minSpeechMs = options.minSpeechMs !== undefined
            ? options.minSpeechMs : 300;

        this._capture = null;
        this._vad = null;
        this._state = WAITING;

        // Ring buffer holding up to _preSpeechBufferMs of PCM before speech onset.
        // Prepended to every utterance so the first word is never clipped.
        this._preSpeechChunks = [];
        this._preSpeechBytes = 0;
        this._preSpeechMaxBytes = Math.ceil(this._preSpeechBufferMs * BYTES_PER_MS);

        this._speechChunks = [];
        this._consecutiveSpeechFrames = 0;
        this._consecutiveSilenceFrames = 0;
        this._maxSpeechTimer = null;

        // Duplicate-utterance guard: holds the MD5 of the last emitted transcript
        this._lastTranscriptHash = null;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    async start() {
        if (this._vad) throw new Error('AudioPipeline already started — call stop() first');

        this.emit('status', 'Loading VAD model...');

        try {
            this._vad = await SileroVAD.create(this._cacheDir, this._vadOptions);
        } catch (err) {
            this.emit('error', new Error(`Failed to load Silero VAD model: ${err.message}`));
            return;
        }

        this.emit('vad-ready');
        this.emit('status', 'Listening...');

        this._capture = new AudioCapture(this._captureOptions);

        this._capture.on('data', (chunk) => this._onFrame(chunk));
        this._capture.on('error', (err) => this.emit('error', err));
        this._capture.on('close', (code) => {
            if (code !== 0 && code !== null) {
                this.emit('error', new Error(`AudioCapture process exited with code ${code}`));
            }
        });

        try {
            await this._capture.start();
        } catch (err) {
            this.emit('error', new Error(`AudioCapture failed to start: ${err.message}`));
        }
    }

    stop() {
        this._clearMaxSpeechTimer();
        if (this._capture) {
            this._capture.stop();
            this._capture = null;
        }
        this._vad = null;
        this._resetState();
    }

    // Immediately emit whatever speech has been accumulated — useful for a
    // manual push-to-talk hotkey so the user doesn't have to wait for silence.
    forceFlush() {
        if (this._state === SPEAKING && this._speechChunks.length > 0) {
            this._endUtterance();
        }
    }

    // Called by the transcription layer after Whisper returns text.
    setLastTranscript(text) {
        this._lastTranscriptHash = text
            ? crypto.createHash('md5').update(text.trim().toLowerCase()).digest('hex')
            : null;
    }

    // Returns true if the supplied text matches the last emitted transcript,
    // indicating Whisper has repeated itself (common on noise/silence frames).
    isDuplicateTranscript(text) {
        if (!text || !this._lastTranscriptHash) return false;
        const hash = crypto.createHash('md5').update(text.trim().toLowerCase()).digest('hex');
        return hash === this._lastTranscriptHash;
    }

    // ── Frame processing ──────────────────────────────────────────────────────

    async _onFrame(pcm16Buffer) {
        let prob;
        try {
            prob = await this._vad.processFrame(pcm16Buffer);
        } catch (err) {
            this.emit('error', err);
            return;
        }

        const isSpeech = prob >= this._vad.threshold;

        if (this._state === WAITING) {
            // Keep the ring buffer fed even while silent so we always have context
            // leading up to the moment speech is detected.
            this._feedPreSpeechBuffer(pcm16Buffer);

            if (isSpeech) {
                this._consecutiveSpeechFrames++;
                this._consecutiveSilenceFrames = 0;
            } else {
                this._consecutiveSpeechFrames = 0;
            }

            if (this._consecutiveSpeechFrames >= this._vad.minSpeechFrames) {
                this._transitionToSpeaking();
                this._speechChunks.push(Buffer.from(pcm16Buffer));
            }
        } else {
            // SPEAKING
            this._speechChunks.push(Buffer.from(pcm16Buffer));

            if (isSpeech) {
                this._consecutiveSilenceFrames = 0;
                this._consecutiveSpeechFrames++;
            } else {
                this._consecutiveSilenceFrames++;
                this._consecutiveSpeechFrames = 0;
            }

            if (this._consecutiveSilenceFrames >= this._vad.minSilenceFrames) {
                this._endUtterance();
            }
        }
    }

    // ── Internal state machine ────────────────────────────────────────────────

    _feedPreSpeechBuffer(chunk) {
        this._preSpeechChunks.push(Buffer.from(chunk));
        this._preSpeechBytes += chunk.length;

        // Evict oldest chunks to keep the window within its byte budget.
        // Check that removing the oldest chunk still leaves enough remaining bytes
        // (i.e. the total minus the oldest chunk is still >= max). This ensures we
        // keep the buffer as full as possible without exceeding the limit.
        while (
            this._preSpeechChunks.length > 1 &&
            this._preSpeechBytes - this._preSpeechChunks[0].length >= this._preSpeechMaxBytes
        ) {
            this._preSpeechBytes -= this._preSpeechChunks.shift().length;
        }
    }

    _transitionToSpeaking() {
        this._state = SPEAKING;
        this._speechChunks = [];
        this._consecutiveSilenceFrames = 0;
        this.emit('speech-start');
        this.emit('status', 'Speech detected');

        // Safety valve: auto-flush if someone talks non-stop past maxSpeechMs.
        // Without this the pipeline would buffer indefinitely during long monologues.
        this._maxSpeechTimer = setTimeout(() => {
            if (this._state === SPEAKING) {
                this._endUtterance();
            }
        }, this._maxSpeechMs);
    }

    _endUtterance() {
        this._clearMaxSpeechTimer();

        const preSpeech = Buffer.concat(this._preSpeechChunks);
        const speech = Buffer.concat(this._speechChunks);
        const fullAudio = Buffer.concat([preSpeech, speech]);
        const durationMs = fullAudio.length / BYTES_PER_MS;

        this._resetState();
        this.emit('status', 'Listening...');

        if (durationMs < this._minSpeechMs) {
            // Discard sub-threshold bursts (breath sounds, keyboard clicks, etc.)
            return;
        }

        this.emit('speech-end', { audio: fullAudio, durationMs });
    }

    _clearMaxSpeechTimer() {
        if (this._maxSpeechTimer) {
            clearTimeout(this._maxSpeechTimer);
            this._maxSpeechTimer = null;
        }
    }

    _resetState() {
        this._state = WAITING;
        this._speechChunks = [];
        this._consecutiveSpeechFrames = 0;
        this._consecutiveSilenceFrames = 0;
        this._preSpeechChunks = [];
        this._preSpeechBytes = 0;
    }
}

module.exports = AudioPipeline;
