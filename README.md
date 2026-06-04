# use-chrome-ai

Headless, framework-agnostic primitives + framework adapters for [Chrome's built-in AI](https://developer.chrome.com/docs/ai/built-in) (Gemini Nano). Runs on-device — no API keys, no server, nothing leaves the browser. The library is logic only: **you build the UI.**

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

> **Heads up — built-in AI is still rolling out.** Some APIs are stable in Chrome 138+; others are behind a flag or origin trial, and it's desktop Chrome only with real hardware requirements. Treat it as progressive enhancement: this library never throws on an unsupported browser — it reports an `unavailable` state so you can render a fallback. It's a good fit for prototyping on-device AI on Chrome. See Google's [Get started with built-in AI](https://developer.chrome.com/docs/ai/get-started).

---

## A streaming chatbot, in one hook

```tsx
import { useChat } from "@use-chrome-ai/react";

export function Chat() {
  const { messages, input, setInput, send, stop, isStreaming, model } =
    useChat({ system: "You are a helpful assistant." });

  if (model.isUnavailable) return <p>Built-in AI isn't available in this browser.</p>;

  // The model downloads once, on an explicit click — not as a side effect of sending.
  if (model.availability === "downloadable")
    return <button onClick={() => model.download()}>Enable on-device AI</button>;
  if (model.isDownloading) return <progress value={model.progress} />;

  return (
    <div>
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

Click **Enable on-device AI** once to download the model (with progress); after that, `send()` streams the reply token-by-token into `messages`. `stop()` aborts. That's the whole chatbot.

### Same thing, no framework

```ts
import { createChat } from "use-chrome-ai";

const chat = createChat({ system: "You are a helpful assistant." });

// One-time: download the model from a click (Chrome requires a user gesture).
downloadBtn.onclick = () => chat.download();

// Once it's ready, stream replies:
sendBtn.onclick = async () => {
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

The Vue adapter currently ships `useChat` + `useModelStatus`; everything else is available through the re-exported core. See the per-framework quick starts for usage and signatures.

## Two things to know

**Model download is explicit.** The first use needs multi-gigabyte weights, and Chrome only starts that download from a click/tap. A normal call (`send`, `summarize`, …) never downloads on its own — gate a "Download model" button on `model.availability === "downloadable"` and call `model.download()` from its click handler. Until the model is ready, actions throw `ActivationRequiredError`.

**`availability` drives your UI.** It's one of `unavailable` · `downloadable` · `downloading` · `available`. `phase` (`idle` · `creating` · `running` · `streaming` · `error`) is what the controller is doing right now. The hooks group these under a `model` object — `model.availability`, `model.isReady`, `model.isDownloading`, `model.progress`, `model.download()`.

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

---

## Documentation

- Quick starts (usage + signatures): [core](docs/core.md) · [React](docs/react.md) · [Vue](docs/vue.md)
- [`llms.txt`](llms.txt) — a machine-readable map of the project for AI assistants.
- [AGENTS.md](AGENTS.md) — guidance for coding agents working in this repo.

## License

MIT
