import WebSocket from 'ws';
import { sttModel } from './registry';
import { SAMPLE_RATE, SttError, type SttAdapter, type SttStream } from './types';

/**
 * Deepgram streaming. Holds a WebSocket open and emits interim results as you
 * speak, finalising each utterance when it detects the end of speech.
 */
export const deepgram: SttAdapter = async (opts) => {
  const params = new URLSearchParams({
    encoding: 'linear16',
    sample_rate: String(SAMPLE_RATE),
    channels: '1',
    model: opts.model || sttModel(opts.def),
    interim_results: 'true',
    punctuate: 'true',
    smart_format: 'true',
    // Close an utterance after a short pause so the assistant sees complete
    // sentences rather than a single ever-growing line.
    endpointing: '400',
    utterance_end_ms: '1000',
  });
  if (opts.language) params.set('language', opts.language);
  if (opts.diarize) params.set('diarize', 'true');

  const url = `${opts.baseUrl}?${params.toString()}`;
  const socket = new WebSocket(url, {
    headers: { Authorization: `Token ${opts.apiKey ?? ''}` },
  });

  let active = true;
  // Handlers must be attached before the handshake completes: a frame that
  // arrives between 'open' and listener registration would otherwise be lost.
  const opened = waitForOpen(socket, opts.def.label);
  /** Audio that arrived before the socket finished opening. */
  const pending: Buffer[] = [];

  socket.on('message', (raw) => {
    let parsed: any;
    try {
      parsed = JSON.parse(String(raw));
    } catch {
      return;
    }

    if (parsed.type === 'Error' || parsed.error) {
      opts.onError(new SttError(parsed.description ?? parsed.error ?? 'Deepgram error'));
      return;
    }
    if (parsed.type !== 'Results' && !parsed.channel) return;

    const alternative = parsed.channel?.alternatives?.[0];
    const text = alternative?.transcript;
    if (typeof text !== 'string' || !text.trim()) return;

    // With diarization on, words carry speaker ids; use the first word's.
    const speakerId = alternative.words?.[0]?.speaker;

    opts.onResult({
      text,
      isFinal: Boolean(parsed.is_final),
      speaker: speakerId === undefined ? undefined : `Speaker ${speakerId + 1}`,
      confidence: alternative.confidence,
    });
  });

  socket.on('error', (err: Error) => {
    active = false;
    opts.onError(new SttError(`Deepgram: ${err.message}`));
  });
  socket.on('close', (code, reason) => {
    active = false;
    // 1000/1005 are ordinary closes; anything else is worth surfacing.
    if (code !== 1000 && code !== 1005) {
      opts.onError(new SttError(`Deepgram closed (${code}): ${String(reason) || 'no reason given'}`));
    }
    opts.onClose?.();
  });

  await opened;

  const stream: SttStream = {
    get active() {
      return active && socket.readyState === WebSocket.OPEN;
    },
    write(pcm) {
      if (socket.readyState === WebSocket.OPEN) {
        while (pending.length) socket.send(pending.shift()!);
        socket.send(pcm);
      } else if (socket.readyState === WebSocket.CONNECTING) {
        pending.push(pcm);
      }
    },
    async close() {
      active = false;
      if (socket.readyState === WebSocket.OPEN) {
        // Tells Deepgram to flush and finalise rather than dropping the tail.
        socket.send(JSON.stringify({ type: 'CloseStream' }));
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      socket.close();
    },
  };

  return stream;
};

export function waitForOpen(socket: WebSocket, label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.terminate();
      reject(new SttError(`${label} did not respond within 10s`));
    }, 10_000);

    socket.once('open', () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once('unexpected-response', (_req, res) => {
      clearTimeout(timer);
      const hint = res.statusCode === 401 ? ' (check the API key in .env)' : '';
      reject(
        new SttError(
          `${label} rejected the connection (${res.statusCode})${hint}`,
          res.statusCode !== 401,
        ),
      );
    });
    socket.once('error', (err: Error) => {
      clearTimeout(timer);
      reject(new SttError(`${label}: ${err.message}`));
    });
  });
}
