# API reference

Complete public surface of `use-chrome-ai` (core), `@use-chrome-ai/react`, and
`@use-chrome-ai/vue`. Types are written in TypeScript shorthand.

- [Shared status](#shared-status) · [React hooks](#react-hooks) · [Vue composables](#vue-composables)
- [Core factories](#core-factories) · [Core utilities](#core-utilities) · [Types & errors](#types--errors)

---

## Shared status

Every React hook returns this status surface (spread into the hook's own fields):

```ts
interface AiStatus {
  status: ControllerState;          // the full snapshot (see Types)
  availability: Availability;       // 'unavailable' | 'downloadable' | 'downloading' | 'available'
  downloadProgress: number;         // 0..1, meaningful while downloading
  supported: boolean;               // the API's global class exists in this browser
  isUnavailable: boolean;           // not supported, or availability === 'unavailable'
  isDownloading: boolean;
  isReady: boolean;                 // availability === 'available'
  download(): Promise<unknown>;     // start the model download — CALL FROM A CLICK HANDLER
}
```

---

## React hooks

Import from `@use-chrome-ai/react`. Options are the first argument (create-time, e.g.
Summarizer `type`); changing them transparently re-opens the on-device session.

### `useChat(options?) → ChatHook`

```ts
useChat(options?: ChatOptions): AiStatus & {
  messages: { role: "user" | "assistant"; content: string }[];
  input: string;
  setInput(v: string): void;
  send(text?: string): Promise<void>;   // defaults to current input; streams reply into messages
  stop(): void;                         // abort the in-flight reply
  reset(): void;                        // clear the conversation, start fresh
  isStreaming: boolean;
  error: Error | null;
}

interface ChatOptions {
  system?: string;                      // default: "You are a helpful assistant."
  initialMessages?: { role: "user" | "assistant"; content: string }[];
  topK?: number;
  temperature?: number;
  expectedInputs?: { type: string; languages?: string[] }[];
  expectedOutputs?: { type: string; languages?: string[] }[];
}
```

### `usePrompt(options?) → PromptHook`

One-shot LanguageModel prompting (no conversation memory).

```ts
usePrompt(options?: LanguageModelOptions): AiStatus & {
  prompt(input: string): Promise<string>;  // streams into `result`, resolves with full text
  result: string;
  isStreaming: boolean;
  error: Error | null;
  stop(): void;
}

interface LanguageModelOptions {
  system?: string;                      // shorthand for a single system message (index 0)
  initialPrompts?: { role: "system" | "user" | "assistant"; content: string }[];
  topK?: number;
  temperature?: number;
  expectedInputs?: { type: string; languages?: string[] }[];
  expectedOutputs?: { type: string; languages?: string[] }[];
}
```

> For grammar-constrained / JSON output, use the core: `createLanguageModel().prompt(input, { responseConstraint })`.

### `useSummarizer(options?) → SummarizerHook`

```ts
useSummarizer(options?: SummarizerOptions): AiStatus & {
  summarize(text: string, perCall?: { context?: string }): Promise<string>;  // streams into result
  result: string;
  isStreaming: boolean;
  error: Error | null;
  stop(): void;
}

interface SummarizerOptions {
  type?: "tldr" | "key-points" | "teaser" | "headline";   // default "tldr"
  format?: "plain-text" | "markdown";                      // default "plain-text"
  length?: "short" | "medium" | "long";                    // default "short"
  sharedContext?: string;
  expectedInputLanguages?: string[];                       // default ["en"]
  outputLanguage?: string;                                 // default "en"
}
```

### `useWriter(options?) → WriterHook`

```ts
useWriter(options?: WriterOptions): AiStatus & {
  write(prompt: string, perCall?: { context?: string }): Promise<string>;    // streams into result
  result: string; isStreaming: boolean; error: Error | null; stop(): void;
}

interface WriterOptions {
  tone?: "formal" | "neutral" | "casual";   // default "neutral"
  format?: "plain-text" | "markdown";        // default "plain-text"
  length?: "short" | "medium" | "long";      // default "medium"
  sharedContext?: string;
  expectedInputLanguages?: string[];
  outputLanguage?: string;
}
```

### `useRewriter(options?) → RewriterHook`

Tone/length are pinned at session create; changing the option re-opens the session automatically.

```ts
useRewriter(options?: RewriterOptions): AiStatus & {
  rewrite(text: string, perCall?: { context?: string }): Promise<string>;    // streams into result
  result: string; isStreaming: boolean; error: Error | null; stop(): void;
}

interface RewriterOptions {
  tone?: "as-is" | "more-formal" | "more-casual";   // default "as-is"
  format?: "as-is" | "plain-text" | "markdown";      // default "as-is"
  length?: "as-is" | "shorter" | "longer";           // default "as-is"
  sharedContext?: string;
  expectedInputLanguages?: string[];
  outputLanguage?: string;
}
```

### `useTranslator(pair) → TranslatorHook`

One controller per language pair. Availability is per-pair; Chrome hides per-pair download
progress for privacy, so `downloadProgress` may jump 0→1.

```ts
useTranslator(pair: { sourceLanguage: string; targetLanguage: string }): AiStatus & {
  translate(text: string): Promise<string>;   // streams into result
  result: string; isStreaming: boolean; error: Error | null; stop(): void;
}
```

### `useProofreader(options?) → ProofreaderHook`

Request/response (no streaming) — exposes `isPending`, not `isStreaming`.

```ts
useProofreader(options?: ProofreaderOptions): AiStatus & {
  proofread(text: string): Promise<ProofreadResult | null>;
  result: ProofreadResult | null;
  isPending: boolean;
  error: Error | null;
}

interface ProofreadResult {
  correctedInput: string;
  corrections: {
    startIndex: number;
    endIndex: number;
    correction: string;          // replacement for input.slice(startIndex, endIndex)
    types?: string[];            // often absent (not in the current Chrome origin trial)
    explanation?: string;
  }[];
}

interface ProofreaderOptions {
  expectedInputLanguages?: string[];
  includeCorrectionTypes?: boolean;
  includeCorrectionExplanations?: boolean;
  correctionExplanationLanguage?: string;
}
```

### `useLanguageDetector(options?) → LanguageDetectorHook`

Request/response.

```ts
useLanguageDetector(options?: { expectedInputLanguages?: string[] }): AiStatus & {
  detect(text: string): Promise<DetectResult[] | null>;
  result: DetectResult[] | null;        // ranked, most-confident first
  isPending: boolean;
  error: Error | null;
}

interface DetectResult { detectedLanguage: string; confidence: number } // confidence 0..1
```

### `useModelStatus(controller) → ControllerState`

Low-level: bind any controller's status with `useSyncExternalStore`. Used internally; useful
with a controller you created yourself.

### `useAiController(make, key) → AiStatus & { controller }`

Escape hatch — own any core controller and get its status plus full access to its methods
(e.g. structured output, the live session). Re-creates when `key` changes.

```ts
const { controller, isReady } = useAiController(() => createLanguageModel({ system }), `lm:${system}`);
await controller.prompt("…", { responseConstraint: schema });
```

---

## Vue composables

Import from `@use-chrome-ai/vue`. Returns refs.

```ts
useChat(options?: ChatOptions): {
  status: Readonly<Ref<ControllerState>>;
  messages: Ref<{ role: "user" | "assistant"; content: string }[]>;
  isStreaming: Ref<boolean>;
  error: Ref<Error | null>;
  send(text: string): Promise<void>;
  stop(): void;
  reset(): void;
}

useModelStatus<S>(store: Store<S>): Readonly<Ref<S>>;   // bind any controller to a Vue ref
```

---

## Core factories

Import from `use-chrome-ai`. Each returns a controller implementing `BaseController` (below)
plus its own methods. Framework-agnostic — bind to any UI via `subscribe`/`getSnapshot`.

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
  run(params: P, signal?: AbortSignal): Promise<string>;        // non-streaming
  stream(params: P, signal?: AbortSignal): AsyncGenerator<string>;
}

interface BaseController {
  subscribe(onChange: () => void): () => void;   // useSyncExternalStore-shaped
  getSnapshot(): ControllerState;
  getServerSnapshot(): ControllerState;
  refresh(): Promise<Availability>;              // re-check availability()
  warm(opts?: { signal?: AbortSignal }): Promise<unknown>;   // ensure a live session
  download(opts?: { signal?: AbortSignal }): Promise<unknown>; // alias for warm — call from a gesture
  invalidate(): void;                            // drop session + re-check (eviction recovery)
  destroy(): void;
}
```

---

## Core utilities

```ts
isSupported(): boolean;                 // any built-in AI global exists (covers Edge)
isApiSupported(api: ChromeAiApi): boolean;
type ChromeAiApi = "languageModel" | "summarizer" | "writer" | "rewriter"
                 | "proofreader" | "translator" | "languageDetector";

normalizeAvailability(raw: string): Availability;
drainStream(stream: ReadableStream<string>): AsyncGenerator<string>;
isAbortError(err: unknown): boolean;
readUsage(session: unknown): { used: number; quota: number; remaining: number } | null; // volatile; quarantined

class SessionLifecycle<TSession> { /* the core controller; advanced use */ }
store(life: SessionLifecycle): BaseController;
```

---

## Types & errors

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

class ChromeAiError extends Error {}
class UnavailableError extends ChromeAiError {}        // API absent or availability 'unavailable'
class ActivationRequiredError extends ChromeAiError {} // download needs a user gesture
class ContextFullError extends ChromeAiError {}        // chat exceeded context window (call reset())
```
