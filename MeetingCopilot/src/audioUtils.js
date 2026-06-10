'use strict';

// PCM utility functions — 16-bit signed LE throughout.

/**
 * Stereo Int16LE → mono Int16LE by averaging both channels.
 * More faithful than dropping one channel (avoids DC offset asymmetry).
 */
function stereoToMono(stereo) {
    const samples = Math.floor(stereo.length / 4);
    const mono = Buffer.allocUnsafe(samples * 2);
    for (let i = 0; i < samples; i++) {
        const L = stereo.readInt16LE(i * 4);
        const R = stereo.readInt16LE(i * 4 + 2);
        mono.writeInt16LE(Math.round((L + R) / 2), i * 2);
    }
    return mono;
}

/**
 * Linear interpolation resample for Int16LE PCM.
 * Works well for small ratio changes (e.g. 24 kHz → 16 kHz).
 * Maintains a remainder buffer between calls so you can stream it.
 */
class PCMResampler {
    constructor(inRate, outRate) {
        this.ratio = outRate / inRate;
        this._remainder = Buffer.alloc(0);
    }

    process(input) {
        const combined = Buffer.concat([this._remainder, input]);
        const inSamples = Math.floor(combined.length / 2);
        const outSamples = Math.floor(inSamples * this.ratio);
        const out = Buffer.allocUnsafe(outSamples * 2);

        for (let i = 0; i < outSamples; i++) {
            const srcPos = i / this.ratio;
            const srcIdx = Math.floor(srcPos);
            const frac = srcPos - srcIdx;
            const s0 = combined.readInt16LE(srcIdx * 2);
            const s1 = srcIdx + 1 < inSamples ? combined.readInt16LE((srcIdx + 1) * 2) : s0;
            out.writeInt16LE(Math.round(s0 + frac * (s1 - s0)), i * 2);
        }

        const consumed = Math.ceil(outSamples / this.ratio);
        this._remainder = consumed * 2 < combined.length
            ? combined.slice(consumed * 2)
            : Buffer.alloc(0);

        return out;
    }

    reset() {
        this._remainder = Buffer.alloc(0);
    }
}

/** RMS energy of an Int16LE buffer, normalised to 0-1. */
function rms(buf) {
    const n = Math.floor(buf.length / 2);
    if (n === 0) return 0;
    let sum = 0;
    for (let i = 0; i < n; i++) {
        const s = buf.readInt16LE(i * 2) / 32768;
        sum += s * s;
    }
    return Math.sqrt(sum / n);
}

/** Convert an Int16LE buffer to Float32Array in [-1, 1]. */
function toFloat32(pcm16) {
    const n = Math.floor(pcm16.length / 2);
    const f32 = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        f32[i] = pcm16.readInt16LE(i * 2) / 32768;
    }
    return f32;
}

/** Write a minimal WAV file. Useful for debug playback. */
function toWav(pcm16, sampleRate = 16000, channels = 1) {
    const byteRate = sampleRate * channels * 2;
    const buf = Buffer.allocUnsafe(44 + pcm16.length);
    buf.write('RIFF', 0);
    buf.writeUInt32LE(36 + pcm16.length, 4);
    buf.write('WAVE', 8);
    buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);       // PCM
    buf.writeUInt16LE(channels, 22);
    buf.writeUInt32LE(sampleRate, 24);
    buf.writeUInt32LE(byteRate, 28);
    buf.writeUInt16LE(channels * 2, 32);
    buf.writeUInt16LE(16, 34);
    buf.write('data', 36);
    buf.writeUInt32LE(pcm16.length, 40);
    pcm16.copy(buf, 44);
    return buf;
}

module.exports = { stereoToMono, PCMResampler, rms, toFloat32, toWav };
