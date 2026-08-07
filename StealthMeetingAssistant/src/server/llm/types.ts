import type { ImageAttachment } from '../../shared/types';
import type { ProviderDef } from '../providers/registry';

export interface LlmRequest {
  def: ProviderDef;
  baseUrl: string;
  apiKey?: string;
  model: string;
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  /** Attached to the final user turn; each dialect encodes images its own way. */
  images?: ImageAttachment[];
  maxTokens: number;
  temperature: number;
  signal?: AbortSignal;
}

/**
 * The whole provider abstraction: yield text deltas, throw LlmError on
 * failure. Swapping in the Vercel AI SDK later means reimplementing this one
 * function — nothing above it changes.
 */
export type LlmAdapter = (req: LlmRequest) => AsyncGenerator<string, void, unknown>;

export class LlmError extends Error {
  readonly status?: number;
  readonly retryable: boolean;

  constructor(message: string, opts: { status?: number; retryable?: boolean } = {}) {
    super(message);
    this.name = 'LlmError';
    this.status = opts.status;
    // 4xx other than 408/429 means the request itself is wrong — retrying
    // the same body would just fail again.
    this.retryable =
      opts.retryable ??
      (opts.status === undefined ||
        opts.status >= 500 ||
        opts.status === 429 ||
        opts.status === 408);
  }
}

/** Turn an upstream error body into something short enough for the overlay. */
export async function httpError(res: Response, label: string): Promise<LlmError> {
  let detail = '';
  try {
    const body = await res.text();
    try {
      const parsed = JSON.parse(body);
      detail = parsed?.error?.message ?? parsed?.message ?? parsed?.error ?? body;
    } catch {
      detail = body;
    }
  } catch {
    /* body already consumed or connection died */
  }
  if (typeof detail !== 'string') detail = JSON.stringify(detail);
  detail = detail.replace(/\s+/g, ' ').trim().slice(0, 220);
  const hint =
    res.status === 401 || res.status === 403
      ? ' (check the API key in .env)'
      : res.status === 404
        ? ' (check the model name and base URL)'
        : '';
  return new LlmError(`${label} ${res.status}: ${detail || res.statusText}${hint}`, {
    status: res.status,
  });
}
