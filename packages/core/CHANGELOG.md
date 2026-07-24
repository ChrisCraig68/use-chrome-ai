# use-chrome-ai

## 0.3.0

### Minor Changes

- d66755c: Add a `requireGesture` opt-out to `download()` for extension offscreen documents.

  `download()` gates on `navigator.userActivation.isActive`, which is correct for ordinary
  web pages but blocks the standard Manifest V3 pattern of owning the AI session in an
  [offscreen document](https://developer.chrome.com/docs/extensions/reference/api/offscreen):
  a popup/side-panel click's activation doesn't propagate there, so `download()` threw
  `ActivationRequiredError` even though the browser would start the download.

  - `download({ requireGesture: false })` (on `SessionLifecycle`, every core controller, and
    the React/Vue `model.download()`) bypasses the local activation check. Use it only when
    the gesture was verified on the other side of a message boundary.
  - Default behavior is unchanged — the gesture is still required unless you opt out.
  - `warm()` still never downloads, regardless of this option.
  - New `DownloadOptions` type is exported from the core package.

  The React and Vue adapters thread the option through `model.download()`, so extension UIs
  built on the hooks/composables work too.

## 0.2.0

### Minor Changes

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

## 0.1.2

### Patch Changes

- 8ba060f: Improve npm README copy with live demo links, one-hook chat examples, and clearer package positioning.

## 0.1.1

### Patch Changes

- 86be374: Expose whether availability has been resolved yet: `ControllerState.checked` and the derived `ModelStatus.isChecking`. Until the first `availability()` check resolves, `availability` is an optimistic guess, so UIs can gate on `isChecking` to show a neutral state instead of briefly flashing a download CTA for a model that is already installed.

## 0.1.0

### Minor Changes

- 74501f0: Initial release.

  Headless, framework-agnostic primitives for Chrome's built-in AI (Gemini Nano), covering all seven APIs — Prompt/LanguageModel, Summarizer, Writer, Rewriter, Proofreader, Translator, and Language Detector — with streaming, model-download progress, user-activation gating, and mid-session eviction recovery.

  - `use-chrome-ai` — zero-dependency, framework-agnostic core (vanilla JS).
  - `@use-chrome-ai/react` — React hooks (`useChat`, `usePrompt`, `useSummarizer`, …).
  - `@use-chrome-ai/vue` — Vue composables (`useChat`, `useModelStatus`).
