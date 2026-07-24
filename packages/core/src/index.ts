// use-chrome-ai — framework-agnostic core for the browsers' built-in AI APIs (Chrome,
// Edge, and any browser shipping the standardized globals). Zero dependencies. Import
// this in any web page or framework. React hooks: "@use-chrome-ai/react". Vue
// composables: "@use-chrome-ai/vue".

export {
  createLanguageDetector,
  type DetectResult,
  type LanguageDetectorController,
  type LanguageDetectorOptions,
} from "./apis/languageDetector";
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
  type Correction,
  type CorrectionType,
  createProofreader,
  type ProofreaderController,
  type ProofreaderOptions,
  type ProofreadResult,
} from "./apis/proofreader";
export { createRewriter, type RewriteParams, type RewriterOptions } from "./apis/rewriter";
export {
  createSummarizer,
  type SummarizeParams,
  type SummarizerOptions,
} from "./apis/summarizer";
export {
  createTranslator,
  type TranslateParams,
  type TranslatorPair,
} from "./apis/translator";
export { createWriter, type WriteParams, type WriterOptions } from "./apis/writer";
// Capability detection
export {
  type BuiltInAiApi,
  type ChromeAiApi,
  GLOBAL_NAME,
  getGlobal,
  isApiSupported,
  isSupported,
  normalizeAvailability,
} from "./availability";
// Chat primitive
export { type ChatController, type ChatMessage, type ChatOptions, createChat } from "./chat";
// Lifecycle (the seam frameworks bind to)
export {
  type AiCtor,
  type BaseController,
  type LifecycleConfig,
  SessionLifecycle,
  store,
  type TaskController,
} from "./lifecycle";
// Browser identification (for setup copy — never gate features on it)
export { type AiBrowser, detectBrowser } from "./provider";
// Remote controllers (bridge a controller across contexts, e.g. an extension's
// offscreen document ↔ side panel)
export {
  type ConnectOptions,
  connectController,
  type RemoteController,
} from "./remote/client";
export { type ExposeOptions, exposeController } from "./remote/host";
export { PROTOCOL_VERSION, type Transport } from "./remote/protocol";
// Streaming primitives
export { drainStream, isAbortError } from "./stream";
// Status & errors
export type {
  Availability,
  ControllerState,
  DownloadOptions,
  ModelStatus,
  Phase,
  Store,
} from "./types";
export {
  ActivationRequiredError,
  BuiltInAiError,
  ChromeAiError,
  ContextFullError,
  deriveModelStatus,
  UnavailableError,
} from "./types";

// Quota (quarantined — names are volatile)
export { readUsage, type UsageInfo } from "./usage";
