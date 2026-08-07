/**
 * Each provider dialect against a mock endpoint: correct request shape,
 * correct delta extraction, and errors that stay readable.
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import test, { after, before } from 'node:test';
import { anthropic } from '../src/server/llm/anthropic';
import { gemini } from '../src/server/llm/gemini';
import { openaiCompatible } from '../src/server/llm/openaiCompatible';
import { LlmError } from '../src/server/llm/types';
import type { ProviderDef } from '../src/server/providers/registry';

let server: http.Server;
let base: string;
/** Set by each test to control what the mock endpoint does next. */
let handler: (req: http.IncomingMessage, body: string, res: http.ServerResponse) => void;
let lastRequest: { url: string; headers: http.IncomingHttpHeaders; body: any };

before(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      lastRequest = {
        url: req.url ?? '',
        headers: req.headers,
        body: body ? JSON.parse(body) : undefined,
      };
      handler(req, body, res);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});

after(() => new Promise<void>((resolve) => server.close(() => resolve())));

function sse(res: http.ServerResponse, frames: string[]): void {
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  for (const frame of frames) res.write(`data: ${frame}\n\n`);
  res.end();
}

function def(id: string, kind: ProviderDef['kind']): ProviderDef {
  return {
    id,
    label: id,
    kind,
    modelDefault: 'test-model',
    requiresKey: true,
    models: [],
    custom: false,
  };
}

async function drain(gen: AsyncGenerator<string>): Promise<string> {
  let out = '';
  for await (const delta of gen) out += delta;
  return out;
}

const REQUEST = {
  model: 'test-model',
  system: 'SYSTEM PROMPT',
  messages: [{ role: 'user' as const, content: 'question' }],
  maxTokens: 100,
  temperature: 0.3,
};

/* ── OpenAI-compatible ───────────────────────────────────────── */

test('openai-compatible sends the system prompt as the first message', async () => {
  handler = (_req, _body, res) =>
    sse(res, [
      JSON.stringify({ choices: [{ delta: { content: 'Hello' } }] }),
      JSON.stringify({ choices: [{ delta: { content: ' world' } }] }),
      '[DONE]',
    ]);

  const text = await drain(
    openaiCompatible({ ...REQUEST, def: def('openai', 'openai-compatible'), baseUrl: `${base}/v1`, apiKey: 'sk-test' }),
  );

  assert.equal(text, 'Hello world');
  assert.equal(lastRequest.url, '/v1/chat/completions');
  assert.equal(lastRequest.headers.authorization, 'Bearer sk-test');
  assert.equal(lastRequest.body.stream, true);
  assert.deepEqual(lastRequest.body.messages[0], { role: 'system', content: 'SYSTEM PROMPT' });
});

test('openai-compatible ignores keep-alives and empty deltas', async () => {
  handler = (_req, _body, res) =>
    sse(res, [
      JSON.stringify({ choices: [{ delta: {} }] }),
      JSON.stringify({ choices: [{ delta: { content: '' } }] }),
      JSON.stringify({ choices: [{ delta: { content: 'real' } }] }),
      '[DONE]',
    ]);

  const text = await drain(
    openaiCompatible({ ...REQUEST, def: def('groq', 'openai-compatible'), baseUrl: `${base}/v1` }),
  );
  assert.equal(text, 'real');
});

test('a 401 becomes a non-retryable error that names the key', async () => {
  handler = (_req, _body, res) => {
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Incorrect API key provided' } }));
  };

  try {
    await drain(
      openaiCompatible({ ...REQUEST, def: def('openai', 'openai-compatible'), baseUrl: `${base}/v1` }),
    );
    assert.fail('should have thrown');
  } catch (e) {
    const error = e as LlmError;
    assert.match(error.message, /Incorrect API key/);
    assert.match(error.message, /check the API key/);
    assert.equal(error.retryable, false);
  }
});

test('a 500 is retryable, a 429 is retryable', async () => {
  for (const [status, retryable] of [[500, true], [429, true], [404, false]] as const) {
    handler = (_req, _body, res) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'upstream says no' } }));
    };
    try {
      await drain(
        openaiCompatible({ ...REQUEST, def: def('together', 'openai-compatible'), baseUrl: `${base}/v1` }),
      );
      assert.fail(`status ${status} should have thrown`);
    } catch (e) {
      assert.equal((e as LlmError).retryable, retryable, `status ${status}`);
    }
  }
});

test('an error frame mid-stream aborts with a readable message', async () => {
  handler = (_req, _body, res) =>
    sse(res, [
      JSON.stringify({ choices: [{ delta: { content: 'partial' } }] }),
      JSON.stringify({ error: { message: 'context length exceeded' } }),
    ]);

  await assert.rejects(
    drain(openaiCompatible({ ...REQUEST, def: def('deepseek', 'openai-compatible'), baseUrl: `${base}/v1` })),
    /context length exceeded/,
  );
});

