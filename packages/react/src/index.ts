// use-chrome-ai/react — React hooks over the framework-agnostic core. `react` is an
// optional peer dependency (>=18, for useSyncExternalStore). The core API is re-exported
// here too, so you can import everything from one place.

// Re-export the whole core so consumers can `import { createChat, isSupported, ... }`
// from "use-chrome-ai/react" without a second import path.
export * from "use-chrome-ai";
export { type AiStatus, useModelStatus } from "./internal";
export { useAiController } from "./useAiController";
export { type ChatHook, useChat } from "./useChat";
export { type LanguageDetectorHook, useLanguageDetector } from "./useLanguageDetector";
export { type PromptHook, usePrompt } from "./usePrompt";
export { type ProofreaderHook, useProofreader } from "./useProofreader";
export { type RewriterHook, useRewriter } from "./useRewriter";
export { type SummarizerHook, useSummarizer } from "./useSummarizer";
export { type TranslatorHook, useTranslator } from "./useTranslator";
export { useWriter, type WriterHook } from "./useWriter";
