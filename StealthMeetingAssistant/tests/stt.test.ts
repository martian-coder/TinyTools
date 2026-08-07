/**
 * STT adapters against mock engines: correct handshake, correct result
 * extraction, and audio that actually reaches the wire.
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import test, { after, before } from 'node:test';
import { WebSocketServer, type WebSocket as WsSocket } from 'ws';
import { assemblyai } from '../src/server/stt/assemblyai';
import { deepgram } from '../src/server/stt/deepgram';
import { findSttProvider, toSttProviderInfo } from '../src/server/stt/registry';
import { whisperBatch } from '../src/server/stt/whisperBatch';
import { SAMPLE_RATE, type SttResult } from '../src/server/stt/types';

let server: http.Server;
let wss: WebSocketServer;
let base: string;
let wsBase: string;

/** Set per test: how the mock engine responds once connected. */
let onConnect: (socket: WsSocket, url: URL) => void = () => {};
/** Set per test: how the mock HTTP transcription endpoint responds. */
let onTranscribe: (body: Buffer, res: http.ServerResponse) => void = (_b, res) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ text: 'mock transcript' }));
};

let lastUpgradeHeaders: http.IncomingHttpHeaders;
let receivedAudio: Buffer[] = [];

before(async () => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      if (req.url?.includes('/audio/transcriptions')) {
        onTranscribe(Buffer.concat(chunks), res);
        return;
      }
      res.writeHead(404).end();
    });
  });

  wss = new WebSocketServer({ server });
  wss.on('connection', (socket, req) => {
    lastUpgradeHeaders = req.headers;
    receivedAudio = [];
    socket.on('message', (data, isBinary) => {
      if (isBinary) receivedAudio.push(Buffer.from(data as Buffer));
    });
    onConnect(socket, new URL(req.url ?? '/', 'http://x'));
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as any).port;
  base = `http://127.0.0.1:${port}`;
  wsBase = `ws://127.0.0.1:${port}`;
});

after(
  () =>
    new Promise<void>((resolve) => {
      for (const client of wss.clients) client.terminate();
      wss.close();
      server.closeAllConnections?.();
      server.close(() => resolve());
    }),
);

