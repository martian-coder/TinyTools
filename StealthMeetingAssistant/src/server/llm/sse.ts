/**
 * Minimal Server-Sent Events reader. All three provider dialects stream SSE,
 * they just disagree about what goes in the `data:` payload.
 */
export interface SseEvent {
  event?: string;
  data: string;
}

/** Parse a byte stream into SSE events, tolerating chunk boundaries mid-frame. */
export async function* readSse(
  body: ReadableStream<Uint8Array> | NodeJS.ReadableStream,
): AsyncGenerator<SseEvent, void, unknown> {
  const decoder = new TextDecoder();
  let buffer = '';

  for await (const chunk of iterate(body)) {
    buffer += decoder.decode(chunk as Uint8Array, { stream: true });
    // Events are separated by a blank line; \r\n is legal too.
    let sep: number;
    while ((sep = indexOfSeparator(buffer)) !== -1) {
      const raw = buffer.slice(0, sep);
      buffer = buffer.slice(sep).replace(/^(\r?\n){2}/, '');
      const parsed = parseEvent(raw);
      if (parsed) yield parsed;
    }
  }

  buffer += decoder.decode();
  const tail = parseEvent(buffer);
  if (tail) yield tail;
}

function indexOfSeparator(buffer: string): number {
  const a = buffer.indexOf('\n\n');
  const b = buffer.indexOf('\r\n\r\n');
  if (a === -1) return b;
  if (b === -1) return a;
  return Math.min(a, b);
}

function parseEvent(raw: string): SseEvent | undefined {
  const dataLines: string[] = [];
  let event: string | undefined;
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'data') dataLines.push(value);
    else if (field === 'event') event = value;
  }
  if (!dataLines.length) return undefined;
  return { event, data: dataLines.join('\n') };
}

async function* iterate(
  body: ReadableStream<Uint8Array> | NodeJS.ReadableStream,
): AsyncGenerator<unknown, void, unknown> {
  if (Symbol.asyncIterator in Object(body)) {
    yield* body as unknown as AsyncIterable<unknown>;
    return;
  }
  const reader = (body as ReadableStream<Uint8Array>).getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      if (value) yield value;
    }
  } finally {
    reader.releaseLock();
  }
}
