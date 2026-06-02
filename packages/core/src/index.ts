// use-chrome-ai — framework-agnostic core. Zero dependencies. Import this anywhere
// (including inside a Chrome extension). React hooks live at "use-chrome-ai/react".

// Status & errors
export type { Availability, ControllerState, Phase, Store } from "./types";
export {
  ActivationRequiredError,
  ChromeAiError,
  ContextFullError,
  UnavailableError,
} from "./types";

// Capability detection
export {
  type ChromeAiApi,
  GLOBAL_NAME,
  getGlobal,
  isApiSupported,
  isSupported,
  normalizeAvailability,
} from "./availability";

// Streaming primitives
export { drainStream, isAbortError } from "./stream";

// Lifecycle (the seam frameworks bind to)
export {
  type AiCtor,
  type BaseController,
  type LifecycleConfig,
  SessionLifecycle,
  store,
  type TaskController,
} from "./lifecycle";

// Per-API factories
export {
  createLanguageModel,
  type LanguageModelController,
  type LanguageModelOptions,
  type LanguageModelSession,
  type PromptMessage,
  type PromptOptions,
} from "./apis/languageModel";
export {
  createSummarizer,
  type SummarizeParams,
  type SummarizerOptions,
} from "./apis/summarizer";
export { createWriter, type WriteParams, type WriterOptions } from "./apis/writer";
export { createRewriter, type RewriteParams, type RewriterOptions } from "./apis/rewriter";
export {
  createTranslator,
  type TranslateParams,
  type TranslatorPair,
} from "./apis/translator";
export {
  type Correction,
  type CorrectionType,
  createProofreader,
  type ProofreaderController,
  type ProofreaderOptions,
  type ProofreadResult,
} from "./apis/proofreader";
export {
  createLanguageDetector,
  type DetectResult,
  type LanguageDetectorController,
  type LanguageDetectorOptions,
} from "./apis/languageDetector";

// Chat primitive
export { type ChatController, type ChatMessage, type ChatOptions, createChat } from "./chat";

// Quota (quarantined — names are volatile)
export { readUsage, type UsageInfo } from "./usage";
