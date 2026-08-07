import type { SttProviderDef } from './registry';

/** Audio arrives as 16 kHz mono signed 16-bit little-endian PCM, always. */
export const SAMPLE_RATE = 16_000;
export const BYTES_PER_SAMPLE = 2;

export interface SttResult {
  text: string;
  isFinal: boolean;
  /** Provider-reported speaker turn, when diarization is on. */
  speaker?: string;
  confidence?: number;
}

export interface SttStreamOptions {
  def: SttProviderDef;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  language?: string;
  /** Ask the provider to split speakers within this one audio source. */
  diarize?: boolean;
  onResult(result: SttResult): void;
  onError(error: Error): void;
  /** Fired when the upstream connection closes on its own. */
  onClose?(): void;
}

/**
 * One live transcription session. `write` is called with raw PCM as it
 * arrives; results come back through the callbacks rather than a return
 * value, because streaming providers emit interim results out of band.
 */
export interface SttStream {
  write(pcm: Buffer): void;
  /** Flush anything buffered and close the upstream connection. */
  close(): Promise<void>;
  /** False once the upstream connection has gone away. */
  readonly active: boolean;
}

/**
 * The entire STT abstraction. Adding an engine means writing one of these and
 * registering it — nothing else in the app changes.
 */
export type SttAdapter = (opts: SttStreamOptions) => Promise<SttStream>;

export class SttError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable = true) {
    super(message);
    this.name = 'SttError';
    this.retryable = retryable;
  }
}
