import { EventEmitter } from 'node:events';
import { assemblyai } from '../stt/assemblyai';
import { deepgram } from '../stt/deepgram';
import {
  findSttProvider,
  sttApiKey,
  sttBaseUrl,
  sttModel,
  sttUnavailableReason,
} from '../stt/registry';
import { SttError, type SttAdapter, type SttStream } from '../stt/types';
import { whisperBatch } from '../stt/whisperBatch';
import { transcript } from './transcript';
import type { AudioSource, AudioStatus } from '../../shared/types';

const ADAPTERS: Record<string, SttAdapter> = {
  deepgram,
  assemblyai,
  'whisper-batch': whisperBatch,
};

/** Default labels. `mic` is you; `system` is everyone else in the call. */
const SOURCE_LABELS: Record<AudioSource, string> = {
  mic: 'You',
  system: 'Meeting',
};

export const audioEvents = new EventEmitter();

interface Session {
  source: AudioSource;
  providerId: string;
  stream: SttStream;
  speakerLabel: string;
  startedAt: number;
  bytes: number;
  /** Set when the upstream engine failed, so status can explain the stall. */
  error?: string;
}

const sessions = new Map<AudioSource, Session>();

export interface StartOptions {
  source: AudioSource;
  providerId?: string;
  model?: string;
  language?: string;
  diarize?: boolean;
  speakerLabel?: string;
}

/**
 * Open a transcription session for one audio source. Mic and system audio run
 * as independent sessions so each carries a fixed, correct speaker label —
 * mixing them into one stream would make "who said this" unrecoverable.
 */
export async function startAudioSession(opts: StartOptions): Promise<AudioStatus> {
  await stopAudioSession(opts.source);

  const def = findSttProvider(opts.providerId ?? '');
  if (!def) throw new SttError(`Unknown speech provider "${opts.providerId}"`, false);

  const reason = sttUnavailableReason(def);
  if (reason) throw new SttError(reason, false);

  const adapter = ADAPTERS[def.adapter];
  if (!adapter) throw new SttError(`No adapter for "${def.adapter}"`, false);

  const speakerLabel = opts.speakerLabel?.trim() || SOURCE_LABELS[opts.source];

  const stream = await adapter({
    def,
    apiKey: sttApiKey(def),
    baseUrl: sttBaseUrl(def),
    model: opts.model || sttModel(def),
    language: opts.language,
    diarize: opts.diarize && def.supportsDiarization,
    onResult(result) {
      const session = sessions.get(opts.source);
      if (!session) return;
      // Diarization splits the remote side into Speaker 1/2/…; prefix with the
      // source so "Meeting · Speaker 2" stays distinguishable from your mic.
      const speaker = result.speaker
        ? `${speakerLabel} · ${result.speaker}`
        : speakerLabel;
      transcript.append({
        speaker,
        text: result.text,
        isFinal: result.isFinal,
        timestamp: Date.now(),
      });
    },
    onError(error) {
      const session = sessions.get(opts.source);
      if (session) session.error = error.message;
      audioEvents.emit('status', status());
    },
    onClose() {
      // Only clear if this session is still the current one for the source.
      const session = sessions.get(opts.source);
      if (session && session.stream === stream) {
        sessions.delete(opts.source);
        audioEvents.emit('status', status());
      }
    },
  });

  sessions.set(opts.source, {
    source: opts.source,
    providerId: def.id,
    stream,
    speakerLabel,
    startedAt: Date.now(),
    bytes: 0,
  });

  audioEvents.emit('status', status());
  return status();
}

export async function stopAudioSession(source: AudioSource): Promise<AudioStatus> {
  const session = sessions.get(source);
  if (!session) return status();
  sessions.delete(source);
  try {
    await session.stream.close();
  } catch {
    /* already gone */
  }
  audioEvents.emit('status', status());
  return status();
}

export async function stopAllAudio(): Promise<void> {
  await Promise.all([...sessions.keys()].map((source) => stopAudioSession(source)));
}

/** Feed PCM from the renderer into the matching session. */
export function writeAudio(source: AudioSource, pcm: Buffer): boolean {
  const session = sessions.get(source);
  if (!session) return false;
  session.bytes += pcm.length;
  try {
    session.stream.write(pcm);
    return true;
  } catch (err) {
    session.error = (err as Error).message;
    return false;
  }
}

export function isCapturing(source: AudioSource): boolean {
  return sessions.has(source);
}

export function status(): AudioStatus {
  return {
    sources: (['mic', 'system'] as AudioSource[]).map((source) => {
      const session = sessions.get(source);
      return {
        source,
        active: Boolean(session),
        provider: session?.providerId,
        speakerLabel: session?.speakerLabel,
        // Seconds of 16 kHz mono 16-bit audio actually delivered.
        secondsCaptured: session ? Math.round(session.bytes / 32_000) : 0,
        error: session?.error,
      };
    }),
  };
}
