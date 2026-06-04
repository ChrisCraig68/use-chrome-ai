# @use-chrome-ai/vue

Vue composables for [Chrome's built-in AI](https://developer.chrome.com/docs/ai/built-in) (Gemini Nano). On-device, streaming, with availability gating and model-download progress handled for you. Built on the framework-agnostic [`use-chrome-ai`](./core.md) core, which it re-exports.

```bash
npm i @use-chrome-ai/vue   # pulls in use-chrome-ai automatically
```

`vue` is a peer dependency (>=3).

> Built-in AI is desktop Chrome only and partly behind flags/origin trials — see [Get started with built-in AI](https://developer.chrome.com/docs/ai/get-started). Check `model.isUnavailable` and render a fallback when it's missing.

## A streaming chatbot

```vue
<script setup lang="ts">
import { useChat } from "@use-chrome-ai/vue";
import { ref } from "vue";

const { messages, isStreaming, model, send, stop, reset } = useChat({
  system: "You are a helpful assistant.",
});

const input = ref("");

function onSubmit() {
  const text = input.value;
  input.value = "";
  void send(text); // streams the reply into `messages`
}
</script>

<template>
  <p v-if="model.isUnavailable">Built-in AI isn't available in this browser.</p>
  <template v-else>
    <!-- Download once, on an explicit click — a normal send() never auto-downloads. -->
    <button v-if="model.availability === 'downloadable'" type="button" @click="model.download()">
      Enable on-device AI
    </button>
    <progress v-else-if="model.isDownloading" :value="model.progress" max="1" />
    <div v-for="(m, i) in messages" :key="i"><b>{{ m.role }}:</b> {{ m.content }}</div>
    <form @submit.prevent="onSubmit">
      <input v-model="input" :disabled="isStreaming || !model.isReady" />
      <button v-if="isStreaming" type="button" @click="stop">Stop</button>
      <button v-else type="submit" :disabled="!model.isReady">Send</button>
    </form>
  </template>
</template>
```

`useChat` returns `model` (a computed `ModelStatus` ref), `messages`, `isStreaming`, `error`, plus `send(text)`, `stop()`, and `reset()`. `send` never rejects — read `error`. Call `model.download()` from a click to download the model; a normal `send` never does.

## Model status for any controller

`useModelStatus` binds any core controller's status to a Vue ref — the same `subscribe`/`getSnapshot` store the React hooks use:

```ts
import { createSummarizer } from "@use-chrome-ai/vue"; // core re-exported
import { useModelStatus } from "@use-chrome-ai/vue";

const summarizer = createSummarizer({ type: "key-points" });
const status = useModelStatus(summarizer); // Ref<ControllerState>
const summary = await summarizer.run({ text: article });
```

## Signatures

```ts
useChat(options?: ChatOptions): {
  model: ComputedRef<ModelStatus>;   // availability, progress, isReady, isDownloading, download()
  messages: Ref<{ role: "user" | "assistant"; content: string }[]>;
  isStreaming: Ref<boolean>;
  error: Ref<Error | null>;
  send(text: string): Promise<void>;
  stop(): void;
  reset(): void;
}

useModelStatus<S>(store: Store<S>): Readonly<Ref<S>>;   // bind any controller to a Vue ref
```

`ChatOptions`, `ControllerState`, and `ModelStatus` are defined in the [core reference](./core.md#api-reference).

## Beyond chat

This adapter ships `useChat` + `useModelStatus`. The full core is re-exported, so the other six APIs are available as factories (`createSummarizer`, `createTranslator`, …) bound with `useModelStatus`. See the [core quick start](./core.md) for their shapes and signatures, and the [project README](../README.md).
