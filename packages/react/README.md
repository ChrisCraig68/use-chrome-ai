# @use-chrome-ai/react

React hooks for the browsers' built-in AI APIs, as shipped in [Chrome](https://developer.chrome.com/docs/ai/built-in) and [Edge](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/prompt-api). Build streaming, on-device AI features without API keys, server calls, or a UI framework on top of React.

> **Live demo:** [Smart Tooltip, Chat, and Summarizer](https://chriscraig68.github.io/use-chrome-ai/). Open it in a desktop browser with built-in AI enabled (Chrome or Edge).

## Why Install It

`@use-chrome-ai/react` is the quickest way to add browser built-in AI to a React app:

- One hook gives you a complete streaming chat loop.
- Model availability, download progress, aborts, and errors are exposed as React state.
- The package is headless, so you keep your own design system.
- The framework-agnostic `use-chrome-ai` core is re-exported for prompt, summarizer, writer, rewriter, translator, proofreader, and language detector controllers.

## Install

```bash
npm i @use-chrome-ai/react
```

`react` is a peer dependency (`>=18`).

## One-Hook Chat

This is the main selling point: a working on-device AI chat experience from one hook. The hook owns input state, streams assistant replies into `messages`, exposes `stop()`, and tells you when the browser needs the model download button.

```tsx
import { useChat } from "@use-chrome-ai/react";

export function Chat() {
  const { messages, input, setInput, send, stop, isStreaming, error, model } =
    useChat({
      system: "You are a concise, friendly assistant.",
    });

  if (model.isUnavailable) {
    return <p>Built-in AI is not available in this browser.</p>;
  }

  if (!model.isChecking && model.availability === "downloadable") {
    return (
      <button type="button" onClick={() => void model.download()}>
        Enable on-device AI
      </button>
    );
  }

  if (model.isDownloading) {
    return <progress value={model.progress} max={1} />;
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      {messages.map((message, index) => (
        <p key={index}>
          <strong>{message.role}:</strong> {message.content}
        </p>
      ))}

      <input
        value={input}
        onChange={(event) => setInput(event.target.value)}
        disabled={isStreaming || !model.isReady}
      />

      {isStreaming ? (
        <button type="button" onClick={stop}>
          Stop
        </button>
      ) : (
        <button type="submit" disabled={!input.trim() || !model.isReady}>
          Send
        </button>
      )}

      {error && <p role="alert">{error.message}</p>}
    </form>
  );
}
```

For the fuller styled version, see the [React chat demo source](https://github.com/ChrisCraig68/use-chrome-ai/blob/main/examples/react/src/Chat.tsx).

## What You Get

The React adapter wraps the browser APIs in small, predictable hooks:

| Hook | Use it for |
| --- | --- |
| `useChat()` | Multi-turn streaming chat |
| `usePrompt()` | One-off Prompt API calls |
| `useSummarizer()` | Summaries, key points, and TLDR flows |
| `useWriter()` | Drafting new text |
| `useRewriter()` | Changing tone, length, or style |
| `useTranslator()` | Browser-backed translation |
| `useProofreader()` | Proofreading and correction suggestions |
| `useLanguageDetector()` | Language detection |
| `useModelStatus()` | Binding any core controller to React state |
| `useAiController()` | Escape hatch for custom core controller usage |

Hooks do not reject during normal UI use. They update `error`, keep `model` current, and expose a stop function when the underlying API supports aborting.

## Links

- [React quick start and signatures](https://github.com/ChrisCraig68/use-chrome-ai/blob/main/docs/react.md)
- [Blog post: hooks for Chrome built-in AI](https://chriscraig.dev/blog/use-chrome-ai-hooks-for-built-in-ai)
- [Project README](https://github.com/ChrisCraig68/use-chrome-ai#readme)
- [Chrome built-in AI setup](https://developer.chrome.com/docs/ai/get-started)
- [Chrome model download UX guide](https://developer.chrome.com/docs/ai/inform-users-of-model-download)
- [Edge built-in AI docs](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/prompt-api)
