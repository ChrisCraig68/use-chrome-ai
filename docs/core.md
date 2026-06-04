# use-chrome-ai

Framework-agnostic core for [Chrome's built-in AI](https://developer.chrome.com/docs/ai/built-in) (Gemini Nano). Zero dependencies, plain TypeScript — drop it into any web page or framework. It handles availability gating, model-download progress, streaming, abort, and mid-session eviction recovery; you build the UI.

The React and Vue adapters ([`@use-chrome-ai/react`](./react.md), [`@use-chrome-ai/vue`](./vue.md)) are thin wrappers over this package.

```bash
npm i use-chrome-ai
```

> Built-in AI is desktop Chrome only and partly behind flags/origin trials — see [Get started with built-in AI](https://developer.chrome.com/docs/ai/get-started). Feature-detect with `isSupported()` and render a fallback when it's missing.

## Streaming chat

```ts
import { createChat, isSupported } from "use-chrome-ai";

if (isSupported()) {
  const chat = createChat({ system: "You are a helpful assistant." });

  // One-time: download the model from a click (Chrome requires a user gesture).
  await chat.download();

  // Then stream replies — a normal send() never triggers a download:
  for await (const delta of chat.send("Hello!")) {
    output.textContent += delta; // stream deltas into the DOM
  }
}
```

`chat.messages` holds the running conversation. `createChat` keeps one session and its context across turns; `chat.reset()` starts fresh.

## One-shot tasks

```ts
import { createSummarizer, createTranslator } from "use-chrome-ai";

const summarizer = createSummarizer({ type: "key-points", length: "short" });
const summary = await summarizer.run({ text: longArticle });   // non-streaming
// …or summarizer.stream({ text }) for an AsyncGenerator<string>

const translator = createTranslator({ sourceLanguage: "en", targetLanguage: "fr" });
for await (const delta of translator.stream({ text: "Good morning" })) {
  output.textContent += delta;
}
```

The same shape applies to `createWriter`, `createRewriter`, `createProofreader`, and `createLanguageDetector`.

## Structured (JSON) output

```ts
import { createLanguageModel } from "use-chrome-ai";

const lm = createLanguageModel();
const json = await lm.prompt("List 3 fruits.", {
  responseConstraint: { type: "array", items: { type: "string" } },
});
JSON.parse(json); // ["apple", "banana", "cherry"]
```

## Model status / download UI

Every controller is a `useSyncExternalStore`-shaped store (`subscribe` / `getSnapshot`), so you can drive any UI:

```ts
import { createSummarizer } from "use-chrome-ai";

const s = createSummarizer();
const unsubscribe = s.subscribe(() => {
  const { availability, phase, downloadProgress } = s.getSnapshot();
  // availability: 'unavailable' | 'downloadable' | 'downloading' | 'available'
  // drive your own progress UI
});

// Downloads are explicit — run()/stream() never start one. Trigger it from a click:
button.onclick = () => s.download();   // requires a user gesture; throws ActivationRequiredError otherwise
```

## API reference

Import from `use-chrome-ai`:

```ts
import {
  createChat, createLanguageModel,
  createSummarizer, createWriter, createRewriter,
  createTranslator, createProofreader, createLanguageDetector,
  isSupported, isApiSupported,
  drainStream, isAbortError,
  type Availability, type ControllerState,
} from "use-chrome-ai";
```

Types are written in TypeScript shorthand. `create*` functions reject on failure (imperative control).

### Factories

Each returns a controller implementing `BaseController` (below) plus its own methods.

```ts
createChat(options?: ChatOptions): BaseController & {
  readonly messages: { role: "user" | "assistant"; content: string }[];
  send(text: string, opts?: { signal?: AbortSignal }): AsyncGenerator<string>;
  reset(): void;
}

createLanguageModel(options?: LanguageModelOptions): BaseController & {
  prompt(input: string, opts?: { signal?: AbortSignal; responseConstraint?: object }): Promise<string>;
  promptStream(input: string, opts?: { signal?: AbortSignal }): AsyncGenerator<string>;
}

createSummarizer(options?: SummarizerOptions): TaskController<{ text: string; context?: string }>;
createWriter(options?: WriterOptions):         TaskController<{ prompt: string; context?: string }>;
createRewriter(options?: RewriterOptions):     TaskController<{ text: string; context?: string }>;
createTranslator(pair: { sourceLanguage: string; targetLanguage: string }): TaskController<{ text: string }>;

createProofreader(options?: ProofreaderOptions): BaseController & {
  proofread(text: string, signal?: AbortSignal): Promise<ProofreadResult>;   // serialized internally
}
createLanguageDetector(options?): BaseController & {
  detect(text: string, signal?: AbortSignal): Promise<DetectResult[]>;
}

interface TaskController<P> extends BaseController {
  run(params: P, signal?: AbortSignal): Promise<string>;            // non-streaming
  stream(params: P, signal?: AbortSignal): AsyncGenerator<string>;
}

interface BaseController {
  subscribe(onChange: () => void): () => void;   // useSyncExternalStore-shaped
  getSnapshot(): ControllerState;
  getServerSnapshot(): ControllerState;
  refresh(): Promise<Availability>;              // re-check availability
  warm(opts?: { signal?: AbortSignal }): Promise<unknown>;     // open a session; never downloads
  download(opts?: { signal?: AbortSignal }): Promise<unknown>; // download the model — call from a gesture
  invalidate(): void;                            // drop session + re-check (eviction recovery)
  destroy(): void;
}
```

### Create-time options

```ts
interface ChatOptions {
  system?: string;                      // default: "You are a helpful assistant."
  initialMessages?: { role: "user" | "assistant"; content: string }[];
  topK?: number;
  temperature?: number;
  expectedInputs?: { type: string; languages?: string[] }[];
  expectedOutputs?: { type: string; languages?: string[] }[];
}

interface LanguageModelOptions {
  system?: string;                      // shorthand for a single system message (index 0)
  initialPrompts?: { role: "system" | "user" | "assistant"; content: string }[];
  topK?: number;
  temperature?: number;
  expectedInputs?: { type: string; languages?: string[] }[];
  expectedOutputs?: { type: string; languages?: string[] }[];
}

interface SummarizerOptions {
  type?: "tldr" | "key-points" | "teaser" | "headline";   // default "tldr"
  format?: "plain-text" | "markdown";                      // default "plain-text"
  length?: "short" | "medium" | "long";                    // default "short"
  sharedContext?: string;
  expectedInputLanguages?: string[];                       // default ["en"]
  outputLanguage?: string;                                 // default "en"
}

interface WriterOptions {
  tone?: "formal" | "neutral" | "casual";   // default "neutral"
  format?: "plain-text" | "markdown";        // default "plain-text"
  length?: "short" | "medium" | "long";      // default "medium"
  sharedContext?: string;
  expectedInputLanguages?: string[];
  outputLanguage?: string;
}

interface RewriterOptions {
  tone?: "as-is" | "more-formal" | "more-casual";   // default "as-is"
  format?: "as-is" | "plain-text" | "markdown";      // default "as-is"
  length?: "as-is" | "shorter" | "longer";           // default "as-is"
  sharedContext?: string;
  expectedInputLanguages?: string[];
  outputLanguage?: string;
}

interface ProofreaderOptions {
  expectedInputLanguages?: string[];
  includeCorrectionTypes?: boolean;
  includeCorrectionExplanations?: boolean;
  correctionExplanationLanguage?: string;
}
```

### Utilities

```ts
isSupported(): boolean;                 // any built-in AI global exists
isApiSupported(api: ChromeAiApi): boolean;
type ChromeAiApi = "languageModel" | "summarizer" | "writer" | "rewriter"
                 | "proofreader" | "translator" | "languageDetector";

normalizeAvailability(raw: string): Availability;
drainStream(stream: ReadableStream<string>): AsyncGenerator<string>;
isAbortError(err: unknown): boolean;
readUsage(session: unknown): { used: number; quota: number; remaining: number } | null; // volatile

// Advanced: the lifecycle seam every adapter binds to
class SessionLifecycle<TSession> { /* … */ }
store(life: SessionLifecycle): BaseController;
```

### Types & errors

```ts
type Availability = "unavailable" | "downloadable" | "downloading" | "available";
type Phase = "idle" | "creating" | "running" | "streaming" | "error";

interface ControllerState {
  supported: boolean;
  availability: Availability;
  phase: Phase;
  downloadProgress: number;   // 0..1
  error: Error | null;
}

interface ProofreadResult {
  correctedInput: string;
  corrections: {
    startIndex: number;
    endIndex: number;
    correction: string;       // replacement for input.slice(startIndex, endIndex)
    types?: string[];         // often absent (not in the current Chrome origin trial)
    explanation?: string;
  }[];
}

interface DetectResult { detectedLanguage: string; confidence: number }   // confidence 0..1

class ChromeAiError extends Error {}
class UnavailableError extends ChromeAiError {}        // API absent or availability 'unavailable'
class ActivationRequiredError extends ChromeAiError {} // model needs downloading first (call download() from a gesture)
class ContextFullError extends ChromeAiError {}        // chat exceeded context window (call reset())
```

Framework adapters: [React hooks](./react.md) · [Vue composables](./vue.md). Back to the [project README](../README.md).
