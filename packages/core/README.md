# use-chrome-ai

Framework-agnostic core for [Chrome's built-in AI](https://developer.chrome.com/docs/ai/built-in) (Gemini Nano). Zero dependencies — drop it into any web page or framework. Handles availability gating, model-download progress, streaming, abort, and eviction recovery; you build the UI.

```bash
npm i use-chrome-ai
```

```ts
import { createChat, isSupported } from "use-chrome-ai";

if (isSupported()) {
  const chat = createChat({ system: "You are a helpful assistant." });
  // Download the model once from a click (Chrome needs a gesture); send() never auto-downloads.
  await chat.download();
  for await (const delta of chat.send("Hello!")) {
    output.textContent += delta; // stream deltas into the DOM
  }
}
```

**→ Full quick start + API reference: [docs/core.md](https://github.com/ChrisCraig68/use-chrome-ai/blob/main/docs/core.md)** · [project README](https://github.com/ChrisCraig68/use-chrome-ai#readme)
