# use-chrome-ai

Headless primitives for [Chrome's built-in AI](https://developer.chrome.com/docs/ai/built-in)
(Gemini Nano). It runs in the browser, needs no API key, and ships no UI.

Use the framework-agnostic core, or the React/Vue adapters built on top of it. This
library handles the wrapper work: availability state, download progress, streaming,
aborts, and session recovery. For Chrome setup, API status, and model behavior, use the
[Chrome built-in AI docs](https://developer.chrome.com/docs/ai/built-in).

```bash
npm i use-chrome-ai
npm i @use-chrome-ai/react
npm i @use-chrome-ai/vue
```

| Package | Use it for | Docs |
| --- | --- | --- |
| [`use-chrome-ai`](packages/core/README.md) | Vanilla JS, shared core, or another framework | [Core quick start](docs/core.md) |
| [`@use-chrome-ai/react`](packages/react/README.md) | React hooks | [React quick start](docs/react.md) |
| [`@use-chrome-ai/vue`](packages/vue/README.md) | Vue composables | [Vue quick start](docs/vue.md) |

Adapters re-export the core, so a React app can import both `useChat` and
`createSummarizer` from `@use-chrome-ai/react`, and a Vue app can do the same from
`@use-chrome-ai/vue`.

## Quick Example

```tsx
import { useChat } from "@use-chrome-ai/react";

export function Chat() {
  const { messages, input, setInput, send, stop, isStreaming, model } = useChat();

  if (model.isUnavailable) return <p>Built-in AI is not available here.</p>;
  if (model.availability === "downloadable") {
    return <button onClick={() => model.download()}>Enable on-device AI</button>;
  }
  if (model.isDownloading) return <progress value={model.progress} max={1} />;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      {messages.map((message, index) => (
        <p key={index}>
          <b>{message.role}:</b> {message.content}
        </p>
      ))}
      <input value={input} onChange={(event) => setInput(event.target.value)} />
      <button type="submit" disabled={isStreaming}>
        Send
      </button>
      {isStreaming && (
        <button type="button" onClick={stop}>
          Stop
        </button>
      )}
    </form>
  );
}
```

## Chrome Docs

Chrome owns the platform details; this repo keeps the wrapper API focused.

- [Built-in AI overview](https://developer.chrome.com/docs/ai/built-in)
- [API status](https://developer.chrome.com/docs/ai/built-in-apis)
- [Get started](https://developer.chrome.com/docs/ai/get-started)
- [Inform users of model download](https://developer.chrome.com/docs/ai/inform-users-of-model-download)
- [Model management in Chrome](https://developer.chrome.com/docs/ai/understand-built-in-model-management)

In this library, gate UI with `model.isUnavailable`, show a download button when
`model.availability === "downloadable"`, and call `model.download()` from that button.

## APIs

| API | Core | React | Vue |
| --- | --- | --- | --- |
| [LanguageModel / Prompt](https://developer.chrome.com/docs/ai/prompt-api) | `createChat`, `createLanguageModel` | `useChat`, `usePrompt` | `useChat` |
| [Summarizer](https://developer.chrome.com/docs/ai/summarizer-api) | `createSummarizer` | `useSummarizer` | Core re-export |
| [Writer](https://developer.chrome.com/docs/ai/writer-api) | `createWriter` | `useWriter` | Core re-export |
| [Rewriter](https://developer.chrome.com/docs/ai/rewriter-api) | `createRewriter` | `useRewriter` | Core re-export |
| [Proofreader](https://developer.chrome.com/docs/ai/proofreader-api) | `createProofreader` | `useProofreader` | Core re-export |
| [Translator](https://developer.chrome.com/docs/ai/translator-api) | `createTranslator` | `useTranslator` | Core re-export |
| [Language Detector](https://developer.chrome.com/docs/ai/language-detection) | `createLanguageDetector` | `useLanguageDetector` | Core re-export |

## Demos

```bash
pnpm install
pnpm dev:react
pnpm dev:vue
```

React runs at <http://localhost:5173>; Vue runs at <http://localhost:5174>. See Chrome's
[Get started](https://developer.chrome.com/docs/ai/get-started) guide for the browser
setup needed to exercise the real model path.

## License

MIT
