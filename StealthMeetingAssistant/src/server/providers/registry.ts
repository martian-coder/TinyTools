import { dataPath, readJson, writeJson } from '../config';
import type { ProviderInfo, ProviderKind } from '../../shared/types';

/**
 * Adding a provider means adding one entry to BUILTIN_PROVIDERS — no adapter
 * code, as long as it speaks one of the three dialects. Anything
 * OpenAI-shaped can also be added at runtime via POST /api/providers.
 */
export interface ProviderDef {
  id: string;
  label: string;
  kind: ProviderKind;
  apiKeyEnv?: string;
  baseUrlEnv?: string;
  baseUrlDefault?: string;
  modelEnv?: string;
  modelDefault: string;
  /** Ollama and other local runtimes need no key. */
  requiresKey: boolean;
  /** Curated starting list; the UI also accepts a free-typed model name. */
  models: string[];
  custom: boolean;
}

export const BUILTIN_PROVIDERS: ProviderDef[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    kind: 'openai-compatible',
    apiKeyEnv: 'OPENAI_API_KEY',
    baseUrlEnv: 'OPENAI_BASE_URL',
    baseUrlDefault: 'https://api.openai.com/v1',
    modelEnv: 'OPENAI_MODEL',
    modelDefault: 'gpt-4o-mini',
    requiresKey: true,
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1', 'o4-mini'],
    custom: false,
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    kind: 'anthropic',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    baseUrlEnv: 'ANTHROPIC_BASE_URL',
    baseUrlDefault: 'https://api.anthropic.com/v1',
    modelEnv: 'ANTHROPIC_MODEL',
    modelDefault: 'claude-3-5-sonnet-latest',
    requiresKey: true,
    models: [
      'claude-3-5-sonnet-latest',
      'claude-3-5-haiku-latest',
      'claude-sonnet-4-5',
      'claude-opus-4-1',
    ],
    custom: false,
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    kind: 'gemini',
    apiKeyEnv: 'GEMINI_API_KEY',
    baseUrlEnv: 'GEMINI_BASE_URL',
    baseUrlDefault: 'https://generativelanguage.googleapis.com/v1beta',
    modelEnv: 'GEMINI_MODEL',
    modelDefault: 'gemini-1.5-pro',
    requiresKey: true,
    models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-pro'],
    custom: false,
  },
  {
    id: 'qwen',
    label: 'Qwen / DashScope',
    kind: 'openai-compatible',
    apiKeyEnv: 'QWEN_API_KEY',
    baseUrlEnv: 'QWEN_BASE_URL',
    baseUrlDefault: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    modelEnv: 'QWEN_MODEL',
    modelDefault: 'qwen-max',
    requiresKey: true,
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen2.5-72b-instruct'],
    custom: false,
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    kind: 'openai-compatible',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    baseUrlEnv: 'OPENROUTER_BASE_URL',
    baseUrlDefault: 'https://openrouter.ai/api/v1',
    modelEnv: 'OPENROUTER_MODEL',
    modelDefault: 'anthropic/claude-3.5-sonnet',
    requiresKey: true,
    models: [
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4o-mini',
      'google/gemini-2.0-flash-001',
      'meta-llama/llama-3.3-70b-instruct',
    ],
    custom: false,
  },
  {
    id: 'groq',
    label: 'Groq',
    kind: 'openai-compatible',
    apiKeyEnv: 'GROQ_API_KEY',
    baseUrlEnv: 'GROQ_BASE_URL',
    baseUrlDefault: 'https://api.groq.com/openai/v1',
    modelEnv: 'GROQ_MODEL',
    modelDefault: 'llama-3.3-70b-versatile',
    requiresKey: true,
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    custom: false,
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    kind: 'openai-compatible',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    baseUrlEnv: 'DEEPSEEK_BASE_URL',
    baseUrlDefault: 'https://api.deepseek.com/v1',
    modelEnv: 'DEEPSEEK_MODEL',
    modelDefault: 'deepseek-chat',
    requiresKey: true,
    models: ['deepseek-chat', 'deepseek-reasoner'],
    custom: false,
  },
  {
    id: 'together',
    label: 'Together',
    kind: 'openai-compatible',
    apiKeyEnv: 'TOGETHER_API_KEY',
    baseUrlEnv: 'TOGETHER_BASE_URL',
    baseUrlDefault: 'https://api.together.xyz/v1',
    modelEnv: 'TOGETHER_MODEL',
    modelDefault: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    requiresKey: true,
    models: [
      'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      'Qwen/Qwen2.5-72B-Instruct-Turbo',
      'mistralai/Mixtral-8x7B-Instruct-v0.1',
    ],
    custom: false,
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    kind: 'openai-compatible',
    baseUrlEnv: 'OLLAMA_BASE_URL',
    baseUrlDefault: 'http://localhost:11434/v1',
    modelEnv: 'OLLAMA_MODEL',
    modelDefault: 'llama3.1',
    requiresKey: false,
    models: ['llama3.1', 'qwen2.5', 'mistral', 'phi3'],
    custom: false,
  },
  {
    id: 'custom',
    label: 'Custom endpoint',
    kind: 'openai-compatible',
    apiKeyEnv: 'CUSTOM_LLM_API_KEY',
    baseUrlEnv: 'CUSTOM_LLM_BASE_URL',
    modelEnv: 'CUSTOM_LLM_MODEL',
    modelDefault: '',
    requiresKey: false,
    models: [],
    custom: false,
  },
];

