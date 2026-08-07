/**
 * The audio path end to end: HTTP control plane, PCM over WebSocket, results
 * landing in the transcript buffer with correct speaker labels.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test, { after, before } from 'node:test';
import WebSocket, { WebSocketServer } from 'ws';
import { systemAudioSupport } from '../src/server/routes/audio';

const TOKEN = 'audio-token-0123456789abcdef';
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sma-audio-'));
process.env.DATA_DIR = dataDir;
process.env.ASSISTANT_TOKEN = TOKEN;
process.env.EMBEDDINGS_MODE = 'hash';

let engine: http.Server;
let engineWss: WebSocketServer;
let backend: Awaited<ReturnType<typeof import('../src/server/app').startServer>>;
let base: string;
/** PCM the mock engine received, so tests can prove audio reached it. */
let engineAudio: Buffer[] = [];
let engineSockets: WebSocket[] = [];

before(async () => {
  // Mock Deepgram: echoes a canned result once audio arrives.
  engine = http.createServer();
  engineWss = new WebSocketServer({ server: engine });
  engineWss.on('connection', (socket) => {
    engineSockets.push(socket as unknown as WebSocket);
    socket.on('message', (data, isBinary) => {
      if (!isBinary) return;
      engineAudio.push(Buffer.from(data as Buffer));
      socket.send(
        JSON.stringify({
          type: 'Results',
          is_final: true,
          channel: { alternatives: [{ transcript: 'We decided on fifteen seconds.' }] },
        }),
      );
    });
  });
  await new Promise<void>((resolve) => engine.listen(0, '127.0.0.1', resolve));
  process.env.DEEPGRAM_BASE_URL = `ws://127.0.0.1:${(engine.address() as any).port}`;
  process.env.DEEPGRAM_API_KEY = 'dg-test-key';

  const { startServer } = await import('../src/server/app');
  backend = await startServer(0);
  base = backend.url;
});

after(async () => {
  await backend?.close();
  for (const socket of engineSockets) socket.terminate();
  engineWss.close();
  await new Promise<void>((resolve) => engine.close(() => resolve()));
  fs.rmSync(dataDir, { recursive: true, force: true });
});

