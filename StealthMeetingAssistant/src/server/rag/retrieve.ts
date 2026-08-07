import { num } from '../config';
import type { RetrievedChunk, TranscriptEvent } from '../../shared/types';
import { getEmbedder } from './embeddings';
import { vectorStore } from './vectorStore';

export interface RetrieveOptions {
  query: string;
  /** Recent transcript lines, blended into the query for topical grounding. */
  transcript?: TranscriptEvent[];
  topK?: number;
  minScore?: number;
}

export interface RetrieveResult {
  chunks: RetrievedChunk[];
  embedder: string;
  /** Set when the result is empty for a reason worth showing the user. */
  note?: string;
}

const MAX_TRANSCRIPT_CHARS = 800;

/**
 * The question alone is often too thin ("what did we decide?"), so the last
 * few transcript lines are appended to give the query topical anchors. The
 * question is repeated first so it still dominates the vector.
 */
export function buildQuery(query: string, transcript: TranscriptEvent[] = []): string {
  const recent = transcript
    .filter((t) => t.isFinal !== false && t.text.trim())
    .slice(-6)
    .map((t) => t.text.trim())
    .join(' ');
  if (!recent) return query;
  const trimmed =
    recent.length > MAX_TRANSCRIPT_CHARS ? recent.slice(-MAX_TRANSCRIPT_CHARS) : recent;
  return `${query}\n\n${trimmed}`;
}

export async function retrieve(opts: RetrieveOptions): Promise<RetrieveResult> {
  const embedder = await getEmbedder();
  const store = vectorStore();

  if ((await store.count()) === 0) {
    return { chunks: [], embedder: embedder.id, note: 'No documents attached.' };
  }

  const text = buildQuery(opts.query.trim(), opts.transcript);
  if (!text) return { chunks: [], embedder: embedder.id, note: 'Empty query.' };

  const topK = clamp(opts.topK ?? num('RETRIEVAL_TOP_K', 6), 1, 20);
  // Explicit request wins, then RETRIEVAL_MIN_SCORE, then the floor that
  // suits whichever embedder is actually loaded.
  const minScore = opts.minScore ?? num('RETRIEVAL_MIN_SCORE', embedder.minScore);

  const [vector] = await embedder.embed([text]);
  let hits = await store.search(vector, { topK, embedderId: embedder.id, minScore });

  // Nothing cleared the bar: show the best few anyway, flagged as weak, rather
  // than pretending the documents are empty.
  let note: string | undefined;
  if (!hits.length) {
    const fallback = await store.search(vector, { topK: 3, embedderId: embedder.id });
    if (fallback.length) {
      hits = fallback;
      note = 'Weak matches only — these may not be relevant.';
    } else {
      note =
        'No chunks match the current embedding model. Re-index your documents if you changed EMBEDDINGS_MODE.';
    }
  }

  return {
    embedder: embedder.id,
    note,
    chunks: hits.map((h) => ({
      chunkId: h.chunkId,
      documentId: h.documentId,
      fileName: h.fileName,
      page: h.page,
      section: h.section,
      uploadedAt: h.uploadedAt,
      score: h.score,
      text: h.text,
    })),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
