import WebSocket from 'ws';
import { waitForOpen } from './deepgram';
import { SAMPLE_RATE, SttError, type SttAdapter, type SttStream } from './types';

/**
 * AssemblyAI universal-streaming (v3). Emits partial turns while you speak and
 * a formatted final when the turn ends.
 */
export const assemblyai: SttAdapter = async (opts) => {
  const params = new URLSearchParams({
    sample_rate: String(SAMPLE_RATE),
    encoding: 'pcm_s16le',
    format_turns: 'true',
  });

  const socket = new WebSocket(`${opts.baseUrl}?${params.toString()}`, {
    headers: { Authorization: opts.apiKey ?? '' },
  });

  let active = true;
  // Handlers must be attached before the handshake completes: a frame that
  // arrives between 'open' and listener registration would otherwise be lost.
  const opened = waitForOpen(socket, opts.def.label);
  /** v3 resends the whole turn each time, so track what we already emitted. */
  let lastEmitted = '';

  socket.on('message', (raw) => {
    let parsed: any;
    try {
      parsed = JSON.parse(String(raw));
    } catch {
      return;
    }

    if (parsed.type === 'Error' || parsed.error) {
      opts.onError(new SttError(parsed.error ?? 'AssemblyAI error'));
      return;
    }
    if (parsed.type !== 'Turn') return;

    const text = parsed.transcript;
    if (typeof text !== 'string' || !text.trim()) return;

    const isFinal = Boolean(parsed.end_of_turn);
    // Skip unchanged partials; they would just re-render the same line.
    if (!isFinal && text === lastEmitted) return;
    lastEmitted = isFinal ? '' : text;

    opts.onResult({ text, isFinal });
  });

  socket.on('error', (err: Error) => {
    active = false;
    opts.onError(new SttError(`AssemblyAI: ${err.message}`));
  });
  socket.on('close', (code, reason) => {
    active = false;
    if (code !== 1000 && code !== 1005) {
      opts.onError(
        new SttError(`AssemblyAI closed (${code}): ${String(reason) || 'no reason given'}`),
      );
    }
    opts.onClose?.();
  });

  await opened;

  const stream: SttStream = {
    get active() {
      return active && socket.readyState === WebSocket.OPEN;
    },
    write(pcm) {
      if (socket.readyState === WebSocket.OPEN) socket.send(pcm);
    },
    async close() {
      active = false;
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'Terminate' }));
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      socket.close();
    },
  };

  return stream;
};
