import crypto from 'node:crypto';
import {
  findProvider,
  resolveApiKey,
  resolveBaseUrl,
} from '../providers/registry';

/**
 * `id` is stored alongside every vector. Vectors are only ever compared to
 * vectors from the same embedder, so switching models degrades to "re-index
 * needed" instead of silently returning garbage neighbours.
 */
export interface Embedder {
  id: string;
  dim: number;
  /**
   * Cosine scores are not comparable across embedding models: a strong match
   * from MiniLM sits near 0.5, while the hash embedder rarely clears 0.15.
   * Each embedder therefore carries its own relevance floor, so the retrieval
   * threshold stays meaningful when you switch modes.
   */
  minScore: number;
  embed(texts: string[]): Promise<number[][]>;
}

let cached: Embedder | undefined;
let warned = false;

/** Resolve the configured embedder once, falling back down the chain. */
export async function getEmbedder(): Promise<Embedder> {
  if (cached) return cached;
  const mode = (process.env.EMBEDDINGS_MODE ?? 'local').toLowerCase();

  if (mode === 'hash') {
    cached = hashEmbedder();
    return cached;
  }

  if (mode === 'api') {
    const api = apiEmbedder();
    if (api) {
      cached = api;
      return cached;
    }
    console.warn('[embeddings] API mode configured but provider unavailable; trying local.');
  }

  try {
    cached = await localEmbedder();
    return cached;
  } catch (err) {
    if (!warned) {
      warned = true;
      console.warn(
        `[embeddings] Local model unavailable (${(err as Error).message}). ` +
          'Falling back to the hash embedder — retrieval quality will be keyword-ish. ' +
          'Install @huggingface/transformers or set EMBEDDINGS_MODE=api.',
      );
    }
    const api = apiEmbedder();
    cached = api ?? hashEmbedder();
    return cached;
  }
}

/** Used by the re-index flow when the user changes embedding settings. */
export function resetEmbedder(): void {
  cached = undefined;
}

/** Transformers.js, on-device, no network after the first model download. */
async function localEmbedder(): Promise<Embedder> {
  const modelId = process.env.EMBEDDINGS_LOCAL_MODEL ?? 'Xenova/all-MiniLM-L6-v2';
  // Optional dependency + ESM-only, so it has to be a dynamic import.
  const mod: any = await import('@huggingface/transformers');
  const extractor = await mod.pipeline('feature-extraction', modelId);

  return {
    id: `local:${modelId}`,
    dim: 384,
    minScore: 0.25,
    async embed(texts) {
      const out: number[][] = [];
      // Batch of 8 keeps peak memory modest on laptops.
      for (let i = 0; i < texts.length; i += 8) {
        const batch = texts.slice(i, i + 8);
        const result = await extractor(batch, { pooling: 'mean', normalize: true });
        const list = result.tolist() as number[][];
        out.push(...list.map(normalize));
      }
      return out;
    },
  };
}

/** Any OpenAI-compatible /embeddings endpoint. */
function apiEmbedder(): Embedder | undefined {
  const providerId = process.env.EMBEDDINGS_API_PROVIDER ?? 'openai';
  const model = process.env.EMBEDDINGS_API_MODEL ?? 'text-embedding-3-small';
  const def = findProvider(providerId);
  if (!def || def.kind !== 'openai-compatible') return undefined;
  const baseUrl = resolveBaseUrl(def);
  const apiKey = resolveApiKey(def);
  if (!baseUrl || (def.requiresKey && !apiKey)) return undefined;

  return {
    id: `api:${providerId}:${model}`,
    dim: 0, // learned from the first response
    minScore: 0.25,
    async embed(texts) {
      const out: number[][] = [];
      for (let i = 0; i < texts.length; i += 64) {
        const res = await fetch(`${baseUrl}/embeddings`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({ model, input: texts.slice(i, i + 64) }),
        });
        if (!res.ok) {
          throw new Error(`Embedding request failed (${res.status} ${res.statusText})`);
        }
        const body: any = await res.json();
        for (const item of body.data ?? []) out.push(normalize(item.embedding));
      }
      return out;
    },
  };
}

const HASH_DIM = 384;

/**
 * Last-resort embedder: hashed word/bigram bag-of-words. No downloads, no
 * network, deterministic. Behaves like fuzzy keyword search — good enough to
 * keep the app usable offline, not good enough to be the default.
 */
export function hashEmbedder(): Embedder {
  return {
    id: `hash:v1:${HASH_DIM}`,
    dim: HASH_DIM,
    // Bag-of-words scores are compressed; 0.25 would reject everything.
    minScore: 0.06,
    async embed(texts) {
      return texts.map((text) => {
        const vec = new Array<number>(HASH_DIM).fill(0);
        const tokens = tokenize(text);
        for (let i = 0; i < tokens.length; i++) {
          add(vec, tokens[i], 1);
          if (i + 1 < tokens.length) add(vec, `${tokens[i]}_${tokens[i + 1]}`, 0.5);
        }
        return normalize(vec);
      });
    },
  };
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && t.length < 40);
}

function add(vec: number[], token: string, weight: number): void {
  const digest = crypto.createHash('md5').update(token).digest();
  const bucket = digest.readUInt32BE(0) % HASH_DIM;
  // Sign bit spreads tokens across the space instead of only adding mass.
  const sign = (digest[4] & 1) === 0 ? 1 : -1;
  vec[bucket] += weight * sign;
}

export function normalize(vec: number[]): number[] {
  let sum = 0;
  for (const v of vec) sum += v * v;
  const mag = Math.sqrt(sum);
  if (!mag) return vec.slice();
  return vec.map((v) => v / mag);
}

/** Cosine similarity. Vectors are stored normalized, so this is a dot product. */
export function cosine(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < len; i++) dot += a[i] * b[i];
  return dot;
}
