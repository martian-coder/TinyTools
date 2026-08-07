import { readSse } from './sse';
import { httpError, LlmError, type LlmAdapter } from './types';

/**
 * Covers OpenAI, Qwen, OpenRouter, Groq, DeepSeek, Together, Ollama and any
 * custom endpoint — everything that speaks /chat/completions.
 */
export const openaiCompatible: LlmAdapter = async function* (req) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'text/event-stream',
  };
  if (req.apiKey) headers.authorization = `Bearer ${req.apiKey}`;
  if (req.def.id === 'openrouter') {
    // OpenRouter attributes traffic with these; harmless elsewhere.
    headers['http-referer'] = 'http://localhost';
    headers['x-title'] = 'Stealth Meeting Assistant';
  }

  const res = await fetch(`${req.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    signal: req.signal,
    body: JSON.stringify({
      model: req.model,
      stream: true,
      temperature: req.temperature,
      max_tokens: req.maxTokens,
      messages: [{ role: 'system', content: req.system }, ...req.messages],
    }),
  });

  if (!res.ok) throw await httpError(res, req.def.label);
  if (!res.body) throw new LlmError(`${req.def.label} returned an empty stream`);

  for await (const evt of readSse(res.body)) {
    if (evt.data === '[DONE]') return;
    let parsed: any;
    try {
      parsed = JSON.parse(evt.data);
    } catch {
      continue; // keep-alive or partial frame
    }
    if (parsed?.error) {
      throw new LlmError(`${req.def.label}: ${parsed.error.message ?? 'stream error'}`);
    }
    const delta = parsed?.choices?.[0]?.delta;
    // Some gateways emit `message.content` instead of `delta.content`.
    const text = delta?.content ?? parsed?.choices?.[0]?.message?.content;
    if (typeof text === 'string' && text) yield text;
  }
};

/** Ask an OpenAI-compatible endpoint what models it actually has. */
export async function listOpenAiModels(
  baseUrl: string,
  apiKey: string | undefined,
  timeoutMs = 2500,
): Promise<string[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {},
      signal: ctrl.signal,
    });
    if (!res.ok) return [];
    const body: any = await res.json();
    const list = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
    return list
      .map((m: any) => (typeof m === 'string' ? m : m?.id))
      .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
