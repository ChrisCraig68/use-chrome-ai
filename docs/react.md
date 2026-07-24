# @use-chrome-ai/react

React hooks for the browsers' built-in AI APIs, as shipped in
[Chrome](https://developer.chrome.com/docs/ai/built-in) and
[Edge](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/prompt-api).
The package depends on and re-exports [`use-chrome-ai`](./core.md), so you can import
hooks and core factories from one place.

```bash
npm i @use-chrome-ai/react
```

`react` is a peer dependency (`>=18`).

For browser setup, API status, and model behavior, use Chrome's
[Get started](https://developer.chrome.com/docs/ai/get-started),
[API status](https://developer.chrome.com/docs/ai/built-in-apis), and
[model download](https://developer.chrome.com/docs/ai/inform-users-of-model-download)
docs, or Edge's
[built-in AI docs](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/prompt-api).

## Chat

```tsx
import { useChat } from "@use-chrome-ai/react";

export function Chat() {
  const { messages, input, setInput, send, stop, isStreaming, model } = useChat({
    system: "You are a helpful assistant.",
  });

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

Hooks never reject. They update `error`, stream text into state, and expose `stop()` for
the in-flight request.

## Error Handling

Read `error` from the hook you are using and render from that state. For chat, reset the
conversation when the model reports a full context window:

```tsx
import { useChat } from "@use-chrome-ai/react";

export function ChatError() {
  const { error, reset } = useChat();

  if (!error) return null;

  if (error.name === "ContextFullError") {
    return (
      <p role="alert">
        This conversation is full. <button onClick={reset}>Start over</button>
      </p>
    );
  }

  return <p role="alert">{error.message}</p>;
}
```

## Model Status

Every hook returns a `model` object:

```ts
interface ModelStatus {
  status: ControllerState;
  availability: "unavailable" | "downloadable" | "downloading" | "available";
  progress: number;
  supported: boolean;
  isUnavailable: boolean;
  /** Availability hasn't resolved yet — show a neutral state, not a download CTA. */
  isChecking: boolean;
  isDownloading: boolean;
  isReady: boolean;
  download(opts?: { signal?: AbortSignal; requireGesture?: boolean }): Promise<unknown>;
}
```

Use `model.download()` for your download button (the browser requires a user gesture to
start the download). Chrome's
[model download guide](https://developer.chrome.com/docs/ai/inform-users-of-model-download)
covers the browser-side UX.

Building a browser extension whose UI drives a session in an
[offscreen document](https://developer.chrome.com/docs/extensions/reference/api/offscreen)?
A click's activation doesn't cross the message boundary, so call
`model.download({ requireGesture: false })` once you've verified the gesture on the UI
side. See the [core quick start](./core.md#download-and-status) for the full rationale.

## Hooks

| Hook | Use it for | Returns |
| --- | --- | --- |
| `useChat(options?)` | Multi-turn chat | `messages`, `input`, `setInput`, `send`, `stop`, `reset`, `isStreaming`, `error`, `model` |
| `usePrompt(options?)` | [Prompt API](https://developer.chrome.com/docs/ai/prompt-api) | `prompt`, `result`, `stop`, `isStreaming`, `error`, `model` |
| `useSummarizer(options?)` | [Summarizer API](https://developer.chrome.com/docs/ai/summarizer-api) | `summarize`, `result`, `stop`, `isStreaming`, `error`, `model` |
| `useWriter(options?)` | [Writer API](https://developer.chrome.com/docs/ai/writer-api) | `write`, `result`, `stop`, `isStreaming`, `error`, `model` |
| `useRewriter(options?)` | [Rewriter API](https://developer.chrome.com/docs/ai/rewriter-api) | `rewrite`, `result`, `stop`, `isStreaming`, `error`, `model` |
| `useTranslator(pair)` | [Translator API](https://developer.chrome.com/docs/ai/translator-api) | `translate`, `result`, `stop`, `isStreaming`, `error`, `model` |
| `useProofreader(options?)` | [Proofreader API](https://developer.chrome.com/docs/ai/proofreader-api) | `proofread`, `result`, `isPending`, `error`, `model` |
| `useLanguageDetector(options?)` | [Language Detector API](https://developer.chrome.com/docs/ai/language-detection) | `detect`, `result`, `isPending`, `error`, `model` |
| `useModelStatus(controller)` | Bind any core controller | `ControllerState` |
| `useAiController(make, key)` | Escape hatch | `controller` plus `model` |

## Examples

```tsx
const { summarize, result } = useSummarizer({ type: "key-points", length: "short" });
await summarize(article);

const { rewrite } = useRewriter({ tone: "more-casual" });
await rewrite(draft);

const { translate } = useTranslator({ sourceLanguage: "en", targetLanguage: "es" });
await translate("Good morning");

const { proofread } = useProofreader();
const corrected = await proofread("i has bad gramer");

const { detect } = useLanguageDetector();
const languages = await detect("bonjour le monde");
```

For grammar-constrained JSON, use the core controller through the escape hatch:

```tsx
import { createLanguageModel, useAiController } from "@use-chrome-ai/react";

const { controller } = useAiController(() => createLanguageModel(), "language-model");
const json = await controller.prompt("List 3 fruits as JSON.", {
  responseConstraint: { type: "array", items: { type: "string" } },
});
```

## Signatures

```ts
useChat(options?: ChatOptions): {
  model: ModelStatus;
  messages: { role: "user" | "assistant"; content: string }[];
  input: string;
  setInput(value: string): void;
  send(text?: string): Promise<void>;
  stop(): void;
  reset(): void;
  isStreaming: boolean;
  error: Error | null;
};

usePrompt(options?: LanguageModelOptions): {
  model: ModelStatus;
  prompt(input: string): Promise<string>;
  result: string;
  isStreaming: boolean;
  error: Error | null;
  stop(): void;
};

useSummarizer(options?: SummarizerOptions): StreamingTaskHook<{ text: string; context?: string }> & {
  summarize(text: string, perCall?: { context?: string }): Promise<string>;
};

useWriter(options?: WriterOptions): StreamingTaskHook<{ prompt: string; context?: string }> & {
  write(prompt: string, perCall?: { context?: string }): Promise<string>;
};

useRewriter(options?: RewriterOptions): StreamingTaskHook<{ text: string; context?: string }> & {
  rewrite(text: string, perCall?: { context?: string }): Promise<string>;
};

useTranslator(pair: TranslatorPair): StreamingTaskHook<{ text: string }> & {
  translate(text: string): Promise<string>;
};

type StreamingTaskHook<P> = {
  model: ModelStatus;
  result: string;
  isStreaming: boolean;
  error: Error | null;
  stop(): void;
  stream(params: P): Promise<string>;
};

useProofreader(options?: ProofreaderOptions): {
  model: ModelStatus;
  proofread(text: string): Promise<ProofreadResult | null>;
  result: ProofreadResult | null;
  isPending: boolean;
  error: Error | null;
};

useLanguageDetector(options?: LanguageDetectorOptions): {
  model: ModelStatus;
  detect(text: string): Promise<DetectResult[] | null>;
  result: DetectResult[] | null;
  isPending: boolean;
  error: Error | null;
};
```

Option and result types are listed in the [core reference](./core.md#reference). Back to the
[project README](../README.md).