function collector() {
  const results: SttResult[] = [];
  const errors: Error[] = [];
  return {
    results,
    errors,
    onResult: (r: SttResult) => results.push(r),
    onError: (e: Error) => errors.push(e),
  };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/* ── Deepgram ────────────────────────────────────────────────── */

test('deepgram negotiates the right audio format and auth', async () => {
  let seen: URL | undefined;
  onConnect = (_socket, url) => {
    seen = url;
  };

  const sink = collector();
  const stream = await deepgram({
    def: findSttProvider('deepgram')!,
    apiKey: 'dg-key',
    baseUrl: wsBase,
    model: 'nova-3',
    onResult: sink.onResult,
    onError: sink.onError,
  });

  assert.equal(lastUpgradeHeaders.authorization, 'Token dg-key');
  assert.equal(seen?.searchParams.get('encoding'), 'linear16');
  assert.equal(seen?.searchParams.get('sample_rate'), String(SAMPLE_RATE));
  assert.equal(seen?.searchParams.get('channels'), '1');
  assert.equal(seen?.searchParams.get('model'), 'nova-3');
  assert.equal(seen?.searchParams.get('interim_results'), 'true');
  await stream.close();
});

test('deepgram emits interim then final results and forwards audio', async () => {
  onConnect = (socket) => {
    socket.send(
      JSON.stringify({
        type: 'Results',
        is_final: false,
        channel: { alternatives: [{ transcript: 'the timeout', confidence: 0.8 }] },
      }),
    );
    socket.send(
      JSON.stringify({
        type: 'Results',
        is_final: true,
        channel: { alternatives: [{ transcript: 'The timeout is 15 seconds.', confidence: 0.97 }] },
      }),
    );
  };

  const sink = collector();
  const stream = await deepgram({
    def: findSttProvider('deepgram')!,
    apiKey: 'k',
    baseUrl: wsBase,
    onResult: sink.onResult,
    onError: sink.onError,
  });

  stream.write(Buffer.alloc(3200, 1));
  await wait(120);

  assert.equal(sink.results.length, 2);
  assert.deepEqual(
    sink.results.map((r) => r.isFinal),
    [false, true],
  );
  assert.equal(sink.results[1].text, 'The timeout is 15 seconds.');
  assert.equal(receivedAudio.length, 1, 'PCM must reach the engine');
  assert.equal(receivedAudio[0].length, 3200);
  await stream.close();
});

test('deepgram maps diarized speakers onto the result', async () => {
  onConnect = (socket) => {
    socket.send(
      JSON.stringify({
        type: 'Results',
        is_final: true,
        channel: {
          alternatives: [{ transcript: 'Fifteen seconds.', words: [{ speaker: 1 }] }],
        },
      }),
    );
  };

  const sink = collector();
  const stream = await deepgram({
    def: findSttProvider('deepgram')!,
    apiKey: 'k',
    baseUrl: wsBase,
    diarize: true,
    onResult: sink.onResult,
    onError: sink.onError,
  });

  await wait(100);
  assert.equal(sink.results[0].speaker, 'Speaker 2', 'speaker ids are zero-based upstream');
  await stream.close();
});

test('deepgram ignores empty transcripts', async () => {
  onConnect = (socket) => {
    socket.send(JSON.stringify({ type: 'Results', is_final: true, channel: { alternatives: [{ transcript: '' }] } }));
    socket.send(JSON.stringify({ type: 'Results', is_final: true, channel: { alternatives: [{ transcript: '   ' }] } }));
    socket.send(JSON.stringify({ type: 'Metadata' }));
  };

  const sink = collector();
  const stream = await deepgram({
    def: findSttProvider('deepgram')!,
    apiKey: 'k',
    baseUrl: wsBase,
    onResult: sink.onResult,
    onError: sink.onError,
  });

  await wait(100);
  assert.equal(sink.results.length, 0);
  await stream.close();
});

test('a rejected upgrade surfaces as a readable, non-retryable auth error', async () => {
  // A server with no WebSocket handler responds 404 to the upgrade.
  const plain = http.createServer((_req, res) => res.writeHead(401).end());
  await new Promise<void>((resolve) => plain.listen(0, '127.0.0.1', resolve));
  const port = (plain.address() as any).port;

  const sink = collector();
  await assert.rejects(
    deepgram({
      def: findSttProvider('deepgram')!,
      apiKey: 'wrong',
      baseUrl: `ws://127.0.0.1:${port}`,
      onResult: sink.onResult,
      onError: sink.onError,
    }),
    (err: Error) => {
      assert.match(err.message, /401/);
      assert.match(err.message, /check the API key/);
      return true;
    },
  );
  await new Promise<void>((resolve) => plain.close(() => resolve()));
});

/* ── AssemblyAI ──────────────────────────────────────────────── */

test('assemblyai sends the key as a bare Authorization header', async () => {
  let seen: URL | undefined;
  onConnect = (_socket, url) => {
    seen = url;
  };

  const sink = collector();
  const stream = await assemblyai({
    def: findSttProvider('assemblyai')!,
    apiKey: 'aai-key',
    baseUrl: wsBase,
    onResult: sink.onResult,
    onError: sink.onError,
  });

  assert.equal(lastUpgradeHeaders.authorization, 'aai-key');
  assert.equal(seen?.searchParams.get('encoding'), 'pcm_s16le');
  assert.equal(seen?.searchParams.get('sample_rate'), String(SAMPLE_RATE));
  await stream.close();
});

test('assemblyai suppresses repeated identical partials', async () => {
  onConnect = (socket) => {
    socket.send(JSON.stringify({ type: 'Turn', end_of_turn: false, transcript: 'the timeout' }));
    socket.send(JSON.stringify({ type: 'Turn', end_of_turn: false, transcript: 'the timeout' }));
    socket.send(JSON.stringify({ type: 'Turn', end_of_turn: false, transcript: 'the timeout is' }));
    socket.send(JSON.stringify({ type: 'Turn', end_of_turn: true, transcript: 'The timeout is 15 seconds.' }));
  };

  const sink = collector();
  const stream = await assemblyai({
    def: findSttProvider('assemblyai')!,
    apiKey: 'k',
    baseUrl: wsBase,
    onResult: sink.onResult,
    onError: sink.onError,
  });

  await wait(120);
  assert.deepEqual(
    sink.results.map((r) => r.text),
    ['the timeout', 'the timeout is', 'The timeout is 15 seconds.'],
  );
  assert.equal(sink.results.at(-1)!.isFinal, true);
  await stream.close();
});

/* ── Whisper batch ───────────────────────────────────────────── */

/** 16 kHz PCM16 at a given amplitude. */
function tone(ms: number, amplitude: number): Buffer {
  const samples = Math.floor((SAMPLE_RATE * ms) / 1000);
  const buffer = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    buffer.writeInt16LE(Math.round(Math.sin((i / SAMPLE_RATE) * 220 * 2 * Math.PI) * amplitude), i * 2);
  }
  return buffer;
}

