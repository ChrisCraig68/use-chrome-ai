# @use-chrome-ai/vue

Vue composables for the browsers' built-in AI APIs, as shipped in
[Chrome](https://developer.chrome.com/docs/ai/built-in) and
[Edge](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/prompt-api).
The package depends on and re-exports [`use-chrome-ai`](./core.md), so you can use the
chat composable and the core factories from one import path.

```bash
npm i @use-chrome-ai/vue
```

`vue` is a peer dependency (`>=3`).

For browser setup, API status, and model behavior, use Chrome's
[Get started](https://developer.chrome.com/docs/ai/get-started),
[API status](https://developer.chrome.com/docs/ai/built-in-apis), and
[model download](https://developer.chrome.com/docs/ai/inform-users-of-model-download)
docs, or Edge's
[built-in AI docs](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/prompt-api).

## Chat

```vue
<script setup lang="ts">
import { useChat } from "@use-chrome-ai/vue";
import { ref } from "vue";

const input = ref("");
const { messages, isStreaming, model, send, stop } = useChat({
  system: "You are a helpful assistant.",
});

function onSubmit() {
  const text = input.value;
  input.value = "";
  void send(text);
}
</script>

<template>
  <p v-if="model.isUnavailable">Built-in AI is not available here.</p>

  <button v-else-if="model.availability === 'downloadable'" type="button" @click="model.download()">
    Enable on-device AI
  </button>

  <progress v-else-if="model.isDownloading" :value="model.progress" max="1" />

  <form v-else @submit.prevent="onSubmit">
    <p v-for="(message, index) in messages" :key="index">
      <b>{{ message.role }}:</b> {{ message.content }}
    </p>
    <input v-model="input" :disabled="isStreaming" />
    <button type="submit" :disabled="isStreaming">Send</button>
    <button v-if="isStreaming" type="button" @click="stop">Stop</button>
  </form>
</template>
```

`send()` streams the reply into `messages` and never rejects. Read `error` for failures and
call `stop()` to abort.

## Model Status

`useChat` returns `model`, a computed ref with availability, progress, readiness booleans,
and `download()`:

```ts
model.value.availability; // "unavailable" | "downloadable" | "downloading" | "available"
model.value.isReady;
model.value.download(); // wire this to your download button
```

In templates, Vue unwraps the ref, so `model.isReady` works as shown above.

Building a browser extension whose UI drives a session in an
[offscreen document](https://developer.chrome.com/docs/extensions/reference/api/offscreen)?
A click's activation doesn't cross the message boundary, so call
`model.value.download({ requireGesture: false })` once you've verified the gesture on the UI
side. See the [core quick start](./core.md#download-and-status) for the full rationale.

## Core Controllers

This adapter currently ships `useChat` and `useModelStatus`. The rest of the APIs are
available through the re-exported core.

```ts
import { createSummarizer, useModelStatus } from "@use-chrome-ai/vue";

const summarizer = createSummarizer({ type: "key-points", length: "short" });
const status = useModelStatus(summarizer);

const summary = await summarizer.run({ text: article });
```

Use `status.value.availability` to show a download button, progress, or fallback for any
core controller. `useModelStatus` takes any `Store`, so a
[remote controller](./core.md#remote-controllers) — one living in another context, such as
an extension's offscreen document — binds the same way:

```ts
import { connectController, useModelStatus } from "@use-chrome-ai/vue";

const summarizer = connectController("summarizer", transport);
const status = useModelStatus(summarizer);
```

Edge's equivalents are linked from the [core doc](./core.md#browser-docs);
Chrome's API pages cover the underlying browser behavior:
[Prompt](https://developer.chrome.com/docs/ai/prompt-api),
[Summarizer](https://developer.chrome.com/docs/ai/summarizer-api),
[Writer](https://developer.chrome.com/docs/ai/writer-api),
[Rewriter](https://developer.chrome.com/docs/ai/rewriter-api),
[Proofreader](https://developer.chrome.com/docs/ai/proofreader-api),
[Translator](https://developer.chrome.com/docs/ai/translator-api), and
[Language Detector](https://developer.chrome.com/docs/ai/language-detection).

## Signatures

```ts
useChat(options?: ChatOptions): {
  model: ComputedRef<ModelStatus>;
  messages: Ref<{ role: "user" | "assistant"; content: string }[]>;
  isStreaming: Ref<boolean>;
  error: ComputedRef<Error | null>;
  send(text: string): Promise<void>;
  stop(): void;
  reset(): void;
};

useModelStatus<S>(store: Store<S>): Readonly<Ref<S>>;
```

`ChatOptions`, `ModelStatus`, `ControllerState`, and core factory signatures are in the
[core reference](./core.md#reference). Back to the [project README](../README.md).
