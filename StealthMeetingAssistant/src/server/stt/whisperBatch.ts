import { sttModel } from './registry';
import { SttError, type SttAdapter, type SttStream } from './types';
import { pcmToWav, Vad } from './vad';

/**
 * Batch transcription against any OpenAI-compatible `/audio/transcriptions`
 * endpoint — OpenAI, Groq, or a local whisper.cpp / faster-whisper server.
 *
 * These endpoints take a complete audio file, so a VAD cuts the stream into
 * utterances and each one is transcribed on its own. Text therefore lands a
 * moment after each pause rather than word by word.
 */
export const whisperBatch: SttAdapter = async (opts) => {
  const model = opts.model || sttModel(opts.def);
  const vad = new Vad();
  let active = true;
  /** Set by close(); stops new audio without cancelling pending uploads. */
  let closing = false;
  /** Serialises uploads so utterances cannot arrive out of order. */
  let queue: Promise<void> = Promise.resolve();

  const transcribe = async (pcm: Buffer, durationMs: number): Promise<void> => {
    const form = new FormData();
    const wav = pcmToWav(pcm);
    form.append('file', new Blob([new Uint8Array(wav)], { type: 'audio/wav' }), 'audio.wav');
    form.append('model', model);
    form.append('response_format', 'json');
    if (opts.language) form.append('language', opts.language);
    // Nudges Whisper away from hallucinating on near-silent input.
    form.append('temperature', '0');

    try {
      const res = await fetch(`${opts.baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: opts.apiKey ? { authorization: `Bearer ${opts.apiKey}` } : {},
        body: form,
      });

      if (!res.ok) {
        const detail = (await res.text().catch(() => '')).slice(0, 180);
        const hint = res.status === 401 || res.status === 403 ? ' (check the API key in .env)' : '';
        opts.onError(
          new SttError(
            `${opts.def.label} ${res.status}: ${detail || res.statusText}${hint}`,
            res.status >= 500 || res.status === 429,
          ),
        );
        return;
      }

      const body: any = await res.json();
      const text = String(body?.text ?? '').trim();
      if (!text || isHallucination(text, durationMs)) return;
      opts.onResult({ text, isFinal: true });
    } catch (err) {
      opts.onError(new SttError(`${opts.def.label}: ${(err as Error).message}`));
    }
  };

  const enqueue = (pcm: Buffer, durationMs: number) => {
    queue = queue.then(() => transcribe(pcm, durationMs)).catch(() => undefined);
  };

  return {
    get active() {
      return active;
    },
    write(pcm) {
      if (closing) return;
      for (const segment of vad.push(pcm)) enqueue(segment.pcm, segment.durationMs);
    },
    async close() {
      closing = true;
      // Queue the sentence still in progress, then let every pending upload
      // finish. Marking the stream inactive first would silently drop the
      // last thing said before the user hit stop.
      const tail = vad.flush();
      if (tail) enqueue(tail.pcm, tail.durationMs);
      await queue;
      active = false;
    },
  } satisfies SttStream;
};

/**
 * Whisper reliably emits stock phrases when handed near-silence — "Thank
 * you.", "you", subtitle credits. Short segments producing one of these are
 * almost certainly noise, and letting them through pollutes the transcript
 * the assistant reasons over.
 */
const HALLUCINATIONS = new Set([
  'you',
  'thank you.',
  'thanks for watching!',
  'thank you for watching!',
  'bye.',
  'okay.',
  '.',
  'subs by www.zeoranger.co.uk',
  'subtitles by the amara.org community',
]);

export function isHallucination(text: string, durationMs: number): boolean {
  const normalised = text.toLowerCase().trim();
  if (HALLUCINATIONS.has(normalised)) return true;
  // A couple of words from several seconds of audio means it heard nothing.
  return durationMs > 4000 && normalised.split(/\s+/).length <= 2;
}
