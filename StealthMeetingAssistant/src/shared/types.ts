/**
 * Wire types shared between the backend, the Electron main process and the
 * overlay renderer. Kept dependency-free so the renderer can read it as docs.
 */

export type AssistantMode = 'auto' | 'executive' | 'technical' | 'document' | 'practice';

export const ASSISTANT_MODES: AssistantMode[] = [
  'auto',
  'executive',
  'technical',
  'document',
  'practice',
];

/** How a provider's HTTP API speaks. Ten providers, three dialects. */
export type ProviderKind = 'openai-compatible' | 'anthropic' | 'gemini';

export interface ProviderInfo {
  /** Stable id used in model ids, e.g. `openai` in `openai/gpt-4o-mini`. */
  id: string;
  label: string;
  kind: ProviderKind;
  /** False when the API key / base URL needed to call it is missing. */
  available: boolean;
  /** Human-readable reason when `available` is false. */
  unavailableReason?: string;
  /** Env var this provider reads its key from. Never the key itself. */
  apiKeyEnv?: string;
  baseUrl?: string;
  defaultModel: string;
  models: string[];
  /** True for providers added at runtime via POST /api/providers. */
  custom: boolean;
}

export interface ModelsResponse {
  providers: ProviderInfo[];
  defaultProvider: string;
  defaultModel: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** A screenshot passed alongside the question, as a base64 JPEG. */
export interface ImageAttachment {
  mediaType: 'image/jpeg' | 'image/png';
  /** Base64 payload with no data: prefix. */
  data: string;
}

export interface TranscriptEvent {
  speaker: string;
  text: string;
  isFinal: boolean;
  timestamp: number;
}

export interface ChatRequest {
  provider: string;
  model: string;
  mode: AssistantMode;
  message: string;
  history?: ChatMessage[];
  /** Recent transcript lines the overlay wants considered. */
  transcriptContext?: TranscriptEvent[];
  useDocuments?: boolean;
  /** Optional quick-action id, e.g. `summarize`, `action-items`. */
  action?: QuickActionId;
  /** Screenshots giving the model the same view the user has. */
  images?: ImageAttachment[];
  /** Free-text persona/context the user set in Settings. */
  customInstructions?: string;
}

export type QuickActionId =
  | 'ask'
  | 'summarize'
  | 'action-items'
  | 'suggest-reply'
  | 'explain-jargon'
  | 'follow-up-email'
  | 'risks'
  | 'critique'
  | 'quiz-me'
  | 'brief';

export interface MeetingProfileInfo {
  id: string;
  name: string;
  brief: string;
  carryOver?: string;
  carryOverAt?: number;
  lastUsedAt?: number;
  createdAt: number;
}

/** Locally computed delivery stats — no model call, no network. */
export interface DeliveryMetrics {
  /** Words per minute across everything you said. */
  wordsPerMinute: number;
  wordCount: number;
  speakingSeconds: number;
  fillerCount: number;
  /** Fillers per hundred words. */
  fillerRate: number;
  /** Most frequent fillers, worst first. */
  topFillers: { word: string; count: number }[];
  /** Longest uninterrupted stretch you spoke, in words. */
  longestMonologueWords: number;
  /** Share of all words in the room that were yours, 0-1. */
  talkRatio: number;
}

/** One retrieved document chunk, as shown in the citation strip. */
export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  fileName: string;
  page?: number;
  section?: string;
  uploadedAt: number;
  score: number;
  text: string;
}

/** NDJSON frames streamed from POST /api/chat. */
export type ChatStreamFrame =
  | {
      type: 'meta';
      provider: string;
      model: string;
      mode: AssistantMode;
      /** What auto mode decided this question needed. */
      focus?: string;
    }
  | { type: 'sources'; sources: RetrievedChunk[]; note?: string }
  | { type: 'delta'; text: string }
  | { type: 'done'; text: string; elapsedMs: number }
  | { type: 'error'; message: string; retryable: boolean };

export type DocumentStatus = 'queued' | 'parsing' | 'embedding' | 'ready' | 'error';

export interface DocumentInfo {
  id: string;
  fileName: string;
  ext: string;
  bytes: number;
  hash: string;
  status: DocumentStatus;
  chunkCount: number;
  pageCount?: number;
  uploadedAt: number;
  error?: string;
  embedderId?: string;
}

export interface SearchRequest {
  query: string;
  topK?: number;
  minScore?: number;
}

export interface SearchResponse {
  chunks: RetrievedChunk[];
  embedder: string;
  note?: string;
}

/* ── Audio capture ─────────────────────────────────────────── */

/** `mic` is the user's own voice; `system` is everyone else in the call. */
export type AudioSource = 'mic' | 'system';

export interface SttProviderInfo {
  id: string;
  label: string;
  kind: 'streaming' | 'batch';
  available: boolean;
  unavailableReason?: string;
  apiKeyEnv?: string;
  defaultModel: string;
  models: string[];
  supportsDiarization: boolean;
  note: string;
}

export interface AudioSourceStatus {
  source: AudioSource;
  active: boolean;
  provider?: string;
  speakerLabel?: string;
  secondsCaptured: number;
  error?: string;
}

export interface AudioStatus {
  sources: AudioSourceStatus[];
}

export interface SttProvidersResponse {
  providers: SttProviderInfo[];
  defaultProvider: string;
  status: AudioStatus;
  /** How system audio can be captured on this OS — see the README table. */
  systemAudio: {
    platform: NodeJS.Platform;
    method: 'loopback' | 'monitor-device' | 'virtual-device' | 'screencapturekit';
    supported: boolean;
    hint: string;
  };
}

export interface HealthResponse {
  ok: true;
  version: string;
  uptimeMs: number;
  embedder: string;
  documents: number;
  transcriptLines: number;
}