test('whisper batch transcribes each utterance the VAD cuts out', async () => {
  const uploads: Buffer[] = [];
  onTranscribe = (body, res) => {
    uploads.push(body);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ text: 'The timeout is fifteen seconds with two retries.' }));
  };

  const sink = collector();
  const stream = await whisperBatch({
    def: findSttProvider('groq-whisper')!,
    apiKey: 'gk',
    baseUrl: `${base}/v1`,
    model: 'whisper-large-v3-turbo',
    onResult: sink.onResult,
    onError: sink.onError,
  });

  stream.write(tone(400, 40));
  stream.write(tone(1000, 9000));
  stream.write(tone(900, 40));
  await stream.close();

  assert.equal(sink.results.length, 1);
  assert.equal(sink.results[0].isFinal, true, 'batch results are always final');
  assert.match(sink.results[0].text, /fifteen seconds/);

  // The upload must be a real multipart body carrying a WAV file.
  const body = uploads[0].toString('latin1');
  assert.match(body, /name="model"[\s\S]*whisper-large-v3-turbo/);
  assert.match(body, /filename="audio\.wav"/);
  assert.ok(body.includes('RIFF'), 'WAV header must be present');
});

test('whisper batch reports an API failure without dropping the session', async () => {
  onTranscribe = (_body, res) => {
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Invalid API Key' } }));
  };

  const sink = collector();
  const stream = await whisperBatch({
    def: findSttProvider('groq-whisper')!,
    apiKey: 'bad',
    baseUrl: `${base}/v1`,
    onResult: sink.onResult,
    onError: sink.onError,
  });

  stream.write(tone(300, 40));
  stream.write(tone(900, 9000));
  stream.write(tone(900, 40));
  await stream.close();

  assert.equal(sink.results.length, 0);
  assert.equal(sink.errors.length, 1);
  assert.match(sink.errors[0].message, /401/);
  assert.match(sink.errors[0].message, /check the API key/);
});

test('whisper batch flushes a sentence still in progress when capture stops', async () => {
  onTranscribe = (_body, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ text: 'Cut off mid sentence' }));
  };

  const sink = collector();
  const stream = await whisperBatch({
    def: findSttProvider('local-whisper')!,
    baseUrl: `${base}/v1`,
    onResult: sink.onResult,
    onError: sink.onError,
  });

  stream.write(tone(300, 40));
  stream.write(tone(1200, 9000));
  // No trailing silence: the user hit stop while still talking.
  await stream.close();

  assert.equal(sink.results.length, 1, 'the final utterance must not be lost');
  assert.equal(sink.results[0].text, 'Cut off mid sentence');
});

/* ── Registry ────────────────────────────────────────────────── */

test('unconfigured engines are listed with the reason, not hidden', () => {
  delete process.env.DEEPGRAM_API_KEY;
  const info = toSttProviderInfo(findSttProvider('deepgram')!);
  assert.equal(info.available, false);
  assert.match(info.unavailableReason!, /DEEPGRAM_API_KEY/);
  assert.equal(info.supportsDiarization, true);
  assert.ok(info.note.length > 0);
});

test('a local whisper server needs no key but does need a base URL', () => {
  delete process.env.LOCAL_WHISPER_BASE_URL;
  const missing = toSttProviderInfo(findSttProvider('local-whisper')!);
  assert.equal(missing.available, false);
  assert.match(missing.unavailableReason!, /LOCAL_WHISPER_BASE_URL/);

  process.env.LOCAL_WHISPER_BASE_URL = 'http://127.0.0.1:8080/v1';
  const present = toSttProviderInfo(findSttProvider('local-whisper')!);
  assert.equal(present.available, true, 'no API key should be required');
  delete process.env.LOCAL_WHISPER_BASE_URL;
});
