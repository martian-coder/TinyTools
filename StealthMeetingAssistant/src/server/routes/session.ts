import { Router } from 'express';
import { deliveryMetrics } from '../session/delivery';
import { retrieve } from '../rag/retrieve';
import { transcript } from '../session/transcript';
import type { SearchResponse } from '../../shared/types';

export const sessionRouter = Router();

/**
 * POST /api/session/transcript — one event, or `{ events: [...] }` for a batch.
 * This is the seam a Deepgram/AssemblyAI/Whisper bridge plugs into later; the
 * WebSocket endpoint in ws.ts accepts the identical shape.
 */
sessionRouter.post('/session/transcript', (req, res) => {
  const payload = req.body ?? {};
  const events = Array.isArray(payload.events) ? payload.events : [payload];
  const accepted = events
    .map((e: unknown) => transcript.append(e as never))
    .filter(Boolean);

  if (!accepted.length) {
    return res.status(400).json({ error: 'No usable transcript events (text is required)' });
  }
  res.json({ accepted: accepted.length, total: transcript.count() });
});

sessionRouter.get('/session/transcript', (req, res) => {
  const limit = Number(req.query.limit ?? 40);
  const minutes = Number(req.query.minutes ?? 0);
  const lines = minutes > 0 ? transcript.since(minutes) : transcript.recent(limit || 40);
  res.json({ lines, total: transcript.count() });
});

sessionRouter.delete('/session/transcript', (_req, res) => {
  transcript.clear();
  res.json({ ok: true });
});

/** GET /api/session/delivery — pace, fillers and talk ratio, computed locally. */
sessionRouter.get('/session/delivery', (req, res) => {
  const minutes = Number(req.query.minutes ?? 0);
  const lines = minutes > 0 ? transcript.since(minutes) : transcript.all();
  res.json(deliveryMetrics(lines));
});

/** POST /api/retrieval/search — retrieval on its own, for the Ctrl+Shift+R hotkey. */
sessionRouter.post('/retrieval/search', async (req, res) => {
  const query = String(req.body?.query ?? '').trim();
  if (!query) return res.status(400).json({ error: 'query is required' });
  try {
    const result = await retrieve({
      query,
      topK: Number(req.body?.topK) || undefined,
      minScore:
        req.body?.minScore === undefined ? undefined : Number(req.body.minScore),
      transcript: Array.isArray(req.body?.transcriptContext)
        ? req.body.transcriptContext
        : transcript.recent(12),
    });
    const body: SearchResponse = {
      chunks: result.chunks,
      embedder: result.embedder,
      note: result.note,
    };
    res.json(body);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
