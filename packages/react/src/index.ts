// use-chrome-ai/react — React hooks over the framework-agnostic core. `react` is an
// optional peer dependency (>=18, for useSyncExternalStore). The core API is re-exported
// here too, so you can import everything from one place.

export { useModelStatus, type AiStatus } from "./internal";
export { usePrompt, type PromptHook } from "./usePrompt";
export { useChat, type ChatHook } from "./useChat";
export { useSummarizer, type SummarizerHook } from "./useSummarizer";
export { useWriter, type WriterHook } from "./useWriter";
export { useRewriter, type RewriterHook } from "./useRewriter";
export { useTranslator, type TranslatorHook } from "./useTranslator";
export { useProofreader, type ProofreaderHook } from "./useProofreader";
export { useLanguageDetector, type LanguageDetectorHook } from "./useLanguageDetector";
export { useAiController } from "./useAiController";

// Re-export the whole core so consumers can `import { createChat, isSupported, ... }`
// from "use-chrome-ai/react" without a second import path.
export * from "use-chrome-ai";
