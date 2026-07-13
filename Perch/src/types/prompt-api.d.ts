// Ambient types for Chrome's built-in AI (Prompt API) — Gemini Nano running
// fully on-device. https://developer.chrome.com/docs/ai/prompt-api
// These are experimental browser globals not yet in lib.dom.d.ts.

type LanguageModelAvailability =
  | 'unavailable'
  | 'downloadable'
  | 'downloading'
  | 'available';

interface LanguageModelPromptOptions {
  signal?: AbortSignal;
  responseConstraint?: object;
}

interface LanguageModelSession {
  prompt(input: string, options?: LanguageModelPromptOptions): Promise<string>;
  destroy(): void;
}

interface LanguageModelCreateOptions {
  initialPrompts?: { role: 'system' | 'user' | 'assistant'; content: string }[];
  temperature?: number;
  topK?: number;
  signal?: AbortSignal;
  monitor?: (m: EventTarget) => void;
}

interface LanguageModelStatic {
  availability(options?: object): Promise<LanguageModelAvailability>;
  create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
}

interface Window {
  LanguageModel?: LanguageModelStatic;
  // Legacy origin-trial surface (Chrome < 138): window.ai.languageModel
  ai?: {
    languageModel?: {
      capabilities(): Promise<{ available: 'readily' | 'after-download' | 'no' }>;
      create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
    };
  };
}
