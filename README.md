# use-chrome-ai

Headless, framework-agnostic primitives + React hooks for **Chrome's built-in AI** (Gemini Nano, and Edge's Phi-4-mini). No API keys, no server, nothing leaves the device. Logic only — **you build the UI**.

- **Zero-dependency core** small enough to drop inside a Chrome extension (~4.9 KB gzipped for all seven APIs; tree-shakes to ~1.9 KB for one).
- **All seven APIs**: Prompt / LanguageModel, Summarizer, Writer, Rewriter, Proofreader, Translator, Language Detector.
- **Streaming, abort, model-download progress, and mid-session eviction recovery** handled for you.
- **React hooks** + a **Vue** adapter; the zero-dep core is plain TS, so Svelte/vanilla sit on top in ~30 lines.

```bash
npm i @use-chrome-ai/react    # React hooks (pulls in the core automatically)
# — or framework-free —
npm i use-chrome-ai           # zero-dep core: vanilla JS, or inside a Chrome extension
# — or Vue —
npm i @use-chrome-ai/vue
```

| Package | For |
| --- | --- |
| `use-chrome-ai` | Framework-agnostic core (vanilla, Chrome extensions). Zero deps. |
| `@use-chrome-ai/react` | React hooks. Depends on + re-exports the core. |
| `@use-chrome-ai/vue` | Vue composables. Depends on + re-exports the core. |

Each adapter re-exports the core, so you can import the hooks and the `create*`/`isSupported` helpers from one place.

