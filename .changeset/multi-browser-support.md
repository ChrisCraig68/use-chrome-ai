---
"use-chrome-ai": minor
"@use-chrome-ai/react": patch
"@use-chrome-ai/vue": patch
---

Support Microsoft Edge (and future browsers) alongside Chrome.

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