test('screenshots are encoded per dialect and only on the final user turn', async () => {
  const image = { mediaType: 'image/jpeg' as const, data: 'QUJD' };

  // OpenAI-shaped: a content array with a data: URI.
  handler = (_req, _body, res) => sse(res, ['[DONE]']);
  await drain(
    openaiCompatible({
      ...REQUEST,
      images: [image],
      def: def('openai', 'openai-compatible'),
      baseUrl: `${base}/v1`,
    }),
  );
  const openaiContent = lastRequest.body.messages.at(-1).content;
  assert.ok(Array.isArray(openaiContent));
  assert.equal(openaiContent[0].type, 'text');
  assert.equal(openaiContent[1].image_url.url, 'data:image/jpeg;base64,QUJD');

  // Anthropic: content blocks carrying raw base64.
  handler = (_req, _body, res) => sse(res, [JSON.stringify({ type: 'message_stop' })]);
  await drain(
    anthropic({ ...REQUEST, images: [image], def: def('anthropic', 'anthropic'), baseUrl: `${base}/v1`, apiKey: 'k' }),
  );
  const anthropicContent = lastRequest.body.messages.at(-1).content;
  assert.equal(anthropicContent[0].type, 'image');
  assert.equal(anthropicContent[0].source.media_type, 'image/jpeg');
  assert.equal(anthropicContent[0].source.data, 'QUJD');
  assert.equal(anthropicContent[1].type, 'text');

  // Gemini: inline_data parts.
  handler = (_req, _body, res) => sse(res, ['{}']);
  await drain(
    gemini({ ...REQUEST, images: [image], def: def('gemini', 'gemini'), baseUrl: base, apiKey: 'k' }),
  );
  const parts = lastRequest.body.contents.at(-1).parts;
  assert.equal(parts[0].inline_data.mime_type, 'image/jpeg');
  assert.equal(parts[0].inline_data.data, 'QUJD');
});

test('no images means the plain string message shape is preserved', async () => {
  handler = (_req, _body, res) => sse(res, ['[DONE]']);
  await drain(
    openaiCompatible({ ...REQUEST, def: def('openai', 'openai-compatible'), baseUrl: `${base}/v1` }),
  );
  assert.equal(typeof lastRequest.body.messages.at(-1).content, 'string');
});

/* ── Anthropic ───────────────────────────────────────────────── */

test('anthropic sends system top-level and reads content_block_delta', async () => {
  handler = (_req, _body, res) =>
    sse(res, [
      JSON.stringify({ type: 'message_start' }),
      JSON.stringify({ type: 'content_block_delta', delta: { text: 'Deci' } }),
      JSON.stringify({ type: 'content_block_delta', delta: { text: 'sion.' } }),
      JSON.stringify({ type: 'message_stop' }),
    ]);

  const text = await drain(
    anthropic({ ...REQUEST, def: def('anthropic', 'anthropic'), baseUrl: `${base}/v1`, apiKey: 'sk-ant' }),
  );

  assert.equal(text, 'Decision.');
  assert.equal(lastRequest.url, '/v1/messages');
  assert.equal(lastRequest.headers['x-api-key'], 'sk-ant');
  assert.equal(lastRequest.headers['anthropic-version'], '2023-06-01');
  // System is a top-level field here, never a message.
  assert.equal(lastRequest.body.system, 'SYSTEM PROMPT');
  assert.equal(lastRequest.body.messages.length, 1);
  assert.equal(lastRequest.body.max_tokens, 100);
});

test('anthropic surfaces a mid-stream error event', async () => {
  handler = (_req, _body, res) =>
    sse(res, [JSON.stringify({ type: 'error', error: { message: 'overloaded_error' } })]);

  await assert.rejects(
    drain(anthropic({ ...REQUEST, def: def('anthropic', 'anthropic'), baseUrl: `${base}/v1`, apiKey: 'k' })),
    /overloaded_error/,
  );
});

/* ── Gemini ──────────────────────────────────────────────────── */

test('gemini puts the model in the path and the key in the query', async () => {
  handler = (_req, _body, res) =>
    sse(res, [
      JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Fifteen ' }] } }] }),
      JSON.stringify({ candidates: [{ content: { parts: [{ text: 'seconds.' }] } }] }),
    ]);

  const text = await drain(
    gemini({ ...REQUEST, def: def('gemini', 'gemini'), baseUrl: base, apiKey: 'gk-test' }),
  );

  assert.equal(text, 'Fifteen seconds.');
  assert.match(lastRequest.url, /^\/models\/test-model:streamGenerateContent/);
  assert.match(lastRequest.url, /alt=sse/);
  assert.match(lastRequest.url, /key=gk-test/);
  assert.equal(lastRequest.body.systemInstruction.parts[0].text, 'SYSTEM PROMPT');
});

test('gemini maps assistant turns to the "model" role', async () => {
  handler = (_req, _body, res) =>
    sse(res, [JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] })]);

  await drain(
    gemini({
      ...REQUEST,
      messages: [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'reply' },
        { role: 'user', content: 'second' },
      ],
      def: def('gemini', 'gemini'),
      baseUrl: base,
      apiKey: 'k',
    }),
  );

  assert.deepEqual(
    lastRequest.body.contents.map((c: any) => c.role),
    ['user', 'model', 'user'],
  );
});

test('gemini reports an API error without dumping the whole body', async () => {
  handler = (_req, _body, res) => {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'API key not valid'.padEnd(600, '.') } }));
  };

  try {
    await drain(gemini({ ...REQUEST, def: def('gemini', 'gemini'), baseUrl: base, apiKey: 'bad' }));
    assert.fail('should have thrown');
  } catch (e) {
    const error = e as LlmError;
    assert.match(error.message, /API key not valid/);
    assert.ok(error.message.length < 320, 'error messages must fit the overlay');
  }
});
