/**
 * End-to-end pass over the backend, with a fake OpenAI-compatible provider
 * standing in for a real LLM. Exercises upload → index → retrieve → stream
 * without needing any API key.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test, { after, before } from 'node:test';

const TOKEN = 'test-token-abcdef0123456789';
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sma-api-'));

// Must be set before the server modules read them.
process.env.DATA_DIR = dataDir;
process.env.ASSISTANT_TOKEN = TOKEN;
process.env.EMBEDDINGS_MODE = 'hash';
process.env.DEFAULT_PROVIDER = 'custom';
process.env.CUSTOM_LLM_API_KEY = 'fake-key';
process.env.CUSTOM_LLM_MODEL = 'mock-model';
// Keys for the real providers must not leak in from a developer's shell.
for (const key of ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY']) {
  delete process.env[key];
}

let mock: http.Server;
let backend: Awaited<ReturnType<typeof import('../src/server/app').startServer>>;
let base: string;
/** Bodies the fake provider received, so tests can assert on the prompt. */
const received: any[] = [];

/** Fake provider: streams a canned answer as OpenAI-style SSE. */
function startMockProvider(): Promise<number> {
  mock = http.createServer((req, res) => {
    if (req.url?.startsWith('/v1/models')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ data: [{ id: 'mock-model' }, { id: 'mock-model-large' }] }));
      return;
    }
    if (!req.url?.startsWith('/v1/chat/completions')) {
      res.writeHead(404).end();
      return;
    }

    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      received.push(JSON.parse(body));
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      // Split across frames so the client has to reassemble.
      for (const piece of ['The timeout ', 'is 15 seconds ', 'with two retries.']) {
        res.write(
          `data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`,
        );
      }
      res.write('data: [DONE]\n\n');
      res.end();
    });
  });

  return new Promise((resolve) => {
    mock.listen(0, '127.0.0.1', () => resolve((mock.address() as any).port));
  });
}

before(async () => {
  const mockPort = await startMockProvider();
  process.env.CUSTOM_LLM_BASE_URL = `http://127.0.0.1:${mockPort}/v1`;

  const { startServer } = await import('../src/server/app');
  backend = await startServer(0);
  base = backend.url;
});

after(async () => {
  await backend?.close();
  await new Promise<void>((resolve) => mock.close(() => resolve()));
  fs.rmSync(dataDir, { recursive: true, force: true });
});

function call(pathname: string, init: RequestInit = {}) {
  return fetch(base + pathname, {
    ...init,
    headers: {
      'x-assistant-token': TOKEN,
      ...(init.body && !(init.body instanceof FormData)
        ? { 'content-type': 'application/json' }
        : {}),
      ...(init.headers ?? {}),
    },
  });
}

/* ── Health & auth ───────────────────────────────────────────── */

test('GET /api/health reports ok without a token', async () => {
  const res = await fetch(`${base}/api/health`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.embedder, 'hash:v1:384');
});

test('protected endpoints reject a missing or wrong token', async () => {
  assert.equal((await fetch(`${base}/api/models`)).status, 401);
  const wrong = await fetch(`${base}/api/models`, {
    headers: { 'x-assistant-token': 'not-the-token-0000000000' },
  });
  assert.equal(wrong.status, 401);
});

test('cross-origin browser requests are refused', async () => {
  const res = await fetch(`${base}/api/models`, {
    headers: { 'x-assistant-token': TOKEN, origin: 'https://evil.example' },
  });
  assert.equal(res.status, 403);
});

/* ── Models ──────────────────────────────────────────────────── */

test('GET /api/models lists every provider and explains the unavailable ones', async () => {
  const body = await (await call('/api/models')).json();
  const ids = body.providers.map((p: any) => p.id);

  for (const expected of [
    'openai',
    'anthropic',
    'gemini',
    'qwen',
    'openrouter',
    'groq',
    'deepseek',
    'together',
    'ollama',
    'custom',
  ]) {
    assert.ok(ids.includes(expected), `missing provider ${expected}`);
  }

  const custom = body.providers.find((p: any) => p.id === 'custom');
  assert.equal(custom.available, true);
  assert.equal(body.defaultProvider, 'custom');

  const openai = body.providers.find((p: any) => p.id === 'openai');
  assert.equal(openai.available, false);
  assert.match(openai.unavailableReason, /OPENAI_API_KEY/);
  // A missing key must never crash the endpoint, and never leak a key value.
  assert.equal(JSON.stringify(body).includes('fake-key'), false);
});

test('refresh=1 pulls the live model list from the endpoint', async () => {
  const body = await (await call('/api/models?refresh=1')).json();
  const custom = body.providers.find((p: any) => p.id === 'custom');
  assert.ok(custom.models.includes('mock-model-large'));
});

