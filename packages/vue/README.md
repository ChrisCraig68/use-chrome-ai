# @use-chrome-ai/vue

Vue composables for [Chrome's built-in AI](https://developer.chrome.com/docs/ai/built-in) (Gemini Nano). On-device and streaming, with availability gating and model-download progress handled for you. Built on (and re-exports) the [`use-chrome-ai`](https://www.npmjs.com/package/use-chrome-ai) core.

```bash
npm i @use-chrome-ai/vue   # pulls in use-chrome-ai automatically
```

```ts
import { useChat } from "@use-chrome-ai/vue";

const { messages, isStreaming, model, send } = useChat({
  system: "You are a helpful assistant.",
});
// model.value.availability → 'unavailable' | 'downloadable' | 'downloading' | 'available'
// model.value.download() — start the model download (from a click)
```

**→ Full quick start + signatures: [docs/vue.md](https://github.com/ChrisCraig68/use-chrome-ai/blob/main/docs/vue.md)** · [project README](https://github.com/ChrisCraig68/use-chrome-ai#readme)
