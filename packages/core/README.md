# use-chrome-ai

Framework-agnostic primitives for [Chrome's built-in AI](https://developer.chrome.com/docs/ai/built-in). Use Gemini Nano in the browser with zero dependencies, no API keys, no server round trip, and no bundled UI.

> **Live demos:** [React examples](https://chriscraig68.github.io/use-chrome-ai/) and [Vue chat](https://chriscraig68.github.io/use-chrome-ai/vue/) show the same core running through framework adapters.

## Install

```bash
npm i use-chrome-ai
```

## Quick Chat Controller

Use the core package when you are building vanilla JavaScript, another framework adapter, or shared AI logic that should not depend on React or Vue.

```ts
import { createChat } from "use-chrome-ai";

const chat = createChat({
  system: "You are a concise, friendly assistant.",
});

const status = chat.getSnapshot();

if (status.availability === "downloadable") {
  downloadButton.onclick = () => void chat.download();
}

sendButton.onclick = async () => {
  for await (const delta of chat.send(input.value)) {
    output.textContent += delta;
  }
};
```

The core handles availability checks, explicit model downloads, streaming, aborts, context-full errors, and session invalidation when Chrome evicts a model handle.

## Packages

For framework apps, start with the adapter:

- [`@use-chrome-ai/react`](https://www.npmjs.com/package/@use-chrome-ai/react) for React hooks
- [`@use-chrome-ai/vue`](https://www.npmjs.com/package/@use-chrome-ai/vue) for Vue composables

Both adapters re-export this core package, so app code can import hooks/composables and lower-level controllers from one place.

## Links

- [Core quick start and signatures](https://github.com/ChrisCraig68/use-chrome-ai/blob/main/docs/core.md)
- [Blog post: hooks for Chrome built-in AI](https://chriscraig.dev/blog/use-chrome-ai-hooks-for-built-in-ai)
- [Project README](https://github.com/ChrisCraig68/use-chrome-ai#readme)
- [Chrome built-in AI setup](https://developer.chrome.com/docs/ai/get-started)
- [Chrome built-in API status](https://developer.chrome.com/docs/ai/built-in-apis)
