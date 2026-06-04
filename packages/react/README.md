# @use-chrome-ai/react

React hooks for [Chrome's built-in AI](https://developer.chrome.com/docs/ai/built-in). Built on and re-exports the
[`use-chrome-ai`](https://www.npmjs.com/package/use-chrome-ai) core.

```bash
npm i @use-chrome-ai/react
```

```tsx
import { useChat } from "@use-chrome-ai/react";

function Chat() {
  const { messages, input, setInput, send, isStreaming, model } = useChat();

  if (model.isUnavailable) return <p>Built-in AI is not available here.</p>;
  if (model.availability === "downloadable") {
    return <button onClick={() => model.download()}>Enable on-device AI</button>;
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      {messages.map((message, index) => (
        <p key={index}>{message.content}</p>
      ))}
      <input value={input} onChange={(event) => setInput(event.target.value)} />
      <button disabled={isStreaming}>Send</button>
    </form>
  );
}
```

Full docs: [React quick start](https://github.com/ChrisCraig68/use-chrome-ai/blob/main/docs/react.md),
[project README](https://github.com/ChrisCraig68/use-chrome-ai#readme), and Chrome's
[Get started](https://developer.chrome.com/docs/ai/get-started) guide.
