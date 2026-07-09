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
  download(opts?: { signal?: AbortSignal }): Promise<unknown>;
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
