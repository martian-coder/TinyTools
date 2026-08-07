import { SAMPLE_RATE } from './types';

/**
 * Energy-based voice activity detector for the batch STT path, which needs
 * complete utterances rather than a continuous stream.
 *
 * Deliberately not a neural VAD: this only has to answer "has the talking
 * stopped yet", and RMS with hysteresis does that with no model to load. It
 * calibrates its own noise floor, so it adapts to a noisy room instead of
 * relying on a fixed threshold.
 */
export interface VadOptions {
  /** Speech must exceed noiseFloor * this to open a segment. */
  activationRatio?: number;
  /** Silence this long ends the utterance. */
  hangoverMs?: number;
  /** Cut a segment regardless once it reaches this length. */
  maxSegmentMs?: number;
  /** Discard anything shorter than this — usually a cough or a click. */
  minSegmentMs?: number;
  /** Absolute floor so a silent room cannot calibrate down to zero. */
  minRms?: number;
  /**
   * Ceiling on the learned noise floor. Anything louder is speech, not
   * background — without this, starting capture mid-sentence calibrates the
   * floor to someone's voice and the detector goes deaf.
   */
  maxNoiseFloor?: number;
}

export interface VadSegment {
  pcm: Buffer;
  durationMs: number;
}

const FRAME_MS = 20;
const FRAME_SAMPLES = (SAMPLE_RATE * FRAME_MS) / 1000;
const FRAME_BYTES = FRAME_SAMPLES * 2;

export class Vad {
  private readonly activationRatio: number;
  private readonly hangoverMs: number;
  private readonly maxSegmentMs: number;
  private readonly minSegmentMs: number;
  private readonly minRms: number;
  private readonly maxNoiseFloor: number;

  private carry = Buffer.alloc(0);
  private speech: Buffer[] = [];
  private speechMs = 0;
  /** Voiced milliseconds only — excludes preroll and trailing silence. */
  private voicedMs = 0;
  private silenceMs = 0;
  private speaking = false;
  private noiseFloor = 0;
  /** Frames kept from just before speech started, so onsets are not clipped. */
  private preroll: Buffer[] = [];

  constructor(opts: VadOptions = {}) {
    this.activationRatio = opts.activationRatio ?? 2.5;
    this.hangoverMs = opts.hangoverMs ?? 700;
    this.maxSegmentMs = opts.maxSegmentMs ?? 20_000;
    this.minSegmentMs = opts.minSegmentMs ?? 300;
    this.minRms = opts.minRms ?? 180;
    this.maxNoiseFloor = opts.maxNoiseFloor ?? 1500;
  }

  /** Feed PCM; get back any utterances that completed within it. */
  push(pcm: Buffer): VadSegment[] {
    const segments: VadSegment[] = [];
    let buffer = this.carry.length ? Buffer.concat([this.carry, pcm]) : pcm;

    let offset = 0;
    while (offset + FRAME_BYTES <= buffer.length) {
      const frame = buffer.subarray(offset, offset + FRAME_BYTES);
      offset += FRAME_BYTES;
      const segment = this.pushFrame(frame);
      if (segment) segments.push(segment);
    }

    this.carry = Buffer.from(buffer.subarray(offset));
    return segments;
  }

  private pushFrame(frame: Buffer): VadSegment | undefined {
    const rms = frameRms(frame);

    if (!this.speaking) {
      // Track the quietest recent level as the noise floor, rising slowly and
      // falling fast so a passing truck does not deafen the detector.
      const estimate = this.noiseFloor
        ? Math.min(rms, this.noiseFloor * 1.05) * 0.1 + this.noiseFloor * 0.9
        : rms;
      this.noiseFloor = Math.min(estimate, this.maxNoiseFloor);
    }

    const threshold = Math.max(this.minRms, this.noiseFloor * this.activationRatio);

    if (rms >= threshold) {
      if (!this.speaking) {
        this.speaking = true;
        this.speech = [...this.preroll];
        this.speechMs = this.preroll.length * FRAME_MS;
        this.voicedMs = 0;
        this.preroll = [];
      }
      this.speech.push(Buffer.from(frame));
      this.speechMs += FRAME_MS;
      this.voicedMs += FRAME_MS;
      this.silenceMs = 0;

      if (this.speechMs >= this.maxSegmentMs) return this.cut();
      return undefined;
    }

    if (this.speaking) {
      // Keep trailing silence inside the segment; Whisper uses it to decide
      // the utterance really ended.
      this.speech.push(Buffer.from(frame));
      this.speechMs += FRAME_MS;
      this.silenceMs += FRAME_MS;
      if (this.silenceMs >= this.hangoverMs) return this.cut();
      return undefined;
    }

    // Keep ~200ms of pre-speech audio so the first syllable is not lost.
    this.preroll.push(Buffer.from(frame));
    if (this.preroll.length > 10) this.preroll.shift();
    return undefined;
  }

  /** End the current utterance and hand it over. */
  private cut(): VadSegment | undefined {
    const pcm = Buffer.concat(this.speech);
    const durationMs = this.speechMs;
    const voicedMs = this.voicedMs;
    this.speech = [];
    this.speechMs = 0;
    this.voicedMs = 0;
    this.silenceMs = 0;
    this.speaking = false;
    this.preroll = [];

    // Measure the minimum against voiced audio, not against the padding we
    // added around it, or a 60 ms click survives the filter.
    if (voicedMs < this.minSegmentMs) return undefined;
    return { pcm, durationMs };
  }

  /** Flush whatever is buffered — used when the user stops capture. */
  flush(): VadSegment | undefined {
    if (!this.speaking || !this.speech.length) return undefined;
    return this.cut();
  }

  get isSpeaking(): boolean {
    return this.speaking;
  }
}

export function frameRms(frame: Buffer): number {
  let sum = 0;
  const samples = Math.floor(frame.length / 2);
  for (let i = 0; i < samples; i++) {
    const sample = frame.readInt16LE(i * 2);
    sum += sample * sample;
  }
  return samples ? Math.sqrt(sum / samples) : 0;
}

/** Wrap raw PCM in a WAV header — what the batch STT endpoints expect. */
export function pcmToWav(pcm: Buffer, sampleRate = SAMPLE_RATE): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // format: PCM
  header.writeUInt16LE(1, 22); // channels: mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
