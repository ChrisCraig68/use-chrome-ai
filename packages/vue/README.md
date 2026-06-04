# @use-chrome-ai/vue

Vue composables for [Chrome's built-in AI](https://developer.chrome.com/docs/ai/built-in). Built on and re-exports the
[`use-chrome-ai`](https://www.npmjs.com/package/use-chrome-ai) core.

```bash
npm i @use-chrome-ai/vue
```

```ts
import { useChat } from "@use-chrome-ai/vue";

const { messages, isStreaming, model, send } = useChat();

model.value.availability; // "unavailable" | "downloadable" | "downloading" | "available"
```

Full docs: [Vue quick start](https://github.com/ChrisCraig68/use-chrome-ai/blob/main/docs/vue.md),
[project README](https://github.com/ChrisCraig68/use-chrome-ai#readme), and Chrome's
[Get started](https://developer.chrome.com/docs/ai/get-started) guide.
