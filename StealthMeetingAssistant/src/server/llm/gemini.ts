import { readSse } from './sse';
import { httpError, LlmError, type LlmAdapter } from './types';

/** Google Generative Language API: `model` in the path, `parts` in the body. */
export const gemini: LlmAdapter = async function* (req) {
  const url =
    `${req.baseUrl}/models/${encodeURIComponent(req.model)}:streamGenerateContent` +
    `?alt=sse&key=${encodeURIComponent(req.apiKey ?? '')}`;

  const res = await fetch(url, {
    method: 'POST',
    signal: req.signal,
    headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: req.system }] },
      contents: req.messages.map((m, i) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts:
          // Images ride along with the final user turn as inline_data.
          i === req.messages.length - 1 && m.role === 'user' && req.images?.length
            ? [
                ...req.images.map((image) => ({
                  inline_data: { mime_type: image.mediaType, data: image.data },
                })),
                { text: m.content },
              ]
            : [{ text: m.content }],
      })),
      generationConfig: {
        temperature: req.temperature,
        maxOutputTokens: req.maxTokens,
      },
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
    if (parsed?.error) {
      throw new LlmError(`${req.def.label}: ${parsed.error.message ?? 'stream error'}`);
    }
    const parts = parsed?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      for (const part of parts) {
        if (typeof part?.text === 'string' && part.text) yield part.text;
      }
    }
  }
};
