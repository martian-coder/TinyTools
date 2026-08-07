import { Router } from 'express';
import { streamCompletion } from '../llm/router';
import { LlmError } from '../llm/types';
import { buildUserMessage, systemPrompt } from '../prompts/modes';
import { retrieve } from '../rag/retrieve';
import { transcript } from '../session/transcript';
import {
  ASSISTANT_MODES,
  type AssistantMode,
  type ChatRequest,
  type ChatStreamFrame,
  type RetrievedChunk,
} from '../../shared/types';

export const chatRouter = Router();

const MAX_HISTORY_TURNS = 8;

/**
 * POST /api/chat — streams NDJSON frames (one JSON object per line).
 *
 * NDJSON rather than SSE because the overlay POSTs a body, so it reads the
 * response with fetch + a stream reader; EventSource cannot POST.
 */
chatRouter.post('/chat', async (req, res) => {
  const body = (req.body ?? {}) as ChatRequest;
  const message = String(body.message ?? '').trim();
  const action = body.action;

  if (!message && !action) {
    return res.status(400).json({ error: 'message or action is required' });
  }
  if (!body.provider) {
    return res.status(400).json({ error: 'provider is required' });
  }

  const mode: AssistantMode = ASSISTANT_MODES.includes(body.mode) ? body.mode : 'executive';

  res.status(200);
  res.setHeader('content-type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('cache-control', 'no-cache, no-transform');
  res.setHeader('x-accel-buffering', 'no');
  res.flushHeaders?.();

  const send = (frame: ChatStreamFrame) => {
    if (!res.writableEnded) res.write(`${JSON.stringify(frame)}\n`);
  };

  // Abort the upstream request if the overlay closes the connection.
  // This must listen on the *response*: `req`'s 'close' fires as soon as the
  // request body has been read, which is immediately, and would cancel every
  // stream before it started.
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) controller.abort();
  });

  const started = Date.now();
  send({ type: 'meta', provider: body.provider, model: body.model, mode });

  try {
    const transcriptContext = Array.isArray(body.transcriptContext) && body.transcriptContext.length
      ? body.transcriptContext.slice(-40)
      : transcript.recent(24);

    // Document mode always retrieves; other modes honour the toggle.
    const useDocuments = mode === 'document' ? true : body.useDocuments !== false;

    let chunks: RetrievedChunk[] = [];
    if (useDocuments) {
      const result = await retrieve({
        query: message || `Meeting assistant action: ${action}`,
        transcript: transcriptContext,
      });
      chunks = result.chunks;
      send({ type: 'sources', sources: chunks, note: result.note });
    }

    const history = (body.history ?? [])
      .filter((m) => m && typeof m.content === 'string' && m.content.trim())
      .slice(-MAX_HISTORY_TURNS)
      .map((m) => ({
        role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: m.content.slice(0, 8000),
      }));

    const userMessage = buildUserMessage({
      message,
      action,
      chunks,
      transcript: transcriptContext,
      documentsRequested: useDocuments,
    });

    let full = '';
    for await (const delta of streamCompletion({
      provider: body.provider,
      model: body.model,
      system: systemPrompt(mode),
      messages: [...history, { role: 'user', content: userMessage }],
      signal: controller.signal,
      maxTokens: action === 'follow-up-email' ? 900 : 700,
    })) {
      full += delta;
      send({ type: 'delta', text: delta });
    }

    if (!full.trim()) {
      send({
        type: 'error',
        message: 'The provider returned an empty response.',
        retryable: true,
      });
    } else {
      send({ type: 'done', text: full, elapsedMs: Date.now() - started });
    }
  } catch (err) {
    if (controller.signal.aborted) {
      res.end();
      return;
    }
    const isLlm = err instanceof LlmError;
    send({
      type: 'error',
      message: isLlm ? err.message : `Unexpected error: ${(err as Error).message}`,
      retryable: isLlm ? err.retryable : true,
    });
  } finally {
    if (!res.writableEnded) res.end();
  }
});
