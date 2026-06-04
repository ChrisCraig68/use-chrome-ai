# @use-chrome-ai/react

React hooks for [Chrome's built-in AI](https://developer.chrome.com/docs/ai/built-in) (Gemini Nano). On-device and streaming, with availability gating and model-download progress handled for you. Built on (and re-exports) the [`use-chrome-ai`](https://www.npmjs.com/package/use-chrome-ai) core.

```bash
npm i @use-chrome-ai/react   # pulls in use-chrome-ai automatically
```

```tsx
import { useChat } from "@use-chrome-ai/react";

function Chat() {
  const { messages, input, setInput, send, isStreaming, model } =
    useChat({ system: "You are a helpful assistant." });

  if (model.isUnavailable) return <p>Built-in AI isn't available here.</p>;
  if (model.availability === "downloadable")
    return <button onClick={() => model.download()}>Enable on-device AI</button>;

  return (
    <form onSubmit={(e) => { e.preventDefault(); send(); }}>
      {messages.map((m, i) => <p key={i}><b>{m.role}:</b> {m.content}</p>)}
      <input value={input} onChange={(e) => setInput(e.target.value)} disabled={isStreaming || !model.isReady} />
    </form>
  );
}
```

**→ Full quick start + hook signatures: [docs/react.md](https://github.com/ChrisCraig68/use-chrome-ai/blob/main/docs/react.md)** · [project README](https://github.com/ChrisCraig68/use-chrome-ai#readme)
