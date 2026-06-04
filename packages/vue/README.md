# @use-chrome-ai/vue

Vue composables for [Chrome's built-in AI](https://developer.chrome.com/docs/ai/built-in) (Gemini Nano). On-device, streaming, with availability gating and model-download progress handled for you. Built on the framework-agnostic [`use-chrome-ai`](../core/README.md) core, which it re-exports.

```bash
npm i @use-chrome-ai/vue   # pulls in use-chrome-ai automatically
```

`vue` is a peer dependency (>=3).

> Built-in AI is desktop Chrome/Edge only and partly behind flags/origin trials — see [Get started with built-in AI](https://developer.chrome.com/docs/ai/get-started). Check `status.supported` / `status.availability` and render a fallback when it's missing.

## A streaming chatbot

```vue
<script setup lang="ts">
import { useChat } from "@use-chrome-ai/vue";
import { computed, ref } from "vue";

const { messages, isStreaming, status, send, stop, reset } = useChat({
  system: "You are a helpful assistant.",
});

const input = ref("");
const unavailable = computed(
  () => !status.value.supported || status.value.availability === "unavailable",
);

function onSubmit() {
  const text = input.value;
  input.value = "";
  void send(text); // streams the reply into `messages`
}
</script>

<template>
  <p v-if="unavailable">Built-in AI isn't available in this browser.</p>
  <template v-else>
    <progress v-if="status.availability === 'downloading'" :value="status.downloadProgress" max="1" />
    <div v-for="(m, i) in messages" :key="i"><b>{{ m.role }}:</b> {{ m.content }}</div>
    <form @submit.prevent="onSubmit">
      <input v-model="input" :disabled="isStreaming" />
      <button v-if="isStreaming" type="button" @click="stop">Stop</button>
      <button v-else type="submit">Send</button>
    </form>
  </template>
</template>
```

`useChat` returns refs: `status`, `messages`, `isStreaming`, `error`, plus `send(text)`, `stop()`, and `reset()`. `send` never rejects — read `error`. The first `send` from a click downloads the model.

## Model status for any controller

`useModelStatus` binds any core controller's status to a Vue ref — the same `subscribe`/`getSnapshot` store the React hooks use:

```ts
import { createSummarizer } from "@use-chrome-ai/vue"; // core re-exported
import { useModelStatus } from "@use-chrome-ai/vue";

const summarizer = createSummarizer({ type: "key-points" });
const status = useModelStatus(summarizer); // Ref<ControllerState>
const summary = await summarizer.run({ text: article });
```

## Beyond chat

This adapter ships `useChat` + `useModelStatus`. The full core is re-exported, so the other six APIs are available as factories (`createSummarizer`, `createTranslator`, …) bound with `useModelStatus`. See the [core quick start](../core/README.md) for their shapes, the [API reference](../../docs/api-reference.md) for full signatures, and the [project README](../../README.md).
