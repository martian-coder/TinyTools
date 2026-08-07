import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable } from 'node:stream';
import { readSse } from '../src/server/llm/sse';

/** Emit a payload in arbitrary byte-sized pieces to simulate network chunking. */
function chunked(text: string, size: number): Readable {
  const bytes = Buffer.from(text, 'utf8');
  const parts: Buffer[] = [];
  for (let i = 0; i < bytes.length; i += size) parts.push(bytes.subarray(i, i + size));
  return Readable.from(parts);
}

test('parses well-formed SSE events', async () => {
  const stream = chunked('data: {"a":1}\n\ndata: {"a":2}\n\n', 1024);
  const events = [];
  for await (const event of readSse(stream)) events.push(event.data);
  assert.deepEqual(events, ['{"a":1}', '{"a":2}']);
});

test('reassembles events split across chunk boundaries', async () => {
  // Three bytes at a time guarantees frames are torn mid-JSON.
  const stream = chunked('data: {"text":"hello world"}\n\ndata: [DONE]\n\n', 3);
  const events = [];
  for await (const event of readSse(stream)) events.push(event.data);
  assert.deepEqual(events, ['{"text":"hello world"}', '[DONE]']);
});

test('handles CRLF line endings', async () => {
  const stream = chunked('data: one\r\n\r\ndata: two\r\n\r\n', 1024);
  const events = [];
  for await (const event of readSse(stream)) events.push(event.data);
  assert.deepEqual(events, ['one', 'two']);
});

test('joins multi-line data fields and reads the event name', async () => {
  const stream = chunked('event: message_stop\ndata: line1\ndata: line2\n\n', 1024);
  const [event] = await collect(stream);
  assert.equal(event.event, 'message_stop');
  assert.equal(event.data, 'line1\nline2');
});

test('ignores comments and keep-alive pings', async () => {
  const stream = chunked(': ping\n\ndata: real\n\n', 1024);
  const events = await collect(stream);
  assert.equal(events.length, 1);
  assert.equal(events[0].data, 'real');
});

test('emits a trailing event that has no terminating blank line', async () => {
  const stream = chunked('data: last', 1024);
  const events = await collect(stream);
  assert.deepEqual(events.map((e) => e.data), ['last']);
});

async function collect(stream: Readable) {
  const out = [];
  for await (const event of readSse(stream)) out.push(event);
  return out;
}
