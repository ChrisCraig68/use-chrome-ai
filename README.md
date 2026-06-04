# use-chrome-ai

Headless, framework-agnostic primitives + framework adapters for [Chrome's built-in AI](https://developer.chrome.com/docs/ai/built-in) (Gemini Nano, and Edge's Phi-4-mini). Runs on-device — no API keys, no server, nothing leaves the browser. The library is logic only: **you build the UI.**

It wraps all seven built-in AI APIs and handles the awkward parts — availability gating, model-download progress, streaming, abort, and recovering when Chrome evicts the model mid-session.

```bash
npm i use-chrome-ai            # framework-agnostic core (vanilla JS). Zero deps.
npm i @use-chrome-ai/react     # React hooks (pulls in the core)
npm i @use-chrome-ai/vue       # Vue composables (pulls in the core)
```

| Package | For | Quick start |
| --- | --- | --- |
| [`use-chrome-ai`](packages/core/README.md) | Framework-agnostic core (vanilla JS). Zero deps. | [Core →](docs/core.md) |
| [`@use-chrome-ai/react`](packages/react/README.md) | React hooks. Depends on + re-exports the core. | [React →](docs/react.md) |
| [`@use-chrome-ai/vue`](packages/vue/README.md) | Vue composables. Depends on + re-exports the core. | [Vue →](docs/vue.md) |

Each adapter re-exports the core, so you can import the hooks and the `create*`/`isSupported` helpers from one place.

> **Heads up — built-in AI is still rolling out.** Some APIs are stable in Chrome 138+; others are behind a flag or origin trial, and it's desktop Chrome/Edge only with real hardware requirements. Treat it as progressive enhancement: this library never throws on an unsupported browser — it reports an `unavailable` state so you can render a fallback. It's a good fit for prototyping on-device AI on Chrome. See Google's [Get started with built-in AI](https://developer.chrome.com/docs/ai/get-started).

---

## A streaming chatbot, in one hook

```tsx
import { useChat } from "@use-chrome-ai/react";

export function Chat() {
  const {
    messages, input, setInput, send, stop,
    isStreaming, isUnavailable, isDownloading, downloadProgress,
  } = useChat({ system: "You are a helpful assistant." });

  if (isUnavailable) return <p>Built-in AI isn't available in this browser.</p>;

  return (
    <div>
      {isDownloading && <progress value={downloadProgress} />}
      {messages.map((m, i) => (
        <p key={i}><b>{m.role}:</b> {m.content}</p>
      ))}
      <form onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} disabled={isStreaming} />
        <button type="submit">Send</button>
        {isStreaming && <button type="button" onClick={stop}>Stop</button>}
      </form>
    </div>
  );
}
```

The first `send()` (from the form submit — a user gesture) downloads the model with progress, then streams the reply token-by-token into `messages`. `stop()` aborts. That's the whole chatbot.

### Same thing, no framework

```ts
import { createChat } from "use-chrome-ai";

const chat = createChat({ system: "You are a helpful assistant." });
button.onclick = async () => {
  for await (const delta of chat.send(input.value)) {
    output.textContent += delta; // stream deltas into the DOM
  }
};
```

---

## What's covered

One hook (React) / composable (Vue) / factory (core) per API:

| API | Core factory | React hook | Vue |
| --- | --- | --- | --- |
| [LanguageModel / Prompt](https://developer.chrome.com/docs/ai/prompt-api) | `createChat`, `createLanguageModel` | `useChat`, `usePrompt` | `useChat` |
| [Summarizer](https://developer.chrome.com/docs/ai/summarizer-api) | `createSummarizer` | `useSummarizer` | — |
| [Writer](https://developer.chrome.com/docs/ai/writer-api) | `createWriter` | `useWriter` | — |
| [Rewriter](https://developer.chrome.com/docs/ai/rewriter-api) | `createRewriter` | `useRewriter` | — |
| [Proofreader](https://developer.chrome.com/docs/ai/proofreader-api) | `createProofreader` | `useProofreader` | — |
| [Translator](https://developer.chrome.com/docs/ai/translator-api) | `createTranslator` | `useTranslator` | — |
| [Language Detector](https://developer.chrome.com/docs/ai/language-detection) | `createLanguageDetector` | `useLanguageDetector` | — |

The Vue adapter currently ships `useChat` + `useModelStatus`; everything else is available through the re-exported core. See the per-package quick starts for usage, and the [API reference](docs/api-reference.md) for full signatures.

## Two things to know

**Model download needs a user gesture.** The first use of an API downloads multi-gigabyte weights, and Chrome only starts that from a click/tap. Calling an action straight from a click (like the chatbot's `send`) just works. Otherwise, gate a "Download model" button on `availability === "downloadable"` and call `download()` from its handler — calling without a gesture throws `ActivationRequiredError`.

**`availability` drives your UI.** It's one of `unavailable` · `downloadable` · `downloading` · `available`. `phase` (`idle` · `creating` · `running` · `streaming` · `error`) is what the controller is doing right now. The hooks expose both, plus `isUnavailable` / `isDownloading` / `isReady` shortcuts.

The hooks are SSR-safe — on the server they report `unavailable`, so Next.js/Remix render your fallback and upgrade on the client.

---

## Demos

`examples/` has two standalone apps that import the packages from source:

```bash
pnpm install
pnpm dev:react    # React demos  → http://localhost:5173
pnpm dev:vue      # Vue demo     → http://localhost:5174
```

Run them in desktop Chrome with built-in AI enabled to see the model path; in any other browser they render the `unavailable` fallback.

### Hosting on GitHub Pages

`pnpm build:demos` builds both into `examples/dist/` (React at `/`, Vue at `/vue/`), with the Vite `base` set to `/use-chrome-ai/`. To publish:

```bash
pnpm build:demos
npx gh-pages -d examples/dist        # pushes to the gh-pages branch
```

Then set **Settings → Pages → Source** to the `gh-pages` branch. The site serves at `https://<user>.github.io/use-chrome-ai/`. (Built-in AI is gated, so most visitors will see the `unavailable` fallback unless they've enabled it in Chrome.)

---

## Documentation

- Quick starts: [core](docs/core.md) · [React](docs/react.md) · [Vue](docs/vue.md)
- [API reference](docs/api-reference.md) — every hook, core factory, and type with signatures.
- [Enabling built-in AI](docs/enabling-built-in-ai.md) — what end-users need, iframe permission tokens, and a verify checklist (links out to Google for setup).
- [`llms.txt`](llms.txt) — a machine-readable map of the project for AI assistants.
- [AGENTS.md](AGENTS.md) — guidance for coding agents working in this repo.

## License

MIT
