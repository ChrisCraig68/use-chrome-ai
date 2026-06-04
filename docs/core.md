# use-chrome-ai

Framework-agnostic core for [Chrome's built-in AI](https://developer.chrome.com/docs/ai/built-in) (Gemini Nano). Zero dependencies, plain TypeScript — drop it into any web page or framework. It handles availability gating, model-download progress, streaming, abort, and mid-session eviction recovery; you build the UI.

The React and Vue adapters ([`@use-chrome-ai/react`](./react.md), [`@use-chrome-ai/vue`](./vue.md)) are thin wrappers over this package.

```bash
npm i use-chrome-ai
```

> Built-in AI is desktop Chrome/Edge only and partly behind flags/origin trials — see [Get started with built-in AI](https://developer.chrome.com/docs/ai/get-started). Feature-detect with `isSupported()` and render a fallback when it's missing.

## Streaming chat

```ts
import { createChat, isSupported } from "use-chrome-ai";

if (isSupported()) {
  const chat = createChat({ system: "You are a helpful assistant." });

  // Call from a click handler so the first run can download the model.
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

// Starting a download requires a user gesture — call from a click:
button.onclick = () => s.download();   // throws ActivationRequiredError if not from a gesture
```

## Exports

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

`create*` functions reject on failure (imperative control). Errors include `UnavailableError`, `ActivationRequiredError`, and `ContextFullError`.

See the [full API reference](./api-reference.md) and the [project README](../README.md).