> **Heads up:** Chrome's built-in AI is **GA only inside extensions**. In a regular web page it's behind a flag / origin trial, **desktop Chromium only**, and needs **~22 GB free disk + >4 GB VRAM**. Treat it as progressive enhancement — this library never throws on an unsupported browser; it reports an `unavailable` state so you can render a fallback. See [Enabling built-in AI](#enabling-built-in-ai).

---

## A streaming chatbot, in one hook

```tsx
import { useChat } from "@use-chrome-ai/react";

export function Chat() {
  const {
    messages, input, setInput, send, stop,
    isStreaming, isUnavailable, isDownloading, downloadProgress,
  } = useChat({ system: "You are a helpful assistant." });

  if (isUnavailable) return <p>Built-in AI isn't available in this browser.</p>;

  return (
    <div>
      {isDownloading && <progress value={downloadProgress} />}
      {messages.map((m, i) => (
        <p key={i}><b>{m.role}:</b> {m.content}</p>
      ))}
      <form onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} disabled={isStreaming} />
        <button type="submit">Send</button>
        {isStreaming && <button type="button" onClick={stop}>Stop</button>}
      </form>
    </div>
  );
}
```

The first `send()` (from the form submit — a user gesture) downloads the model with progress, then streams the reply token-by-token into `messages`. `stop()` aborts. That's the whole chatbot.

### Same thing, no framework

```ts
import { createChat } from "use-chrome-ai";

const chat = createChat({ system: "You are a helpful assistant." });
button.onclick = async () => {
  for await (const delta of chat.send(input.value)) {
    output.textContent += delta; // stream deltas
  }
};
```

---

## The hooks

Import from `@use-chrome-ai/react`. Every hook returns the shared status surface (`availability`, `downloadProgress`, `isUnavailable`, `isDownloading`, `isReady`, `download()`) plus its own methods.

| Hook | API | What you get |
| --- | --- | --- |
| `useChat(opts?)` | LanguageModel | `messages`, `input`/`setInput`, `send`, `stop`, `reset`, `isStreaming` |
| `usePrompt(opts?)` | LanguageModel | `prompt(text)` → streams into `result`, `stop` |
| `useSummarizer(opts?)` | Summarizer | `summarize(text, { context? })` → `result`, `stop` |
| `useWriter(opts?)` | Writer | `write(prompt, { context? })` → `result`, `stop` |
| `useRewriter(opts?)` | Rewriter | `rewrite(text, { context? })` → `result`, `stop` |
| `useTranslator(pair)` | Translator | `translate(text)` → `result`, `stop` |
| `useProofreader(opts?)` | Proofreader | `proofread(text)` → `result` (corrections), `isPending` |
| `useLanguageDetector(opts?)` | LanguageDetector | `detect(text)` → `result` (ranked), `isPending` |
| `useModelStatus(controller)` | any | low-level: bind to a controller's status |
| `useAiController(make, key)` | any | escape hatch: full controller access |

```tsx
// Summarize
const { summarize, result, isStreaming } = useSummarizer({ type: "key-points", length: "short" });
<button onClick={() => summarize(article)}>Summarize</button>
<pre>{result}</pre>

// Rewrite — tone/length are create-time; changing them transparently re-opens the session
const { rewrite, result } = useRewriter({ tone: "more-casual" });

// Translate (one controller per language pair)
const { translate, result } = useTranslator({ sourceLanguage: "en", targetLanguage: "es" });

// Proofread (request/response — no streaming)
const { proofread, result } = useProofreader();
const r = await proofread("i has bad gramer");
// r.correctedInput, r.corrections[] → { startIndex, endIndex, correction, types? }

// Detect language
const { detect } = useLanguageDetector();
const [top] = (await detect("bonjour le monde")) ?? [];
// top.detectedLanguage === "fr", top.confidence
```

### Structured (JSON) output

For grammar-constrained output, use the core controller via the escape hatch:

```tsx
import { useAiController } from "@use-chrome-ai/react";
import { createLanguageModel } from "use-chrome-ai";

const { controller } = useAiController(() => createLanguageModel(), "lm");
const json = await controller.prompt("List 3 fruits as JSON", {
  responseConstraint: { type: "array", items: { type: "string" } },
});
```

---

## Model download & user activation

The first time an API is used it downloads multi-gigabyte weights. **Chrome only allows that download to start from a user gesture** (click/tap). This library makes that explicit instead of silently hanging:

- If a call needs a download and there's **no active gesture**, it throws `ActivationRequiredError`.
- Render a "Download model" affordance gated on `availability === "downloadable"` and call `download()` from its click handler:

```tsx
const { availability, isDownloading, downloadProgress, download } = useSummarizer();

if (availability === "downloadable")
  return <button onClick={() => download()}>Enable on-device AI</button>;
if (isDownloading) return <progress value={downloadProgress} />;
```

Calling an action straight from a click (like the chatbot's `send` on form submit) already satisfies the gesture requirement, so the common path "just works."

---

## Availability states

`availability` is one of:

| Value | Meaning |
| --- | --- |
| `unavailable` | Not supported here (wrong browser, disabled, or this exact config can't run). Render a fallback. |
| `downloadable` | Supported, but the model must download first (needs a gesture — see above). |
| `downloading` | A download is in progress (possibly started in another tab). |
| `available` | Ready to use immediately. |

`phase` (`idle` / `creating` / `running` / `streaming` / `error`) tells you what *this* controller is doing right now — orthogonal to `availability`.

---

## Inside a Chrome extension

The core touches only the AI globals — it never imports `chrome.*` — so the same bundle runs in a content script, side panel, popup, options page, or offscreen document. Built-in AI is **GA inside extensions** (no flag), and the Prompt API is **main-thread only** (not in a service worker / Web Worker), so call it from a document context (side panel, offscreen doc, content script), not the background service worker.

```ts
// side-panel.ts
import { createChat, isSupported } from "use-chrome-ai";
if (isSupported()) { /* … */ }
```

---

## Enabling built-in AI

In a **web page** (not an extension), each API may need its own setup. Document this for your users:

- **Hardware:** desktop Chrome/Edge (no Android/iOS), ~22 GB free disk, >4 GB VRAM.
- **Flags / origin trial:** the Prompt and Summarizer APIs are stable on Chrome 138+; Writer/Rewriter/Proofreader may still need `chrome://flags` or an origin-trial token (the token is *your* site's responsibility — a library can't ship one).
- **Cross-origin iframes** need the matching permission-policy token on the `allow` attribute — **each API has its own**:

  | API | `allow` token |
  | --- | --- |
  | LanguageModel | `language-model` |
  | Summarizer | `summarizer` |
  | Writer | `writer` |
  | Rewriter | `rewriter` |
  | Proofreader | `proofreader` |
  | Translator | `translator` |
  | Language Detector | `language-detector` |

  e.g. `<iframe allow="language-model; summarizer">`.

See [`docs/enabling-built-in-ai.md`](docs/enabling-built-in-ai.md) for the full setup + a real-Chrome verification checklist.

---

## Server-side rendering

The hooks are SSR-safe: on the server (no AI globals) they report `unavailable` via `getServerSnapshot`, so Next.js/Remix won't crash on hydration — they render your fallback on the server and upgrade on the client.

---

## Core (framework-agnostic) API

Everything the hooks use is exported from `use-chrome-ai`:

```ts
import {
  createChat, createLanguageModel,
  createSummarizer, createWriter, createRewriter,
  createTranslator, createProofreader, createLanguageDetector,
  isSupported, isApiSupported,
  drainStream, isAbortError,
  type Availability, type ControllerState,
} from "use-chrome-ai";
```

Each `create*()` returns a controller with `subscribe` / `getSnapshot` (a `useSyncExternalStore`-shaped store), `refresh()`, `warm()` / `download()`, `invalidate()`, `destroy()`, plus its typed methods. Bind it to any framework in ~30 lines.

---

## Browser support

Built-in AI ships in Chromium-based browsers (Chrome, Edge). Feature detection covers all of them; everywhere else, `isSupported()` is `false` and hooks report `unavailable`. This package never polyfills or calls a remote model — it's strictly an on-device wrapper.

## Documentation

- [API reference](docs/api-reference.md) — every hook, core factory, and type with signatures.
- [Recipes](docs/recipes.md) — copy-paste snippets for the common tasks.
- [Enabling built-in AI](docs/enabling-built-in-ai.md) — flags, hardware, iframe tokens, verify checklist.
- [Design notes](docs/DESIGN.md) — architecture and the framework-agnostic seam.
- [`llms.txt`](llms.txt) — a machine-readable map of the project ([llmstxt.org](https://llmstxt.org)) for AI assistants.
- [AGENTS.md](AGENTS.md) — guidance for coding agents working in this repo.

## License

MIT
