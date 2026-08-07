import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { cosine, hashEmbedder, normalize } from '../src/server/rag/embeddings';
import { JsonVectorStore, type StoredChunk } from '../src/server/rag/vectorStore';

function tmpFile(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sma-')), 'vectors.json');
}

function chunk(id: string, vector: number[], overrides: Partial<StoredChunk> = {}): StoredChunk {
  return {
    chunkId: id,
    documentId: overrides.documentId ?? 'doc-1',
    fileName: 'spec.md',
    uploadedAt: Date.now(),
    text: `text for ${id}`,
    embedderId: overrides.embedderId ?? 'test:v1',
    vector: normalize(vector),
    ...overrides,
  };
}

test('cosine similarity ranks the nearest vector first', () => {
  const query = normalize([1, 0, 0]);
  assert.ok(cosine(query, normalize([1, 0.1, 0])) > cosine(query, normalize([0, 1, 0])));
  assert.ok(Math.abs(cosine(query, normalize([2, 0, 0])) - 1) < 1e-9);
});

test('search returns the top matches in score order', async () => {
  const store = new JsonVectorStore(tmpFile());
  await store.add([
    chunk('near', [1, 0.05, 0]),
    chunk('mid', [0.6, 0.6, 0]),
    chunk('far', [0, 0, 1]),
  ]);

  const hits = await store.search(normalize([1, 0, 0]), { topK: 2, embedderId: 'test:v1' });
  assert.equal(hits.length, 2);
  assert.equal(hits[0].chunkId, 'near');
  assert.ok(hits[0].score >= hits[1].score);
});

test('minScore filters weak matches out', async () => {
  const store = new JsonVectorStore(tmpFile());
  await store.add([chunk('near', [1, 0, 0]), chunk('orthogonal', [0, 1, 0])]);

  const hits = await store.search(normalize([1, 0, 0]), {
    topK: 5,
    embedderId: 'test:v1',
    minScore: 0.5,
  });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].chunkId, 'near');
});

test('vectors from a different embedder are never compared', async () => {
  const store = new JsonVectorStore(tmpFile());
  await store.add([
    chunk('same', [1, 0, 0], { embedderId: 'test:v1' }),
    chunk('other', [1, 0, 0], { embedderId: 'local:minilm' }),
  ]);

  const hits = await store.search(normalize([1, 0, 0]), { topK: 5, embedderId: 'test:v1' });
  assert.deepEqual(hits.map((h) => h.chunkId), ['same']);
});

test('removing a document drops only its chunks', async () => {
  const store = new JsonVectorStore(tmpFile());
  await store.add([
    chunk('a1', [1, 0, 0], { documentId: 'a' }),
    chunk('a2', [0, 1, 0], { documentId: 'a' }),
    chunk('b1', [0, 0, 1], { documentId: 'b' }),
  ]);

  assert.equal(await store.removeByDocument('a'), 2);
  assert.equal(await store.count(), 1);
  assert.equal(await store.countByDocument('b'), 1);
});

test('the store survives a reload from disk', async () => {
  const file = tmpFile();
  const first = new JsonVectorStore(file);
  await first.add([chunk('persisted', [1, 0, 0])]);
  first.flushSync();

  const reopened = new JsonVectorStore(file);
  assert.equal(await reopened.count(), 1);
  const hits = await reopened.search(normalize([1, 0, 0]), { topK: 1, embedderId: 'test:v1' });
  assert.equal(hits[0].chunkId, 'persisted');
});

test('hash embedder is deterministic, normalized and topically ordered', async () => {
  const embedder = hashEmbedder();
  const [a, b] = await embedder.embed(['payment gateway timeout', 'payment gateway timeout']);
  assert.deepEqual(a, b);

  const magnitude = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  assert.ok(Math.abs(magnitude - 1) < 1e-9, 'vectors should be unit length');

  const [query, related, unrelated] = await embedder.embed([
    'what is the api timeout',
    'the api timeout is fifteen seconds',
    'design system refresh for the marketing site',
  ]);
  assert.ok(cosine(query, related) > cosine(query, unrelated));
});
