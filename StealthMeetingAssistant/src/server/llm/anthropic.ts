import { readSse } from './sse';
import { httpError, LlmError, type LlmAdapter } from './types';

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
      messages: req.messages,
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
