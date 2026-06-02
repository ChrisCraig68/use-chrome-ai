# Recipes

Copy-paste snippets for common tasks. All run on-device. See the
[API reference](./api-reference.md) for full signatures.

## A streaming chatbot (React)

```tsx
import { useChat } from "@use-chrome-ai/react";

function Chat() {
  const { messages, input, setInput, send, stop, isStreaming, isUnavailable } =
    useChat({ system: "You are a helpful assistant." });

  if (isUnavailable) return <p>Built-in AI isn't available here.</p>;
  return (
    <>
      {messages.map((m, i) => <p key={i}><b>{m.role}:</b> {m.content}</p>)}
      <form onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} disabled={isStreaming} />
        <button type="submit">Send</button>
        {isStreaming && <button type="button" onClick={stop}>Stop</button>}
      </form>
    </>
  );
}
```

## Gating the model download behind a click

The first use downloads a multi-GB model; Chrome only starts it from a user gesture.

```tsx
const { availability, isDownloading, downloadProgress, download } = useSummarizer();

if (availability === "downloadable")
  return <button onClick={() => download()}>Enable on-device AI</button>;
if (isDownloading)
  return <progress value={downloadProgress} max={1} />;
```

## One-shot prompt

```tsx
const { prompt, result, isStreaming } = usePrompt({ system: "Answer in one sentence." });
<button onClick={() => prompt("Why is the sky blue?")}>Ask</button>
<p>{result}</p>
```

## Structured / JSON output (core)

The hooks stream text; for grammar-constrained output use the core factory directly.

```ts
import { createLanguageModel } from "use-chrome-ai";

const lm = createLanguageModel();
const json = await lm.prompt("List 3 fruits.", {
  responseConstraint: { type: "array", items: { type: "string" } },
});
JSON.parse(json); // ["apple", "banana", "cherry"]
```

## Summarize, write, rewrite

```tsx
const { summarize, result } = useSummarizer({ type: "key-points", length: "short" });
await summarize(longArticle);

const { write } = useWriter({ tone: "formal", length: "medium" });
await write("a thank-you note for a job interview");

const { rewrite } = useRewriter({ tone: "more-casual" });  // tone change re-opens the session
await rewrite("We regret to inform you that…");
```

## Translate

```tsx
const { translate, result } = useTranslator({ sourceLanguage: "en", targetLanguage: "es" });
await translate("Good morning, how are you?");
```

## Proofread (request/response)

```tsx
const { proofread } = useProofreader();
const r = await proofread("i has a apple");
// r.correctedInput, r.corrections[] → { startIndex, endIndex, correction, types? }
```

## Detect language

```tsx
const { detect } = useLanguageDetector();
const [top] = (await detect("bonjour le monde")) ?? [];
// top.detectedLanguage === "fr", top.confidence
```

## No framework (vanilla / Chrome extension)

The core works in a plain page or any extension document (side panel, content script,
offscreen). It never imports `chrome.*`.

```ts
import { createChat, isSupported } from "use-chrome-ai";

if (isSupported()) {
  const chat = createChat({ system: "You are a helpful assistant." });
  for await (const delta of chat.send("Hello!")) {
    output.textContent += delta;
  }
}
```

## Vue

```vue
<script setup lang="ts">
import { useChat } from "@use-chrome-ai/vue";
import { ref } from "vue";
const { messages, isStreaming, send } = useChat({ system: "You are helpful." });
const input = ref("");
</script>

<template>
  <div v-for="(m, i) in messages" :key="i"><b>{{ m.role }}:</b> {{ m.content }}</div>
  <form @submit.prevent="send(input); input = ''">
    <input v-model="input" :disabled="isStreaming" />
  </form>
</template>
```

## Custom model status UI

Subscribe to any controller's status without a framework:

```ts
import { createSummarizer } from "use-chrome-ai";

const s = createSummarizer();
const unsubscribe = s.subscribe(() => {
  const { availability, phase, downloadProgress } = s.getSnapshot();
  // drive your own progress UI
});
```

## Handling errors

Hooks never reject — read `error`. The chat surfaces `ContextFullError` when the conversation
exceeds the model's context window; call `reset()` to recover.

```tsx
const { error, reset } = useChat();
{error?.name === "ContextFullError" && <button onClick={reset}>Start over</button>}
```
