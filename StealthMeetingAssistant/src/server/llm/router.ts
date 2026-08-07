import {
  findProvider,
  resolveApiKey,
  resolveBaseUrl,
  resolveDefaultModel,
  unavailableReason,
} from '../providers/registry';
import { anthropic } from './anthropic';
import { gemini } from './gemini';
import { openaiCompatible } from './openaiCompatible';
import { LlmError, type LlmAdapter } from './types';

const ADAPTERS: Record<string, LlmAdapter> = {
  'openai-compatible': openaiCompatible,
  anthropic,
  gemini,
};

export interface StreamOptions {
  provider: string;
  model?: string;
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

/**
 * Single entry point for every provider. Resolves config, picks the dialect
 * adapter and yields text deltas.
 */
export async function* streamCompletion(
  opts: StreamOptions,
): AsyncGenerator<string, void, unknown> {
  const def = findProvider(opts.provider);
  if (!def) throw new LlmError(`Unknown provider "${opts.provider}"`, { retryable: false });

  const reason = unavailableReason(def);
  if (reason) throw new LlmError(reason, { retryable: false });

  const baseUrl = resolveBaseUrl(def)!;
  const model = opts.model?.trim() || resolveDefaultModel(def);
  if (!model) {
    throw new LlmError(`No model selected for ${def.label}`, { retryable: false });
  }

  const adapter = ADAPTERS[def.kind];
  if (!adapter) throw new LlmError(`No adapter for provider kind "${def.kind}"`);

  yield* adapter({
    def,
    baseUrl,
    apiKey: resolveApiKey(def),
    model,
    system: opts.system,
    messages: opts.messages,
    maxTokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.3,
    signal: opts.signal,
  });
}
