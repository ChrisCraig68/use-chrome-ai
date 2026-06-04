# Enabling built-in AI

Chrome's built-in AI is real but gated. Google owns the canonical setup docs — this page links to them and covers the two things that are specific to using this library: cross-origin iframe permissions, and a checklist for verifying against a real model.

## Setup (Google's docs)

Start here, and document the relevant bits for your own users:

- [Get started with built-in AI](https://developer.chrome.com/docs/ai/get-started) — hardware requirements, supported OSes, Chrome versions, and flags.
- [Built-in AI overview](https://developer.chrome.com/docs/ai/built-in) and the [API list](https://developer.chrome.com/docs/ai/built-in-apis).
- [Origin trials](https://developer.chrome.com/origintrials) — for production web pages, register a token per not-yet-stable API and serve it via `<meta http-equiv="origin-trial" content="…">`. The token is **your site's responsibility** — a library can't ship one.

In short: desktop Chrome/Edge only, real disk/VRAM requirements, and several APIs still need a flag or origin trial. Some are stable in Chrome 138+; check each API's page for current status.

| API | Docs |
| --- | --- |
| LanguageModel / Prompt | <https://developer.chrome.com/docs/ai/prompt-api> |
| Summarizer | <https://developer.chrome.com/docs/ai/summarizer-api> |
| Writer | <https://developer.chrome.com/docs/ai/writer-api> |
| Rewriter | <https://developer.chrome.com/docs/ai/rewriter-api> |
| Proofreader | <https://developer.chrome.com/docs/ai/proofreader-api> |
| Translator | <https://developer.chrome.com/docs/ai/translator-api> |
| Language Detector | <https://developer.chrome.com/docs/ai/language-detection> |

## Cross-origin iframes

To use built-in AI inside a cross-origin iframe, the embedder grants each API with its own permission-policy token on the `allow` attribute:

```html
<iframe allow="language-model; summarizer; writer; rewriter; proofreader; translator; language-detector"></iframe>
```

| API | `allow` token |
| --- | --- |
| LanguageModel | `language-model` |
| Summarizer | `summarizer` |
| Writer | `writer` |
| Rewriter | `rewriter` |
| Proofreader | `proofreader` |
| Translator | `translator` |
| Language Detector | `language-detector` |

Use only the tokens for the APIs you embed.

## Verifying against a real model

Unit tests run against mocked globals. To confirm the real model path, run a demo (`pnpm dev:react`) in a Chrome that has built-in AI enabled, and check:

- [ ] **Capability gate** — with built-in AI disabled (or in another browser), the app renders the `isUnavailable` fallback and does **not** throw.
- [ ] **Download flow** — on first use with `availability: "downloadable"`, clicking the action shows progress (`downloadProgress` 0→1), then becomes ready.
- [ ] **Activation guard** — calling an action *not* from a click (e.g. in an effect) while `downloadable` throws `ActivationRequiredError` rather than hanging.
- [ ] **Streaming** — the reply streams in token-by-token; `stop()` halts it mid-stream.
- [ ] **Multi-turn memory** — a second chat message references the first (one session, context kept).
- [ ] **Context full** — a very long conversation eventually surfaces `ContextFullError`; `reset()` recovers.
- [ ] **Each API** — `useSummarizer`, `useWriter`, `useRewriter`, `useTranslator`, `useProofreader`, `useLanguageDetector` each produce sane output for a sample input.

> Edge ships the same globals backed by Phi-4-mini — feature detection covers it; no special-casing.
