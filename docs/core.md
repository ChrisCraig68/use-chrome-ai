# use-chrome-ai Core

Framework-agnostic TypeScript primitives for the browsers' built-in AI APIs, as shipped
in [Chrome](https://developer.chrome.com/docs/ai/built-in) and
[Edge](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/prompt-api). The
core targets the standardized globals (`LanguageModel`, `Summarizer`, …), has zero
runtime dependencies, and can be used in plain browser code, web components, or any UI
framework.

```bash
npm i use-chrome-ai
```

React and Vue users can import the same core exports from
[`@use-chrome-ai/react`](./react.md) or [`@use-chrome-ai/vue`](./vue.md).

## Browser Docs

Use the vendor docs for platform setup, status, and API-specific details.

Chrome:

- [Built-in AI overview](https://developer.chrome.com/docs/ai/built-in)
- [API status](https://developer.chrome.com/docs/ai/built-in-apis)
- [Get started](https://developer.chrome.com/docs/ai/get-started)
- [Prompt API](https://developer.chrome.com/docs/ai/prompt-api)
- [Summarizer API](https://developer.chrome.com/docs/ai/summarizer-api)
- [Writer API](https://developer.chrome.com/docs/ai/writer-api)
- [Rewriter API](https://developer.chrome.com/docs/ai/rewriter-api)
- [Proofreader API](https://developer.chrome.com/docs/ai/proofreader-api)
- [Translator API](https://developer.chrome.com/docs/ai/translator-api)
- [Language Detector API](https://developer.chrome.com/docs/ai/language-detection)

Edge:

- [Prompt API](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/prompt-api)
- [Writing Assistance APIs (Summarizer, Writer, Rewriter)](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/writing-assistance-apis)
- [Translator API](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/translator-api)
- [Language Detector API](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/languagedetector-api)
- [Proofreader API](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/proofreader-api)

The wrapper behaves identically in both browsers: feature-detect with `isSupported()` /
`isApiSupported()`, then let `availability()` (via `refresh()` or any controller call)
decide what UI to render. Use `detectBrowser()` only to tailor setup copy — for example
linking Chrome's flags page vs Edge's — never to gate features.

## Chat

```ts
import { createChat, isSupported } from "use-chrome-ai";

if (!isSupported()) {
  fallback.hidden = false;
}

const chat = createChat({ system: "You are a helpful assistant." });

chat.subscribe(() => {
  const { availability, downloadProgress } = chat.getSnapshot();
  downloadButton.hidden = availability !== "downloadable";
  progress.hidden = availability !== "downloading";
  progress.value = downloadProgress;
});

downloadButton.onclick = () => {
  void chat.download();
};

sendButton.onclick = async () => {
  for await (const delta of chat.send(input.value)) {
    output.textContent += delta;
  }
};
```

`createChat` keeps one LanguageModel session alive across turns. Use `chat.messages` for
the transcript and `chat.reset()` when you want a fresh conversation.

## One-Shot Tasks

Task APIs share the same library shape: create a controller, then call `run()` for a full
response or `stream()` for deltas.

```ts
import { createSummarizer, createTranslator } from "use-chrome-ai";

const summarizer = createSummarizer({ type: "key-points", length: "short" });
const summary = await summarizer.run({ text: article });

const translator = createTranslator({ sourceLanguage: "en", targetLanguage: "fr" });
for await (const delta of translator.stream({ text: "Good morning" })) {
  output.textContent += delta;
}
```

The same controller shape powers Writer, Rewriter, Translator, and Summarizer. Proofreader
and Language Detector are request/response APIs.

## Structured Output

Use `createLanguageModel()` when you want the Prompt API without chat history, including
grammar-constrained JSON output.

```ts
import { createLanguageModel } from "use-chrome-ai";

const model = createLanguageModel();
const json = await model.prompt("List 3 fruits as JSON.", {
  responseConstraint: { type: "array", items: { type: "string" } },
});

const fruits = JSON.parse(json);
```

## Download And Status

Every controller exposes the same store:

```ts
controller.subscribe(onChange);
controller.getSnapshot();
controller.getServerSnapshot();
```

The snapshot contains:

```ts
interface ControllerState {
  supported: boolean;
  /** Whether availability() has resolved at least once — gate download CTAs on this. */
  checked: boolean;
  availability: "unavailable" | "downloadable" | "downloading" | "available";
  phase: "idle" | "creating" | "running" | "streaming" | "error";
  downloadProgress: number;
  error: Error | null;
}
```

If availability is `"downloadable"`, call `controller.download()` from your download
button (the browser requires a user gesture to start the download). Chrome's
[model download guide](https://developer.chrome.com/docs/ai/inform-users-of-model-download)
and [model management guide](https://developer.chrome.com/docs/ai/understand-built-in-model-management)
cover the browser behavior behind that state; Edge documents its model lifecycle in its
[Prompt API docs](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/prompt-api).

In a browser extension [offscreen document](https://developer.chrome.com/docs/extensions/reference/api/offscreen)
— the standard Manifest V3 place to own a session, since the globals aren't exposed to the
service worker — a popup/side-panel click's activation doesn't reach the offscreen
document, so `download()` throws `ActivationRequiredError` even though the browser would
start the download. Call `controller.download({ requireGesture: false })` there, once
you've verified the gesture on the UI side of the message boundary. It bypasses only this
library's local activation check; `warm()` never downloads regardless.

## Remote Controllers

The AI globals only exist in some contexts. A Manifest V3 extension owns its session in an
[offscreen document](https://developer.chrome.com/docs/extensions/reference/api/offscreen),
while the UI lives in a popup, side panel, options page, or content script — a different
JavaScript context with no globals to build a controller from.

`exposeController` serves a controller from the context that has the globals;
`connectController` returns a proxy that implements the same interfaces in any other
context. The proxy is a `Store<ControllerState>`, so `useSyncExternalStore` and both
framework adapters bind to it exactly as they do to a local controller.

```ts
// Host — where the AI globals live.
import { createSummarizer, exposeController } from "use-chrome-ai";

const stop = exposeController("summarizer", createSummarizer(), transport);
```

```ts
// Client — any other context.
import { connectController, type SummarizeParams, type TaskController } from "use-chrome-ai";

const summarizer = connectController<TaskController<SummarizeParams>>("summarizer", transport);

summarizer.subscribe(() => render(summarizer.getSnapshot()));
for await (const delta of summarizer.stream({ text: article })) output.textContent += delta;
```

The type parameter picks the surface you want: `BaseController`, `TaskController<P>`,
`LanguageModelController`, or the default `RemoteController<P>` (all of them).

### Transport

The bridge is transport-agnostic, so the core keeps zero dependencies and no `chrome.*`
types. You supply two functions:

```ts
interface Transport {
  send(message: unknown): void;
  /** Register a handler; returns an unsubscribe function. */
  onMessage(handler: (message: unknown) => void): () => void;
}
```

Implement it over `chrome.runtime` messaging, a `MessagePort`, a `BroadcastChannel`, or a
WebSocket. Messages are plain JSON-safe objects. The `chrome.runtime` binding is about
twenty lines and is the same on both sides:

```ts
const transport = {
  send: (message) => chrome.runtime.sendMessage(message).catch(() => {}),
  onMessage: (handler) => {
    const listener = (message: unknown) => handler(message);
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  },
};
```

Every message carries a protocol version and the controller id, so one transport can carry
several controllers alongside your own unrelated traffic — anything that doesn't match is
ignored.

### What The Protocol Guarantees

- **State.** The host pushes `ControllerState` on every change; the client serves the same
  snapshot reference until a real change lands. Until the first push arrives, the client
  reports `checked: false` so UIs show "checking" rather than a download CTA they may have
  to retract.
- **Errors.** `UnavailableError`, `ActivationRequiredError`, `ContextFullError`, and
  `BuiltInAiError` cross as codes and are rethrown as the real classes, so `instanceof`
  keeps working. An `AbortError` comes back as a `DOMException`, so `isAbortError()` still
  identifies it. Anything else arrives as an `Error` with its `name` and `message` intact.
  The `error` in a snapshot is rehydrated the same way.
- **Streaming.** `stream()`, `promptStream()`, and `run()`/`prompt()` are tagged with a
  request id, so concurrent and interleaved calls stay separate.
- **Abort.** An `AbortSignal` can't cross contexts. The client watches your signal, ends
  the generator immediately with an `AbortError`, and tells the host to cancel — you never
  wait on a round-trip for a cancellation you already made. Breaking out of a `for await`
  early cancels the host request too.
- **Downloads.** `download()` checks `navigator.userActivation` in the client document,
  where the click actually happened, then forwards with the host's own check disabled.
- **Multiple clients.** A popup and a side panel can connect to one exposed controller;
  state pushes fan out to all of them. `destroy()` on a client tears down only that proxy
  and cancels its own in-flight requests — the host controller and the other clients are
  untouched. For clients that vanish without a chance to say so, pass
  `{ requestTimeoutMs }` to `exposeController` as a backstop.

Two things do not cross. `warm()` and `download()` resolve with `undefined` rather than the
session handle — the session stays on the host, and you read progress from the state
pushes. And `createChat` is out of scope: its `messages` array is mutated in place, which
can't sync implicitly. Expose a `LanguageModelController` instead and keep the transcript
in your UI.

This is a bridge between trusted contexts of the same extension or app. It performs no
origin or sender checks; don't expose a controller on a channel a web page can reach.

## Reference

Import from `use-chrome-ai`:

```ts
import {
  createChat,
  createLanguageModel,
  createSummarizer,
  createWriter,
  createRewriter,
  createProofreader,
  createTranslator,
  createLanguageDetector,
  isSupported,
  isApiSupported,
  detectBrowser,
  drainStream,
  isAbortError,
  type Availability,
  type ControllerState,
} from "use-chrome-ai";
```

`detectBrowser()` returns `"chrome" | "edge" | "chromium" | "unknown"` — use it for
browser-specific setup copy, not for feature gating.

### Controllers

```ts
interface BaseController {
  subscribe(onChange: () => void): () => void;
  getSnapshot(): ControllerState;
  getServerSnapshot(): ControllerState;
  refresh(): Promise<Availability>;
  warm(opts?: { signal?: AbortSignal }): Promise<unknown>;
  /** `requireGesture` defaults to true; set false only to bypass the local activation
   *  check across a message boundary (e.g. an extension offscreen document). */
  download(opts?: { signal?: AbortSignal; requireGesture?: boolean }): Promise<unknown>;
  invalidate(): void;
  destroy(): void;
}

createChat(options?: ChatOptions): BaseController & {
  readonly messages: { role: "user" | "assistant"; content: string }[];
  send(text: string, opts?: { signal?: AbortSignal }): AsyncGenerator<string>;
  reset(): void;
};

createLanguageModel(options?: LanguageModelOptions): BaseController & {
  prompt(input: string, opts?: PromptOptions): Promise<string>;
  promptStream(input: string, opts?: { signal?: AbortSignal }): AsyncGenerator<string>;
};

interface TaskController<P> extends BaseController {
  run(params: P, signal?: AbortSignal): Promise<string>;
  stream(params: P, signal?: AbortSignal): AsyncGenerator<string>;
}

createSummarizer(options?: SummarizerOptions): TaskController<{ text: string; context?: string }>;
createWriter(options?: WriterOptions): TaskController<{ prompt: string; context?: string }>;
createRewriter(options?: RewriterOptions): TaskController<{ text: string; context?: string }>;
createTranslator(pair: TranslatorPair): TaskController<{ text: string }>;

createProofreader(options?: ProofreaderOptions): BaseController & {
  proofread(text: string, signal?: AbortSignal): Promise<ProofreadResult>;
};

createLanguageDetector(options?: LanguageDetectorOptions): BaseController & {
  detect(text: string, signal?: AbortSignal): Promise<DetectResult[]>;
};
```

### Remote Controllers

```ts
interface Transport {
  send(message: unknown): void;
  onMessage(handler: (message: unknown) => void): () => void;
}

/** Serve `controller` to other contexts. Returns a function that stops serving (it does
 *  not destroy the controller). `requestTimeoutMs` aborts a request still running after
 *  that long — a backstop for clients that disappear without disconnecting. */
exposeController(
  id: string,
  controller: BaseController,
  transport: Transport,
  options?: { requestTimeoutMs?: number },
): () => void;

/** Bind to an exposed controller. `T` picks the surface — it defaults to
 *  `RemoteController<P>`, which is `TaskController<P>` + `LanguageModelController`.
 *  `api` names this controller in locally thrown errors (defaults to `id`). */
connectController<T extends BaseController = RemoteController>(
  id: string,
  transport: Transport,
  options?: { api?: string },
): T;
```

### Common Options

```ts
interface ChatOptions {
  system?: string;
  initialMessages?: { role: "user" | "assistant"; content: string }[];
  topK?: number;
  temperature?: number;
}

interface LanguageModelOptions {
  system?: string;
  initialPrompts?: { role: "system" | "user" | "assistant"; content: string }[];
  topK?: number;
  temperature?: number;
}

interface SummarizerOptions {
  type?: "tldr" | "key-points" | "teaser" | "headline";
  format?: "plain-text" | "markdown";
  length?: "short" | "medium" | "long";
  sharedContext?: string;
}

interface WriterOptions {
  tone?: "formal" | "neutral" | "casual";
  format?: "plain-text" | "markdown";
  length?: "short" | "medium" | "long";
  sharedContext?: string;
}

interface RewriterOptions {
  tone?: "as-is" | "more-formal" | "more-casual";
  format?: "as-is" | "plain-text" | "markdown";
  length?: "as-is" | "shorter" | "longer";
  sharedContext?: string;
}

interface TranslatorPair {
  sourceLanguage: string;
  targetLanguage: string;
}
```

Language hints are also supported. LanguageModel uses `expectedInputs` and
`expectedOutputs`; task APIs use `expectedInputLanguages` and `outputLanguage`; Translator
uses `sourceLanguage` and `targetLanguage`.

### Errors

Core controller methods reject so imperative code can decide what to do.

```ts
class BuiltInAiError extends Error {} // base class (alias: ChromeAiError, deprecated)
class UnavailableError extends BuiltInAiError {}
class ActivationRequiredError extends BuiltInAiError {}
class ContextFullError extends BuiltInAiError {}
```

`AbortError` is treated as cancellation. Use `isAbortError(error)` if you need to branch on
it.

Framework docs: [React](./react.md) | [Vue](./vue.md). Back to the
[project README](../README.md).
