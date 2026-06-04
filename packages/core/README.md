# use-chrome-ai

Framework-agnostic primitives for [Chrome's built-in AI](https://developer.chrome.com/docs/ai/built-in).
Zero dependencies, no UI, no API keys.

```bash
npm i use-chrome-ai
```

```ts
import { createChat } from "use-chrome-ai";

const chat = createChat();

downloadButton.onclick = () => {
  void chat.download();
};

sendButton.onclick = async () => {
  for await (const delta of chat.send(input.value)) {
    output.textContent += delta;
  }
};
```

Full docs: [core quick start](https://github.com/ChrisCraig68/use-chrome-ai/blob/main/docs/core.md),
[project README](https://github.com/ChrisCraig68/use-chrome-ai#readme), and Chrome's
[Get started](https://developer.chrome.com/docs/ai/get-started) guide.