/** User-added OpenAI-compatible providers, persisted in the data dir. */
export interface CustomProviderConfig {
  id: string;
  label: string;
  baseUrl: string;
  /** Name of the env var holding the key — never the key itself. */
  apiKeyEnv?: string;
  defaultModel: string;
  models?: string[];
}

function customFile(): string {
  return dataPath('custom-providers.json');
}

export function listCustomProviders(): CustomProviderConfig[] {
  return readJson<CustomProviderConfig[]>(customFile(), []);
}

export function addCustomProvider(cfg: CustomProviderConfig): CustomProviderConfig {
  const id = cfg.id.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '-');
  if (!id) throw new Error('Provider id is required');
  if (BUILTIN_PROVIDERS.some((p) => p.id === id)) {
    throw new Error(`"${id}" is a built-in provider id`);
  }
  if (!/^https?:\/\//i.test(cfg.baseUrl ?? '')) {
    throw new Error('baseUrl must be an http(s) URL');
  }
  const entry: CustomProviderConfig = {
    id,
    label: cfg.label?.trim() || id,
    baseUrl: cfg.baseUrl.trim().replace(/\/+$/, ''),
    apiKeyEnv: cfg.apiKeyEnv?.trim() || undefined,
    defaultModel: cfg.defaultModel?.trim() || '',
    models: cfg.models?.filter(Boolean),
  };
  const all = listCustomProviders().filter((p) => p.id !== id);
  all.push(entry);
  writeJson(customFile(), all);
  return entry;
}

export function removeCustomProvider(id: string): boolean {
  const all = listCustomProviders();
  const next = all.filter((p) => p.id !== id);
  if (next.length === all.length) return false;
  writeJson(customFile(), next);
  return true;
}

function customToDef(c: CustomProviderConfig): ProviderDef {
  return {
    id: c.id,
    label: c.label,
    kind: 'openai-compatible',
    apiKeyEnv: c.apiKeyEnv,
    baseUrlDefault: c.baseUrl,
    modelDefault: c.defaultModel,
    requiresKey: Boolean(c.apiKeyEnv),
    models: c.models?.length ? c.models : c.defaultModel ? [c.defaultModel] : [],
    custom: true,
  };
}

export function allProviderDefs(): ProviderDef[] {
  return [...BUILTIN_PROVIDERS, ...listCustomProviders().map(customToDef)];
}

export function findProvider(id: string): ProviderDef | undefined {
  return allProviderDefs().find((p) => p.id === id);
}

export function resolveBaseUrl(def: ProviderDef): string | undefined {
  const fromEnv = def.baseUrlEnv ? process.env[def.baseUrlEnv]?.trim() : undefined;
  const url = fromEnv || def.baseUrlDefault;
  return url ? url.replace(/\/+$/, '') : undefined;
}

export function resolveApiKey(def: ProviderDef): string | undefined {
  return def.apiKeyEnv ? process.env[def.apiKeyEnv]?.trim() || undefined : undefined;
}

export function resolveDefaultModel(def: ProviderDef): string {
  const fromEnv = def.modelEnv ? process.env[def.modelEnv]?.trim() : undefined;
  return fromEnv || def.modelDefault || def.models[0] || '';
}

/** Why a provider can't be used right now, or undefined when it can. */
export function unavailableReason(def: ProviderDef): string | undefined {
  if (!resolveBaseUrl(def)) {
    return `Set ${def.baseUrlEnv ?? 'a base URL'} to enable ${def.label}`;
  }
  if (def.requiresKey && !resolveApiKey(def)) {
    return `Missing ${def.apiKeyEnv} in .env`;
  }
  if (!resolveDefaultModel(def)) {
    return `Set ${def.modelEnv ?? 'a default model'} to enable ${def.label}`;
  }
  return undefined;
}

export function toProviderInfo(def: ProviderDef): ProviderInfo {
  const reason = unavailableReason(def);
  const defaultModel = resolveDefaultModel(def);
  const models = Array.from(new Set([defaultModel, ...def.models].filter(Boolean)));
  return {
    id: def.id,
    label: def.label,
    kind: def.kind,
    available: !reason,
    unavailableReason: reason,
    apiKeyEnv: def.apiKeyEnv,
    baseUrl: resolveBaseUrl(def),
    defaultModel,
    models,
    custom: def.custom,
  };
}

/** The provider/model the overlay should start on. */
export function defaults(): { provider: string; model: string } {
  const infos = allProviderDefs().map(toProviderInfo);
  const wanted = process.env.DEFAULT_PROVIDER?.trim();
  const picked =
    infos.find((p) => p.id === wanted && p.available) ??
    infos.find((p) => p.id === wanted) ??
    infos.find((p) => p.available) ??
    infos[0];
  const model = process.env.DEFAULT_MODEL?.trim() || picked?.defaultModel || '';
  return { provider: picked?.id ?? 'openai', model };
}