test('a custom OpenAI-compatible provider can be registered at runtime', async () => {
  const res = await call('/api/providers', {
    method: 'POST',
    body: JSON.stringify({
      id: 'my-company-llm',
      baseUrl: 'https://llm.corp.internal/v1',
      apiKeyEnv: 'MY_COMPANY_LLM_KEY',
      defaultModel: 'internal-70b',
    }),
  });
  assert.equal(res.status, 201);

  const body = await (await call('/api/models')).json();
  const added = body.providers.find((p: any) => p.id === 'my-company-llm');
  assert.equal(added.custom, true);
  // No key in the environment, so it is listed but flagged unavailable.
  assert.equal(added.available, false);
  assert.match(added.unavailableReason, /MY_COMPANY_LLM_KEY/);

  assert.equal((await call('/api/providers/my-company-llm', { method: 'DELETE' })).status, 200);
});

/* ── Documents & retrieval ───────────────────────────────────── */

test('uploading the sample documents indexes them', async () => {
  const form = new FormData();
  for (const name of ['meeting-notes.md', 'project-spec.md', 'org-priorities.csv']) {
    const buffer = fs.readFileSync(path.resolve(__dirname, '..', 'samples', name));
    form.append('files', new Blob([buffer]), name);
  }

  const body = await (await call('/api/documents/upload', { method: 'POST', body: form })).json();
  assert.equal(body.results.length, 3);
  for (const result of body.results) {
    assert.ok(result.ok, `failed: ${result.fileName} — ${result.error}`);
    assert.equal(result.document.status, 'ready');
    assert.ok(result.document.chunkCount > 0);
  }

  const listed = await (await call('/api/documents')).json();
  assert.equal(listed.documents.length, 3);
});

test('identical content is deduplicated by hash', async () => {
  const form = new FormData();
  const buffer = fs.readFileSync(path.resolve(__dirname, '..', 'samples', 'project-spec.md'));
  form.append('files', new Blob([buffer]), 'project-spec.md');

  const body = await (await call('/api/documents/upload', { method: 'POST', body: form })).json();
  assert.equal(body.results[0].deduplicated, true);
  assert.equal(body.documents.length, 3, 'no duplicate document should be created');
});

test('same name with new content replaces the old version', async () => {
  const form = new FormData();
  form.append('files', new Blob(['# Spec\n\nThe timeout is now 22 seconds.']), 'project-spec.md');

  const body = await (await call('/api/documents/upload', { method: 'POST', body: form })).json();
  assert.equal(body.results[0].replaced, true);
  assert.equal(body.documents.length, 3);
  assert.equal(
    body.documents.filter((d: any) => d.fileName === 'project-spec.md').length,
    1,
  );

  // Put the real spec back for the retrieval tests below.
  const restore = new FormData();
  const buffer = fs.readFileSync(path.resolve(__dirname, '..', 'samples', 'project-spec.md'));
  restore.append('files', new Blob([buffer]), 'project-spec.md');
  await call('/api/documents/upload', { method: 'POST', body: restore });
});

test('unsupported file types fail without taking the batch down', async () => {
  const form = new FormData();
  form.append('files', new Blob(['binary-ish']), 'notes.exe');
  form.append('files', new Blob(['# Fine\n\nThis one is valid.']), 'valid.md');

  const body = await (await call('/api/documents/upload', { method: 'POST', body: form })).json();
  const failed = body.results.find((r: any) => !r.ok);
  const ok = body.results.find((r: any) => r.ok);
  assert.match(failed.error, /Unsupported file type/);
  assert.ok(ok, 'the valid file in the same batch should still index');

  const doc = body.documents.find((d: any) => d.fileName === 'valid.md');
  await call(`/api/documents/${doc.id}`, { method: 'DELETE' });
});

test('POST /api/retrieval/search returns scored chunks with metadata', async () => {
  const body = await (
    await call('/api/retrieval/search', {
      method: 'POST',
      body: JSON.stringify({ query: 'what did we decide about the API timeout', topK: 6 }),
    })
  ).json();

  assert.ok(body.chunks.length > 0);
  const top = body.chunks[0];
  assert.ok(typeof top.score === 'number');
  assert.ok(top.fileName.endsWith('.md') || top.fileName.endsWith('.csv'));
  assert.ok(top.chunkId && top.documentId && top.uploadedAt);

  const joined = body.chunks.map((c: any) => c.text).join(' ');
  assert.match(joined, /15 second/i, 'the timeout decision should be retrievable');
});

/* ── Transcript ──────────────────────────────────────────────── */

test('transcript events are buffered and read back', async () => {
  await call('/api/session/transcript', { method: 'DELETE' });

  await call('/api/session/transcript', {
    method: 'POST',
    body: JSON.stringify({
      speaker: 'Priya',
      text: 'What did we decide about the API timeout?',
      isFinal: true,
      timestamp: Date.now(),
    }),
  });
  await call('/api/session/transcript', {
    method: 'POST',
    body: JSON.stringify({
      events: [
        { speaker: 'Maya', text: 'Fifteen seconds with two retries.', isFinal: true, timestamp: Date.now() },
      ],
    }),
  });

  const body = await (await call('/api/session/transcript?limit=10')).json();
  assert.equal(body.lines.length, 2);
  assert.equal(body.lines[1].speaker, 'Maya');
});

