import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { dataPath, num, readJson, writeJson } from '../config';
import type { DocumentInfo, DocumentStatus } from '../../shared/types';
import { chunkBlocks } from './chunk';
import { getEmbedder } from './embeddings';
import { isSupported, parseDocument } from './parse';
import { vectorStore, type StoredChunk } from './vectorStore';

const MAX_BYTES = 25 * 1024 * 1024;

function indexFile(): string {
  return dataPath('documents.json');
}

function loadIndex(): DocumentInfo[] {
  return readJson<DocumentInfo[]>(indexFile(), []);
}

function saveIndex(docs: DocumentInfo[]): void {
  writeJson(indexFile(), docs);
}

/** Overlay subscribes to this to animate indexing status without polling. */
export const documentEvents = new EventEmitter();

function upsert(doc: DocumentInfo): void {
  const docs = loadIndex().filter((d) => d.id !== doc.id);
  docs.push(doc);
  saveIndex(docs);
  documentEvents.emit('change', doc);
}

function setStatus(id: string, status: DocumentStatus, patch: Partial<DocumentInfo> = {}): void {
  const docs = loadIndex();
  const doc = docs.find((d) => d.id === id);
  if (!doc) return;
  Object.assign(doc, patch, { status });
  saveIndex(docs);
  documentEvents.emit('change', doc);
}

export function listDocuments(): DocumentInfo[] {
  return loadIndex().sort((a, b) => b.uploadedAt - a.uploadedAt);
}

export function getDocument(id: string): DocumentInfo | undefined {
  return loadIndex().find((d) => d.id === id);
}

export async function deleteDocument(id: string): Promise<boolean> {
  const docs = loadIndex();
  const doc = docs.find((d) => d.id === id);
  if (!doc) return false;
  await vectorStore().removeByDocument(id);
  saveIndex(docs.filter((d) => d.id !== id));
  documentEvents.emit('change', { ...doc, status: 'removed' });
  return true;
}

export interface IngestResult {
  document: DocumentInfo;
  /** True when an identical file was already indexed and nothing was redone. */
  deduplicated: boolean;
  /** True when a same-named file with new content replaced an old version. */
  replaced: boolean;
}

/**
 * Ingest bytes: hash → dedupe → parse → chunk → embed → store.
 *
 * Identical content (same hash) is a no-op. Same file name with different
 * content replaces the previous version, which is what re-uploading an edited
 * spec mid-meeting should do.
 */
export async function ingestDocument(
  fileName: string,
  buffer: Buffer,
): Promise<IngestResult> {
  const safeName = sanitizeName(fileName);
  if (!isSupported(safeName)) {
    throw new Error(`Unsupported file type: ${safeName}`);
  }
  if (buffer.length === 0) throw new Error('File is empty');
  if (buffer.length > MAX_BYTES) {
    throw new Error(`File is larger than ${Math.round(MAX_BYTES / 1024 / 1024)} MB`);
  }

  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const existingByHash = loadIndex().find((d) => d.hash === hash && d.status === 'ready');
  if (existingByHash) {
    return { document: existingByHash, deduplicated: true, replaced: false };
  }

  const sameName = loadIndex().filter((d) => d.fileName === safeName);
  for (const stale of sameName) await deleteDocument(stale.id);

  const doc: DocumentInfo = {
    id: crypto.randomUUID(),
    fileName: safeName,
    ext: safeName.slice(safeName.lastIndexOf('.')).toLowerCase(),
    bytes: buffer.length,
    hash,
    status: 'queued',
    chunkCount: 0,
    uploadedAt: Date.now(),
  };
  upsert(doc);

  try {
    setStatus(doc.id, 'parsing');
    const parsed = await parseDocument(safeName, buffer);
    if (!parsed.blocks.length) {
      throw new Error('No extractable text found (is it a scanned image PDF?)');
    }

    const chunks = chunkBlocks(parsed.blocks, {
      targetTokens: num('CHUNK_TARGET_TOKENS', 900),
      overlapTokens: num('CHUNK_OVERLAP_TOKENS', 100),
    });

    setStatus(doc.id, 'embedding', { pageCount: parsed.pageCount, chunkCount: chunks.length });

    const embedder = await getEmbedder();
    const vectors = await embedder.embed(chunks.map((c) => c.text));
    if (vectors.length !== chunks.length) {
      throw new Error('Embedder returned the wrong number of vectors');
    }

    const stored: StoredChunk[] = chunks.map((chunk, i) => ({
      chunkId: `${doc.id}:${chunk.index}`,
      documentId: doc.id,
      fileName: safeName,
      page: chunk.page,
      section: chunk.section,
      uploadedAt: doc.uploadedAt,
      text: chunk.text,
      embedderId: embedder.id,
      vector: vectors[i],
    }));
    await vectorStore().add(stored);

    setStatus(doc.id, 'ready', {
      chunkCount: stored.length,
      pageCount: parsed.pageCount,
      embedderId: embedder.id,
      error: undefined,
    });
  } catch (err) {
    setStatus(doc.id, 'error', { error: (err as Error).message });
  }

  const finalDoc = getDocument(doc.id)!;
  if (finalDoc.status === 'error') throw new Error(finalDoc.error ?? 'Indexing failed');
  return { document: finalDoc, deduplicated: false, replaced: sameName.length > 0 };
}

/** Strip path components and control characters a client might send. */
function sanitizeName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return cleaned || "untitled.txt";
}
