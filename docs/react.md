# @use-chrome-ai/react

React hooks for [Chrome's built-in AI](https://developer.chrome.com/docs/ai/built-in) (Gemini Nano). On-device, streaming, with availability gating and model-download progress handled for you. Built on the framework-agnostic [`use-chrome-ai`](./core.md) core, which it re-exports — so `create*`/`isSupported` are importable from here too.

```bash
npm i @use-chrome-ai/react   # pulls in use-chrome-ai automatically
```

`react` is a peer dependency (>=18, for `useSyncExternalStore`).

> Built-in AI is desktop Chrome/Edge only and partly behind flags/origin trials — see [Get started with built-in AI](https://developer.chrome.com/docs/ai/get-started). Every hook exposes `isUnavailable`; gate your UI on it and render a fallback.

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
      {messages.map((m, i) => <p key={i}><b>{m.role}:</b> {m.content}</p>)}
      <form onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} disabled={isStreaming} />
        <button type="submit">Send</button>
        {isStreaming && <button type="button" onClick={stop}>Stop</button>}
      </form>
    </div>
  );
}
```

The first `send()` from the form submit (a user gesture) downloads the model with progress, then streams the reply into `messages`.

## The hooks

Every hook returns a shared status surface (`availability`, `downloadProgress`, `isUnavailable`, `isDownloading`, `isReady`, `download()`) plus its own methods. Options are create-time; changing them transparently re-opens the on-device session.

| Hook | API | What you get |
| --- | --- | --- |
| `useChat(opts?)` | LanguageModel | `messages`, `input`/`setInput`, `send`, `stop`, `reset`, `isStreaming` |
| `usePrompt(opts?)` | LanguageModel | `prompt(text)` → streams into `result`, `stop` |
| `useSummarizer(opts?)` | Summarizer | `summarize(text, { context? })` → `result`, `stop` |
| `useWriter(opts?)` | Writer | `write(prompt, { context? })` → `result`, `stop` |
| `useRewriter(opts?)` | Rewriter | `rewrite(text, { context? })` → `result`, `stop` |
| `useTranslator(pair)` | Translator | `translate(text)` → `result`, `stop` |
| `useProofreader(opts?)` | Proofreader | `proofread(text)` → `result` (corrections), `isPending` |
| `useLanguageDetector(opts?)` | LanguageDetector | `detect(text)` → `result` (ranked), `isPending` |
| `useModelStatus(controller)` | any | bind a controller's status |
| `useAiController(make, key)` | any | escape hatch: full controller access |

```tsx
// Summarize
const { summarize, result } = useSummarizer({ type: "key-points", length: "short" });
await summarize(article);

// Rewrite — tone/length are create-time; changing them transparently re-opens the session
const { rewrite } = useRewriter({ tone: "more-casual" });

// Translate (one controller per language pair)
const { translate } = useTranslator({ sourceLanguage: "en", targetLanguage: "es" });

// Proofread (request/response — no streaming)
const { proofread } = useProofreader();
const r = await proofread("i has bad gramer");
// r.correctedInput, r.corrections[] → { startIndex, endIndex, correction, types? }

// Detect language
const { detect } = useLanguageDetector();
const [top] = (await detect("bonjour le monde")) ?? [];
// top.detectedLanguage === "fr", top.confidence
```

## Gating the model download

```tsx
const { availability, isDownloading, downloadProgress, download } = useSummarizer();

if (availability === "downloadable")
  return <button onClick={() => download()}>Enable on-device AI</button>;
if (isDownloading)
  return <progress value={downloadProgress} max={1} />;
```

Calling an action straight from a click already satisfies the gesture requirement, so the common path "just works."

## Structured (JSON) output

The hooks stream text. For grammar-constrained output, reach the core controller through the escape hatch:

```tsx
import { useAiController } from "@use-chrome-ai/react";
import { createLanguageModel } from "@use-chrome-ai/react"; // core re-exported

const { controller } = useAiController(() => createLanguageModel(), "lm");
const json = await controller.prompt("List 3 fruits as JSON", {
  responseConstraint: { type: "array", items: { type: "string" } },
});
```

## Errors

Hooks never reject — read `error`. `useChat` surfaces `ContextFullError` when the conversation exceeds the model's context window; call `reset()` to recover.

```tsx
const { error, reset } = useChat();
{error?.name === "ContextFullError" && <button onClick={reset}>Start over</button>}
```

See the [full API reference](./api-reference.md) and the [project README](../README.md).
