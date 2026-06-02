# Enabling built-in AI + verification checklist

Chrome's built-in AI is real but gated. This page covers what end-users need, and how
to verify the library against a real model (the one thing unit tests can't do — they run
against mocked globals).

## Requirements

- **Browser:** desktop Chrome or Edge (Chromium). No Android, iOS, Safari, or Firefox.
- **Disk:** ~22 GB free (the weights are multi-GB and Chrome won't download below a threshold).
- **GPU:** generally >4 GB VRAM.
- **Version:** Chrome 138+ for the stable APIs (Prompt, Summarizer). Others may need flags.

## Flags (web pages only — extensions are GA)

The prerequisite, then per-API flags for the ones not yet stable:

- `chrome://flags/#optimization-guide-on-device-model` → **Enabled BypassPerfRequirement**
- `chrome://flags/#prompt-api-for-gemini-nano` → Enabled
- `chrome://flags/#summarization-api-for-gemini-nano` → Enabled
- `chrome://flags/#writer-api-for-gemini-nano` → Enabled
- `chrome://flags/#rewriter-api-for-gemini-nano` → Enabled
- `chrome://flags/#proofreader-api-for-gemini-nano` → Enabled
- `chrome://flags/#translation-api`, `#language-detection-api` → Enabled

Restart Chrome after changing flags. (Flag names drift between versions — check
`chrome://flags` if one 404s.)

## Origin trials

For production web pages you register an [origin trial](https://developer.chrome.com/origintrials)
token per API and serve it via `<meta http-equiv="origin-trial" content="…">`. The token
is **your site's responsibility** — a library cannot ship one.

## Cross-origin iframes

Each API needs its own permission-policy token on the embedder's `allow` attribute:

```html
<iframe allow="language-model; summarizer; writer; rewriter; proofreader; translator; language-detector"></iframe>
```

Use only the tokens for the APIs you embed.

---

## Real-Chrome verification checklist

Unit tests cover the logic against mocked globals. Run these once against a flag-enabled
Chrome to confirm the real model path. Easiest harness: a throwaway Vite + React app.

```bash
# from a fresh app that has use-chrome-ai installed (or `npm pack` this repo and install the tarball)
npm create vite@latest nano-smoke -- --template react-ts
cd nano-smoke && npm i && npm i ../use-chrome-ai/use-chrome-ai-0.1.0.tgz
# drop the README chatbot into src/App.tsx, then `npm run dev`
```

Then verify, in a flag-enabled Chrome:

- [ ] **Capability gate** — with built-in AI *disabled*, the app renders the `isUnavailable`
      fallback and does **not** throw. (Try it in Firefox too.)
- [ ] **Download flow** — on first use with `availability: "downloadable"`, clicking the
      action shows a progress bar (`downloadProgress` advancing 0→1), then becomes ready.
- [ ] **Activation guard** — calling an action *not* from a click (e.g. in a `useEffect`)
      while `downloadable` throws `ActivationRequiredError` rather than hanging.
- [ ] **Streaming** — the chatbot reply streams in token-by-token; `stop()` halts it mid-stream.
- [ ] **Multi-turn memory** — a second message references the first (one session, context kept).
- [ ] **Context full** — a very long conversation eventually surfaces `ContextFullError`;
      `reset()` recovers.
- [ ] **Each API** — `useSummarizer`, `useWriter`, `useRewriter`, `useTranslator`,
      `useProofreader`, `useLanguageDetector` each produce sane output for a sample input.
- [ ] **Extension context** — import the core in a side panel / content script of an MV3
      extension and confirm it streams there too (no `chrome.*` needed).
- [ ] **Footprint** — a core-only import (no React) bundles without pulling React, and the
      used-API surface gzips within budget.

> Edge ships the same globals backed by Phi-4-mini — feature detection covers it; no special-casing.
