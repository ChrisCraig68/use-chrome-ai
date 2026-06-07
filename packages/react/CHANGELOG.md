# @use-chrome-ai/react

## 0.1.2

### Patch Changes

- 8ba060f: Improve npm README copy with live demo links, one-hook chat examples, and clearer package positioning.
- Updated dependencies [8ba060f]
  - use-chrome-ai@0.1.2

## 0.1.1

### Patch Changes

- 86be374: Expose whether availability has been resolved yet: `ControllerState.checked` and the derived `ModelStatus.isChecking`. Until the first `availability()` check resolves, `availability` is an optimistic guess, so UIs can gate on `isChecking` to show a neutral state instead of briefly flashing a download CTA for a model that is already installed.
- 6401ab2: Refresh model availability when framework hooks mount so already-downloaded models do not keep showing a download prompt.
- Updated dependencies [86be374]
  - use-chrome-ai@0.1.1

## 0.1.0

### Minor Changes

- 74501f0: Initial release.

  Headless, framework-agnostic primitives for Chrome's built-in AI (Gemini Nano), covering all seven APIs — Prompt/LanguageModel, Summarizer, Writer, Rewriter, Proofreader, Translator, and Language Detector — with streaming, model-download progress, user-activation gating, and mid-session eviction recovery.

  - `use-chrome-ai` — zero-dependency, framework-agnostic core (vanilla JS).
  - `@use-chrome-ai/react` — React hooks (`useChat`, `usePrompt`, `useSummarizer`, …).
  - `@use-chrome-ai/vue` — Vue composables (`useChat`, `useModelStatus`).

### Patch Changes

- Updated dependencies [74501f0]
  - use-chrome-ai@0.1.0
