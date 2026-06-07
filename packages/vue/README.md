# @use-chrome-ai/vue

Vue composables for [Chrome's built-in AI](https://developer.chrome.com/docs/ai/built-in). Add streaming, on-device Gemini Nano features to Vue 3 apps without API keys, backend proxying, or bundled UI components.

> **Live demo:** [Vue chat demo](https://chriscraig68.github.io/use-chrome-ai/vue/). It uses the same core as the React examples and runs in desktop Chrome with built-in AI enabled.

## Why Install It

`@use-chrome-ai/vue` gives Vue apps a small, headless bridge to Chrome built-in AI:

- One composable gives you a complete streaming chat loop.
- Model availability, download progress, aborts, and errors are exposed as Vue refs.
- You keep control over markup, styling, and product UX.
- The framework-agnostic `use-chrome-ai` core is re-exported for prompt, summarizer, writer, rewriter, translator, proofreader, and language detector controllers.

## Install

```bash
npm i @use-chrome-ai/vue
```

`vue` is a peer dependency (`>=3`).

## One-Composable Chat

This is the shortest path from a Vue component to an on-device AI chat. `useChat()` streams assistant replies into `messages`, tracks whether the model is ready, and gives you the exact button state needed for Chrome's explicit model download flow.

```vue
<script setup lang="ts">
import { useChat } from "@use-chrome-ai/vue";
import { ref } from "vue";

const input = ref("");
const { messages, isStreaming, error, model, send, stop } = useChat({
  system: "You are a concise, friendly assistant.",
});

function onSubmit() {
  const text = input.value;
  input.value = "";
  void send(text);
}
</script>

<template>
  <p v-if="model.isUnavailable">Built-in AI is not available in this browser.</p>

  <button
    v-else-if="!model.isChecking && model.availability === 'downloadable'"
    type="button"
    @click="model.download()"
  >
    Enable on-device AI
  </button>

  <progress v-else-if="model.isDownloading" :value="model.progress" max="1" />

  <form v-else @submit.prevent="onSubmit">
    <p v-for="(message, index) in messages" :key="index">
      <strong>{{ message.role }}:</strong> {{ message.content }}
    </p>

    <input v-model="input" :disabled="isStreaming || !model.isReady" />

    <button v-if="isStreaming" type="button" @click="stop">Stop</button>
    <button v-else type="submit" :disabled="!input.trim() || !model.isReady">
      Send
    </button>

    <p v-if="error" role="alert">{{ error.message }}</p>
  </form>
</template>
```

For the fuller styled version, see the [Vue demo source](https://github.com/ChrisCraig68/use-chrome-ai/blob/main/examples/vue/src/App.vue).

## What You Get

The Vue adapter currently ships:

| Composable | Use it for |
| --- | --- |
| `useChat()` | Multi-turn streaming chat with Vue refs |
| `useModelStatus()` | Binding any core controller to Vue reactivity |

The rest of Chrome's built-in AI APIs are available through the re-exported core:

```ts
import { createSummarizer, useModelStatus } from "@use-chrome-ai/vue";

const summarizer = createSummarizer({ type: "key-points", length: "short" });
const status = useModelStatus(summarizer);
const summary = await summarizer.run({ text: article });
```

Use `status.value.availability` to show unavailable, downloadable, downloading, and ready states for any core controller.

## Links

- [Vue quick start and signatures](https://github.com/ChrisCraig68/use-chrome-ai/blob/main/docs/vue.md)
- [Blog post: hooks for Chrome built-in AI](https://chriscraig.dev/blog/use-chrome-ai-hooks-for-built-in-ai)
- [Project README](https://github.com/ChrisCraig68/use-chrome-ai#readme)
- [Chrome built-in AI setup](https://developer.chrome.com/docs/ai/get-started)
- [Chrome model download UX guide](https://developer.chrome.com/docs/ai/inform-users-of-model-download)
