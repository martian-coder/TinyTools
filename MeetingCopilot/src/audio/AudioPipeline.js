const { EventEmitter } = require('events');
const crypto = require('crypto');

const STATE = { WAITING: 'WAITING', SPEAKING: 'SPEAKING' };

const PRE_SPEECH_MS = 500;          // ring buffer keeps this much audio before speech starts
const MAX_SPEECH_MS = 45000;        // auto-flush long monologues
const SAMPLE_RATE = 16000;
const BYTES_PER_SAMPLE = 2;
const FRAME_BYTES = 1024;           // 512 Int16LE samples
const FRAME_DURATION_MS = (FRAME_BYTES / BYTES_PER_SAMPLE / SAMPLE_RATE) * 1000;

class AudioPipeline extends EventEmitter {
    constructor(vad, options = {}) {
        super();
        this._vad = vad;
        this._state = STATE.WAITING;
        this._speechBuffers = [];
        this._speechMs = 0;
        this._lastTranscriptHash = null;

        const preSpeechFrames = Math.ceil((options.preSpeechMs ?? PRE_SPEECH_MS) / FRAME_DURATION_MS);
        const maxSpeechMs = options.maxSpeechMs ?? MAX_SPEECH_MS;
        this._minSilenceFrames = options.minSilenceFrames ?? 20;
        this._minSpeechFrames = options.minSpeechFrames ?? 3;
        this._maxSpeechMs = maxSpeechMs;
        this._silenceCount = 0;
        this._speechCount = 0;

        // Ring buffer for pre-speech audio
        this._ring = [];
        this._ringMax = preSpeechFrames;
    }

    processFrame(frame) {
        const voiced = this._vad.isVoiced(frame);

        if (this._state === STATE.WAITING) {
            this._ring.push(frame);
            if (this._ring.length > this._ringMax) this._ring.shift();

            if (voiced) {
                this._speechCount++;
                if (this._speechCount >= this._minSpeechFrames) {
                    this._state = STATE.SPEAKING;
                    this._speechBuffers = [...this._ring];
                    this._speechMs = this._ring.length * FRAME_DURATION_MS;
                    this._silenceCount = 0;
                    this._ring = [];
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
        this._lastTranscriptHash = text ? crypto.createHash('md5').update(text.trim().toLowerCase()).digest('hex') : null;
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
        this.emit('utterance', audio);
    }
}

module.exports = { AudioPipeline };
