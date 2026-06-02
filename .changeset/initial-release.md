---
"use-chrome-ai": minor
"@use-chrome-ai/react": minor
"@use-chrome-ai/vue": minor
---

Initial release.

Headless, framework-agnostic primitives for Chrome's built-in AI (Gemini Nano, and Edge's Phi-4-mini), covering all seven APIs — Prompt/LanguageModel, Summarizer, Writer, Rewriter, Proofreader, Translator, and Language Detector — with streaming, model-download progress, user-activation gating, and mid-session eviction recovery.

- `use-chrome-ai` — zero-dependency, framework-agnostic core (vanilla JS / Chrome extensions).
- `@use-chrome-ai/react` — React hooks (`useChat`, `usePrompt`, `useSummarizer`, …).
- `@use-chrome-ai/vue` — Vue composables (`useChat`, `useModelStatus`).
