import { readSse } from './sse';
import { httpError, LlmError, type LlmAdapter } from './types';

/** Anthropic takes images as content blocks carrying raw base64. */
function withImages(req: Parameters<LlmAdapter>[0]): unknown[] {
  if (!req.images?.length) return req.messages;
  const messages: unknown[] = req.messages.slice();
  const last = req.messages[req.messages.length - 1];
  if (!last || last.role !== 'user') return messages;

  messages[messages.length - 1] = {
    role: 'user',
    content: [
      // Images first: Anthropic recommends placing them before the question.
      ...req.images.map((image) => ({
        type: 'image',
        source: { type: 'base64', media_type: image.mediaType, data: image.data },
      })),
      { type: 'text', text: last.content },
    ],
  };
  return messages;
}

/** Anthropic Messages API — system prompt is a top-level field, not a message. */
export const anthropic: LlmAdapter = async function* (req) {
  const res = await fetch(`${req.baseUrl}/messages`, {
    method: 'POST',
    signal: req.signal,
    headers: {
      'content-type': 'application/json',
      accept: 'text/event-stream',
      'x-api-key': req.apiKey ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: req.model,
      stream: true,
      system: req.system,
      max_tokens: req.maxTokens,
      temperature: req.temperature,
      messages: withImages(req),
    }),
  });

  if (!res.ok) throw await httpError(res, req.def.label);
  if (!res.body) throw new LlmError(`${req.def.label} returned an empty stream`);

  for await (const evt of readSse(res.body)) {
    let parsed: any;
    try {
      parsed = JSON.parse(evt.data);
    } catch {
      continue;
    }
    switch (parsed?.type) {
      case 'content_block_delta': {
        const text = parsed.delta?.text;
        if (typeof text === 'string' && text) yield text;
        break;
      }
      case 'error':
        throw new LlmError(
          `${req.def.label}: ${parsed.error?.message ?? 'stream error'}`,
        );
      case 'message_stop':
        return;
      default:
        break; // ping, message_start, content_block_start/stop
    }
  }
};
