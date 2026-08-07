import { dataPath, readJson, writeJson } from '../config';
import { cosine } from './embeddings';

export interface StoredChunk {
  chunkId: string;
  documentId: string;
  fileName: string;
  page?: number;
  section?: string;
  uploadedAt: number;
  text: string;
  embedderId: string;
  vector: number[];
}

export interface ScoredChunk extends StoredChunk {
  score: number;
}

/**
 * Swap-in point for sqlite-vec / LanceDB / pgvector later. Nothing above this
 * interface knows how vectors are stored or searched.
 */
export interface VectorStore {
  add(chunks: StoredChunk[]): Promise<void>;
  removeByDocument(documentId: string): Promise<number>;
  search(
    vector: number[],
    opts: { topK: number; embedderId: string; minScore?: number },
  ): Promise<ScoredChunk[]>;
  countByDocument(documentId: string): Promise<number>;
  count(): Promise<number>;
  clear(): Promise<void>;
}

interface StoreFile {
  version: 1;
  chunks: StoredChunk[];
}

/**
 * JSON-file store with brute-force cosine search. Linear scan is fine into
 * the low tens of thousands of chunks, which is far more than a meeting's
 * worth of attachments.
 */
export class JsonVectorStore implements VectorStore {
  private chunks: StoredChunk[];
  private readonly file: string;
  private dirty = false;
  private flushTimer: NodeJS.Timeout | undefined;

  constructor(file = dataPath('vectors.json')) {
    this.file = file;
    this.chunks = readJson<StoreFile>(file, { version: 1, chunks: [] }).chunks ?? [];
  }

  async add(chunks: StoredChunk[]): Promise<void> {
    this.chunks.push(...chunks);
    this.schedulePersist();
  }

  async removeByDocument(documentId: string): Promise<number> {
    const before = this.chunks.length;
    this.chunks = this.chunks.filter((c) => c.documentId !== documentId);
    const removed = before - this.chunks.length;
    if (removed) this.schedulePersist();
    return removed;
  }

  async search(
    vector: number[],
    opts: { topK: number; embedderId: string; minScore?: number },
  ): Promise<ScoredChunk[]> {
    const minScore = opts.minScore ?? -1;
    const scored: ScoredChunk[] = [];
    for (const chunk of this.chunks) {
      // Never compare vectors produced by different models.
      if (chunk.embedderId !== opts.embedderId) continue;
      const score = cosine(vector, chunk.vector);
      if (score < minScore) continue;
      scored.push({ ...chunk, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, opts.topK);
  }

  async countByDocument(documentId: string): Promise<number> {
    return this.chunks.filter((c) => c.documentId === documentId).length;
  }

  async count(): Promise<number> {
    return this.chunks.length;
  }

  async clear(): Promise<void> {
    this.chunks = [];
    this.schedulePersist();
  }

  /** Coalesce writes — indexing adds chunks in bursts. */
  private schedulePersist(): void {
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      this.flushSync();
    }, 250);
    this.flushTimer.unref?.();
  }

  flushSync(): void {
    if (!this.dirty) return;
    this.dirty = false;
    writeJson(this.file, { version: 1, chunks: this.chunks } satisfies StoreFile);
  }
}

let instance: VectorStore | undefined;

export function vectorStore(): VectorStore {
  if (!instance) instance = new JsonVectorStore();
  return instance;
}

/** Tests inject an in-memory store through here. */
export function setVectorStore(store: VectorStore | undefined): void {
  instance = store;
}