function call(pathname: string, init: RequestInit = {}) {
  return fetch(base + pathname, {
    ...init,
    headers: {
      'x-assistant-token': TOKEN,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/* ── Capability reporting ────────────────────────────────────── */

test('system audio capability is reported per platform', () => {
  assert.equal(systemAudioSupport('win32').method, 'loopback');
  assert.equal(systemAudioSupport('linux').method, 'monitor-device');

  // macOS depends on whether the ScreenCaptureKit helper has been built.
  assert.equal(systemAudioSupport('darwin', false).method, 'virtual-device');
  assert.match(systemAudioSupport('darwin', false).hint, /build:macos-audio|BlackHole/);
  assert.equal(systemAudioSupport('darwin', true).method, 'screencapturekit');
  assert.equal(systemAudioSupport('darwin', true).supported, true);

  const other = systemAudioSupport('freebsd');
  assert.equal(other.supported, false);
  assert.match(other.hint, /Mic capture still works/);
});

test('GET /api/audio/providers lists engines and marks the unconfigured ones', async () => {
  const body = await (await call('/api/audio/providers')).json();
  const ids = body.providers.map((p: any) => p.id);

  for (const expected of ['deepgram', 'assemblyai', 'groq-whisper', 'openai-whisper', 'local-parakeet', 'local-whisper']) {
    assert.ok(ids.includes(expected), `missing engine ${expected}`);
  }

  const deepgram = body.providers.find((p: any) => p.id === 'deepgram');
  assert.equal(deepgram.available, true);
  assert.equal(deepgram.kind, 'streaming');

  const assembly = body.providers.find((p: any) => p.id === 'assemblyai');
  assert.equal(assembly.available, false);
  assert.match(assembly.unavailableReason, /ASSEMBLYAI_API_KEY/);

  // Keys must never be echoed back.
  assert.equal(JSON.stringify(body).includes('dg-test-key'), false);
  assert.equal(body.status.sources.length, 2);
});

/* ── Control plane ───────────────────────────────────────────── */

test('start rejects an unknown source', async () => {
  const res = await call('/api/audio/start', {
    method: 'POST',
    body: JSON.stringify({ source: 'speaker', provider: 'deepgram' }),
  });
  assert.equal(res.status, 400);
});

test('starting an unconfigured engine fails with a readable reason, not a 500', async () => {
  const res = await call('/api/audio/start', {
    method: 'POST',
    body: JSON.stringify({ source: 'mic', provider: 'assemblyai' }),
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /ASSEMBLYAI_API_KEY/);
});

/* ── The full path ───────────────────────────────────────────── */

test('PCM sent over the socket is transcribed into the transcript buffer', async () => {
  engineAudio = [];
  await call('/api/session/transcript', { method: 'DELETE' });

  const started = await (
    await call('/api/audio/start', {
      method: 'POST',
      body: JSON.stringify({ source: 'mic', provider: 'deepgram' }),
    })
  ).json();
  const micStatus = started.sources.find((s: any) => s.source === 'mic');
  assert.equal(micStatus.active, true);
  assert.equal(micStatus.speakerLabel, 'You', 'mic audio is attributed to the user');

  const socket = new WebSocket(
    `${base.replace('http', 'ws')}/ws/audio?source=mic&token=${TOKEN}`,
  );
  await new Promise((resolve) => socket.once('open', resolve));
  socket.send(Buffer.alloc(3200, 7));
  await wait(250);

  assert.equal(engineAudio.length, 1, 'audio must reach the STT engine');
  assert.equal(engineAudio[0].length, 3200);

  const transcript = await (await call('/api/session/transcript')).json();
  assert.equal(transcript.lines.length, 1);
  assert.equal(transcript.lines[0].speaker, 'You');
  assert.equal(transcript.lines[0].text, 'We decided on fifteen seconds.');

  socket.close();
  await call('/api/audio/stop', { method: 'POST', body: JSON.stringify({ source: 'mic' }) });
});

test('system audio is labelled separately from the user', async () => {
  await call('/api/session/transcript', { method: 'DELETE' });
  const started = await (
    await call('/api/audio/start', {
      method: 'POST',
      body: JSON.stringify({ source: 'system', provider: 'deepgram' }),
    })
  ).json();
  assert.equal(
    started.sources.find((s: any) => s.source === 'system').speakerLabel,
    'Meeting',
  );

  const socket = new WebSocket(
    `${base.replace('http', 'ws')}/ws/audio?source=system&token=${TOKEN}`,
  );
  await new Promise((resolve) => socket.once('open', resolve));
  socket.send(Buffer.alloc(1600, 3));
  await wait(250);

  const transcript = await (await call('/api/session/transcript')).json();
  assert.equal(transcript.lines[0].speaker, 'Meeting');

  socket.close();
  await call('/api/audio/stop', { method: 'POST', body: JSON.stringify({ source: 'system' }) });
});

test('audio sent with no session open is refused rather than silently dropped', async () => {
  const socket = new WebSocket(
    `${base.replace('http', 'ws')}/ws/audio?source=mic&token=${TOKEN}`,
  );
  await new Promise((resolve) => socket.once('open', resolve));

  const notice = await new Promise<any>((resolve) => {
    socket.once('message', (raw) => resolve(JSON.parse(String(raw))));
    socket.send(Buffer.alloc(320, 1));
  });

  assert.equal(notice.type, 'inactive');
  assert.equal(notice.source, 'mic');
  socket.close();
});

test('the audio socket rejects a bad token and a bad source', async () => {
  const badToken = new WebSocket(`${base.replace('http', 'ws')}/ws/audio?source=mic&token=nope`);
  const tokenCode = await new Promise((resolve) => badToken.once('close', resolve));
  assert.equal(tokenCode, 4401);

  const badSource = new WebSocket(
    `${base.replace('http', 'ws')}/ws/audio?source=whatever&token=${TOKEN}`,
  );
  const sourceCode = await new Promise((resolve) => badSource.once('close', resolve));
  assert.equal(sourceCode, 4400);
});

test('stopping all sources leaves nothing active', async () => {
  await call('/api/audio/start', {
    method: 'POST',
    body: JSON.stringify({ source: 'mic', provider: 'deepgram' }),
  });
  const stopped = await (await call('/api/audio/stop', { method: 'POST', body: '{}' })).json();
  assert.equal(stopped.sources.every((s: any) => !s.active), true);
});

test('restarting a source replaces the session instead of stacking two', async () => {
  for (let i = 0; i < 3; i++) {
    await call('/api/audio/start', {
      method: 'POST',
      body: JSON.stringify({ source: 'mic', provider: 'deepgram' }),
    });
  }
  const status = await (await call('/api/audio/status')).json();
  const mic = status.sources.filter((s: any) => s.source === 'mic');
  assert.equal(mic.length, 1);
  assert.equal(mic[0].active, true);

  await call('/api/audio/stop', { method: 'POST', body: '{}' });
});

test('the transcript captured from audio is what the assistant reasons over', async () => {
  await call('/api/session/transcript', { method: 'DELETE' });
  await call('/api/audio/start', {
    method: 'POST',
    body: JSON.stringify({ source: 'mic', provider: 'deepgram' }),
  });

  const socket = new WebSocket(
    `${base.replace('http', 'ws')}/ws/audio?source=mic&token=${TOKEN}`,
  );
  await new Promise((resolve) => socket.once('open', resolve));
  socket.send(Buffer.alloc(3200, 5));
  await wait(250);
  socket.close();
  await call('/api/audio/stop', { method: 'POST', body: '{}' });

  // The same buffer the chat route reads when no explicit context is passed.
  const { transcript } = await import('../src/server/session/transcript');
  assert.ok(
    transcript.recent(10).some((l) => l.text.includes('fifteen seconds')),
    'spoken audio must be visible to the assistant',
  );
});