test('interim lines from one speaker replace each other', async () => {
  await call('/api/session/transcript', { method: 'DELETE' });
  for (const text of ['the time', 'the timeout is', 'the timeout is fifteen']) {
    await call('/api/session/transcript', {
      method: 'POST',
      body: JSON.stringify({ speaker: 'Dan', text, isFinal: false, timestamp: Date.now() }),
    });
  }
  const body = await (await call('/api/session/transcript')).json();
  assert.equal(body.lines.length, 1);
  assert.equal(body.lines[0].text, 'the timeout is fifteen');
});

test('an empty transcript event is rejected', async () => {
  const res = await call('/api/session/transcript', {
    method: 'POST',
    body: JSON.stringify({ speaker: 'Dan', text: '   ' }),
  });
  assert.equal(res.status, 400);
});

/* ── Chat streaming ──────────────────────────────────────────── */

async function readFrames(res: Response): Promise<any[]> {
  const frames: any[] = [];
  const text = await res.text();
  for (const line of text.split('\n')) {
    if (line.trim()) frames.push(JSON.parse(line));
  }
  return frames;
}

test('POST /api/chat streams deltas, sources and a done frame', async () => {
  received.length = 0;
  const res = await call('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      provider: 'custom',
      model: 'mock-model',
      mode: 'document',
      message: 'What did we decide about the API timeout?',
      useDocuments: true,
    }),
  });

  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /ndjson/);

  const frames = await readFrames(res);
  const types = frames.map((f) => f.type);
  assert.equal(types[0], 'meta');
  assert.ok(types.includes('sources'));
  assert.ok(types.filter((t) => t === 'delta').length >= 3, 'should stream multiple deltas');

  const done = frames.find((f) => f.type === 'done');
  assert.equal(done.text, 'The timeout is 15 seconds with two retries.');
  assert.ok(done.elapsedMs >= 0);
});

test('the prompt sent upstream fences documents and keeps the system prompt separate', async () => {
  const body = received.at(-1);
  assert.equal(body.model, 'mock-model');
  assert.equal(body.stream, true);

  const system = body.messages[0];
  assert.equal(system.role, 'system');
  assert.match(system.content, /MODE: DOCUMENT/);

  const user = body.messages.at(-1);
  assert.match(user.content, /<DOCUMENT_CONTEXT note="untrusted/);
  assert.match(user.content, /<REQUEST>/);
  assert.ok(user.content.length < 12_000, 'the prompt must stay compact');
});

test('useDocuments:false skips retrieval entirely', async () => {
  const res = await call('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      provider: 'custom',
      model: 'mock-model',
      mode: 'executive',
      message: 'Summarize',
      useDocuments: false,
    }),
  });
  const frames = await readFrames(res);
  assert.equal(frames.some((f) => f.type === 'sources'), false);
  assert.doesNotMatch(received.at(-1).messages.at(-1).content, /<DOCUMENT_CONTEXT/);
});

test('a provider with no API key yields an error frame, not a crash', async () => {
  const res = await call('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      provider: 'openai',
      model: 'gpt-4o-mini',
      mode: 'executive',
      message: 'hello',
    }),
  });

  assert.equal(res.status, 200, 'the stream still opens so the UI can show the error');
  const error = (await readFrames(res)).find((f) => f.type === 'error');
  assert.match(error.message, /OPENAI_API_KEY/);
  assert.equal(error.retryable, false, 'a missing key is not worth retrying');
});

test('an unknown provider is reported as an error frame', async () => {
  const res = await call('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ provider: 'nope', model: 'x', mode: 'executive', message: 'hi' }),
  });
  const error = (await readFrames(res)).find((f) => f.type === 'error');
  assert.match(error.message, /Unknown provider/);
});

test('chat requires a provider and a message', async () => {
  const noMessage = await call('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ provider: 'custom', model: 'mock-model', mode: 'executive' }),
  });
  assert.equal(noMessage.status, 400);
});

/* ── Deletion ────────────────────────────────────────────────── */

test('deleting a document removes its chunks from retrieval', async () => {
  const listed = await (await call('/api/documents')).json();
  const target = listed.documents.find((d: any) => d.fileName === 'org-priorities.csv');

  const res = await call(`/api/documents/${target.id}`, { method: 'DELETE' });
  assert.equal(res.status, 200);

  const search = await (
    await call('/api/retrieval/search', {
      method: 'POST',
      body: JSON.stringify({ query: 'design system refresh marketing site', minScore: 0 }),
    })
  ).json();
  assert.equal(
    search.chunks.some((c: any) => c.fileName === 'org-priorities.csv'),
    false,
  );

  assert.equal((await call(`/api/documents/${target.id}`, { method: 'DELETE' })).status, 404);
});

test('the file browser refuses to escape the home directory', async () => {
  const res = await call(`/api/files/browse?dir=${encodeURIComponent('/etc')}`);
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /outside the home directory/);
});
