/**
 * Wire types shared between the backend, the Electron main process and the
 * overlay renderer. Kept dependency-free so the renderer can read it as docs.
 */

export type AssistantMode = 'executive' | 'technical' | 'document';

export const ASSISTANT_MODES: AssistantMode[] = ['executive', 'technical', 'document'];

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
}

export type QuickActionId =
  | 'ask'
  | 'summarize'
  | 'action-items'
  | 'suggest-reply'
  | 'explain-jargon'
  | 'follow-up-email'
  | 'risks';

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
  | { type: 'meta'; provider: string; model: string; mode: AssistantMode }
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

export interface HealthResponse {
  ok: true;
  version: string;
  uptimeMs: number;
  embedder: string;
  documents: number;
  transcriptLines: number;
}
