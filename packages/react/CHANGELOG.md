# @use-chrome-ai/react

## 0.1.4

### Patch Changes

- 7c50751: Support Microsoft Edge (and future browsers) alongside Chrome.

  The library already targeted the standardized built-in AI globals (`LanguageModel`,
  `Summarizer`, …) that Edge also ships, so this release makes multi-browser support
  official and removes the Chrome-only framing:

  - New `detectBrowser()` helper (`"chrome" | "edge" | "chromium" | "unknown"`) for
    tailoring setup instructions — feature detection should still use `isSupported()` /
    `isApiSupported()`.
  - Download progress is now normalized across implementations: Chrome reports
    `downloadprogress` as a 0..1 fraction while Edge documents byte-style `loaded`/`total`
    events; both now surface as a clamped 0..1 `downloadProgress`.
  - `ChromeAiError` is renamed `BuiltInAiError` and `ChromeAiApi` is renamed
    `BuiltInAiApi`; the old names remain as deprecated aliases, so existing imports,
    `instanceof` checks, and type annotations keep working. Note the base error's `name`
    property is now `"BuiltInAiError"` (subclass names like `UnavailableError` are
    unchanged).
  - Error messages and docs are browser-neutral and link to both Chrome's and Edge's
    built-in AI documentation.

  The React and Vue adapters are republished with updated docs; their APIs are unchanged.

- Updated dependencies [7c50751]
  - use-chrome-ai@0.2.0

## 0.1.3

### Patch Changes

- b0fde96: useChat now publishes the user's turn to `messages` as soon as `send()` is called, instead of after the first reply token arrives. Previously, on a cold session the sent message stayed invisible through the whole session warm-up, so chat UIs looked frozen until the model started replying. While `isStreaming` is true and the last message is the user's, the reply hasn't started yet — render a "thinking…" indicator off that. A send that fails before the reply starts still leaves no stray message in the transcript.

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
