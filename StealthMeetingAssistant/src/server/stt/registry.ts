import type { SttProviderInfo } from '../../shared/types';

/**
 * Speech-to-text providers, deliberately shaped like the LLM registry:
 * `streaming` engines hold a WebSocket open and emit interim results;
 * `batch` engines transcribe complete utterances that the VAD has cut out.
 */
export type SttKind = 'streaming' | 'batch';

export interface SttProviderDef {
  id: string;
  label: string;
  kind: SttKind;
  adapter: 'deepgram' | 'assemblyai' | 'whisper-batch';
  apiKeyEnv?: string;
  baseUrlEnv?: string;
  baseUrlDefault?: string;
  modelEnv?: string;
  modelDefault: string;
  models: string[];
  requiresKey: boolean;
  /** Can the engine label speakers within a single audio stream? */
  supportsDiarization: boolean;
  /** Shown in the UI so the tradeoff is visible before you pick. */
  note: string;
}

export const STT_PROVIDERS: SttProviderDef[] = [
  {
    id: 'deepgram',
    label: 'Deepgram',
    kind: 'streaming',
    adapter: 'deepgram',
    apiKeyEnv: 'DEEPGRAM_API_KEY',
    baseUrlEnv: 'DEEPGRAM_BASE_URL',
    baseUrlDefault: 'wss://api.deepgram.com/v1/listen',
    modelEnv: 'DEEPGRAM_MODEL',
    modelDefault: 'nova-3',
    models: ['nova-3', 'nova-2', 'nova-2-meeting'],
    requiresKey: true,
    supportsDiarization: true,
    note: 'Lowest latency. Interim results as you speak.',
  },
  {
    id: 'assemblyai',
    label: 'AssemblyAI',
    kind: 'streaming',
    adapter: 'assemblyai',
    apiKeyEnv: 'ASSEMBLYAI_API_KEY',
    baseUrlEnv: 'ASSEMBLYAI_BASE_URL',
    baseUrlDefault: 'wss://streaming.assemblyai.com/v3/ws',
    modelEnv: 'ASSEMBLYAI_MODEL',
    modelDefault: 'universal-streaming',
    models: ['universal-streaming'],
    requiresKey: true,
    supportsDiarization: false,
    note: 'Streaming with strong punctuation and formatting.',
  },
  {
    id: 'groq-whisper',
    label: 'Groq Whisper',
    kind: 'batch',
    adapter: 'whisper-batch',
    apiKeyEnv: 'GROQ_API_KEY',
    baseUrlEnv: 'GROQ_BASE_URL',
    baseUrlDefault: 'https://api.groq.com/openai/v1',
    modelEnv: 'GROQ_WHISPER_MODEL',
    modelDefault: 'whisper-large-v3-turbo',
    models: ['whisper-large-v3-turbo', 'whisper-large-v3', 'distil-whisper-large-v3-en'],
    requiresKey: true,
    supportsDiarization: false,
    note: 'Very fast batch transcription. Text lands a moment after each pause.',
  },
  {
    id: 'openai-whisper',
    label: 'OpenAI Whisper',
    kind: 'batch',
    adapter: 'whisper-batch',
    apiKeyEnv: 'OPENAI_API_KEY',
    baseUrlEnv: 'OPENAI_BASE_URL',
    baseUrlDefault: 'https://api.openai.com/v1',
    modelEnv: 'OPENAI_WHISPER_MODEL',
    modelDefault: 'whisper-1',
    models: ['whisper-1', 'gpt-4o-mini-transcribe', 'gpt-4o-transcribe'],
    requiresKey: true,
    supportsDiarization: false,
    note: 'Reuses your OpenAI key. Transcribes on each pause.',
  },
  {
    id: 'local-parakeet',
    label: 'Local Parakeet',
    kind: 'batch',
    adapter: 'whisper-batch',
    apiKeyEnv: 'LOCAL_PARAKEET_API_KEY',
    baseUrlEnv: 'LOCAL_PARAKEET_BASE_URL',
    modelEnv: 'LOCAL_PARAKEET_MODEL',
    modelDefault: 'nvidia/parakeet-tdt-0.6b-v2',
    models: ['nvidia/parakeet-tdt-0.6b-v2', 'nvidia/parakeet-tdt-1.1b'],
    requiresKey: false,
    supportsDiarization: false,
    note:
      "NVIDIA's open ASR model, served locally. Faster and more accurate than " +
      'Whisper on English meetings. Audio never leaves your machine.',
  },
  {
    id: 'local-whisper',
    label: 'Local Whisper',
    kind: 'batch',
    adapter: 'whisper-batch',
    apiKeyEnv: 'LOCAL_WHISPER_API_KEY',
    baseUrlEnv: 'LOCAL_WHISPER_BASE_URL',
    modelEnv: 'LOCAL_WHISPER_MODEL',
    modelDefault: 'whisper-1',
    models: ['whisper-1'],
    requiresKey: false,
    supportsDiarization: false,
    note: 'Any OpenAI-compatible local server (whisper.cpp, faster-whisper). Audio never leaves your machine.',
  },
];

export function findSttProvider(id: string): SttProviderDef | undefined {
  return STT_PROVIDERS.find((p) => p.id === id);
}

export function sttBaseUrl(def: SttProviderDef): string | undefined {
  const fromEnv = def.baseUrlEnv ? process.env[def.baseUrlEnv]?.trim() : undefined;
  const url = fromEnv || def.baseUrlDefault;
  return url ? url.replace(/\/+$/, '') : undefined;
}

export function sttApiKey(def: SttProviderDef): string | undefined {
  return def.apiKeyEnv ? process.env[def.apiKeyEnv]?.trim() || undefined : undefined;
}

export function sttModel(def: SttProviderDef): string {
  const fromEnv = def.modelEnv ? process.env[def.modelEnv]?.trim() : undefined;
  return fromEnv || def.modelDefault;
}

export function sttUnavailableReason(def: SttProviderDef): string | undefined {
  if (!sttBaseUrl(def)) {
    return `Set ${def.baseUrlEnv ?? 'a base URL'} to enable ${def.label}`;
  }
  if (def.requiresKey && !sttApiKey(def)) {
    return `Missing ${def.apiKeyEnv} in .env`;
  }
  return undefined;
}

export function toSttProviderInfo(def: SttProviderDef): SttProviderInfo {
  const reason = sttUnavailableReason(def);
  return {
    id: def.id,
    label: def.label,
    kind: def.kind,
    available: !reason,
    unavailableReason: reason,
    apiKeyEnv: def.apiKeyEnv,
    defaultModel: sttModel(def),
    models: def.models,
    supportsDiarization: def.supportsDiarization,
    note: def.note,
  };
}

/** The STT engine the UI should start on. */
export function defaultSttProvider(): string {
  const wanted = process.env.STT_PROVIDER?.trim();
  if (wanted && findSttProvider(wanted)) return wanted;
  const firstAvailable = STT_PROVIDERS.find((p) => !sttUnavailableReason(p));
  return firstAvailable?.id ?? STT_PROVIDERS[0].id;
}
