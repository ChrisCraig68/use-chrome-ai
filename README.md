# use-chrome-ai

Headless primitives for the browsers' built-in AI APIs — the standardized Prompt,
Summarizer, Writer, Rewriter, Translator, Language Detector, and Proofreader APIs shipped
by [Chrome](https://developer.chrome.com/docs/ai/built-in) and
[Edge](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/prompt-api). It runs
in the browser, needs no API key, and ships no UI.

Use the framework-agnostic core, or the React/Vue adapters built on top of it. This
library handles the wrapper work: availability state, download progress, streaming,
aborts, and session recovery. For browser setup, API status, and model behavior, use the
vendor docs linked below.

**Microsoft Edge is now supported alongside Chrome.** The library targets the
standardized globals (`LanguageModel`, `Summarizer`, …) from the
[Web Machine Learning CG specs](https://github.com/webmachinelearning), not any one
browser — a future browser that ships the same globals works without changes here.
Despite the package name, nothing in it is Chrome-specific.

> **▶ Live demos** — [React: Smart Tooltip · Chat · Summarizer](https://chriscraig68.github.io/use-chrome-ai/)
> and the [Vue chat](https://chriscraig68.github.io/use-chrome-ai/vue/). They run entirely
> on-device — open in a desktop browser with built-in AI enabled (Chrome or Edge).

## Motivation

I started this while experimenting with Chrome's built-in AI and wanting the native APIs
wrapped in something easy to reuse. The same APIs have since shipped in Edge, so the
library now targets the shared standard rather than one browser.

It is useful for prototyping LLM features in your app without picking a vendor, signing
up for an API key, or adopting a complex AI framework. The local model's small context
window limits some use cases, but it is surprisingly capable at simple tasks.

```bash
npm i use-chrome-ai
npm i @use-chrome-ai/react
npm i @use-chrome-ai/vue
```

| Package | Use it for | Docs |
| --- | --- | --- |
| [`use-chrome-ai`](packages/core/README.md) | Vanilla JS, shared core, or another framework | [Core quick start](docs/core.md) |
| [`@use-chrome-ai/react`](packages/react/README.md) | React hooks | [React quick start](docs/react.md) |
| [`@use-chrome-ai/vue`](packages/vue/README.md) | Vue composables | [Vue quick start](docs/vue.md) |

Adapters re-export the core, so a React app can import both `useChat` and
`createSummarizer` from `@use-chrome-ai/react`, and a Vue app can do the same from
`@use-chrome-ai/vue`.

## Quick Example - Chat Bot With One Hook

```tsx
import { useChat } from "@use-chrome-ai/react";

export function Chat() {
  const { messages, input, setInput, send, stop, isStreaming, model } = useChat();

  if (model.isUnavailable) return <p>Built-in AI is not available here.</p>;
  if (model.availability === "downloadable") {
    return <button onClick={() => model.download()}>Enable on-device AI</button>;
  }
  if (model.isDownloading) return <progress value={model.progress} max={1} />;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      {messages.map((message, index) => (
        <p key={index}>
          <b>{message.role}:</b> {message.content}
        </p>
      ))}
      <input value={input} onChange={(event) => setInput(event.target.value)} />
      <button type="submit" disabled={isStreaming}>
        Send
      </button>
      {isStreaming && (
        <button type="button" onClick={stop}>
          Stop
        </button>
      )}
    </form>
  );
}
```

## Browser Support

The browsers own the platform details; this repo keeps the wrapper API focused. Status
as of mid-2026 (it changes quickly — check the vendor docs):

| API | Chrome | Edge |
| --- | --- | --- |
| Prompt / LanguageModel | Stable 148+ (extensions 138+) | Canary/Dev, behind a flag |
| Summarizer | Stable 138+ | Stable 138+, on by default |
| Writer / Rewriter | Origin trial | Canary/Dev, behind flags |
| Proofreader | Origin trial | 142+ Canary/Dev, behind a flag |
| Translator | Stable 138+ | Stable 148+ |
| Language Detector | Stable 138+ | Stable 148+ |

Prompt, Summarizer, Writer, Rewriter, and Proofreader run on the browser's built-in
language model — Gemini Nano in Chrome, Phi-4-mini in Edge (with Aion-1.0-Instruct in
preview). Translator and Language Detector use separate task-specific models.

Firefox and Safari have not shipped these APIs (both have raised standards objections);
Brave disables the model download that backs them.

- Chrome: [built-in AI overview](https://developer.chrome.com/docs/ai/built-in) ·
  [API status](https://developer.chrome.com/docs/ai/built-in-apis) ·
  [get started](https://developer.chrome.com/docs/ai/get-started) ·
  [model download UX](https://developer.chrome.com/docs/ai/inform-users-of-model-download) ·
  [model management](https://developer.chrome.com/docs/ai/understand-built-in-model-management)
- Edge: [Prompt API](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/prompt-api) ·
  [Writing Assistance APIs](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/writing-assistance-apis) ·
  [Translator](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/translator-api) ·
  [Language Detector](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/languagedetector-api) ·
  [Proofreader](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/proofreader-api)

In this library, gate UI with `model.isUnavailable`, show a download button when
`model.availability === "downloadable"`, and call `model.download()` from that button.
Feature-detect with `isSupported()` / `isApiSupported()` — never by browser name. If you
need to show browser-specific setup instructions, `detectBrowser()` identifies the host
browser (`"chrome" | "edge" | "chromium" | "unknown"`).

## Browser Extensions (Offscreen Documents)

In a Manifest V3 extension the built-in AI globals aren't exposed to the service worker,
so the common pattern is to own the session in an
[offscreen document](https://developer.chrome.com/docs/extensions/reference/api/offscreen).
A user activation from a popup, side panel, or options-page click does **not** propagate to
that document, so `navigator.userActivation.isActive` is `false` there and `download()`
throws `ActivationRequiredError` — even though the browser itself would start the download.

When you've already gated the trigger on a real gesture on the UI side of the message
boundary, opt out of the local check with `requireGesture: false`:

```ts
// offscreen.ts — owns the controller
import { createChat } from "use-chrome-ai";

const chat = createChat();

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "download-model") {
    // The popup verified the click before posting this message.
    void chat.download({ requireGesture: false });
  }
});
```

Use it only for that cross-document case — it bypasses this library's local gesture check,
not the browser's own download policy. It applies to explicit `download()` only: `warm()`
and the normal `run` / `stream` / `send` / `prompt` paths never download regardless. React
and Vue UIs pass the same option through `model.download({ requireGesture: false })`.

## APIs

| API | Core | React | Vue |
| --- | --- | --- | --- |
| [LanguageModel / Prompt](https://developer.chrome.com/docs/ai/prompt-api) | `createChat`, `createLanguageModel` | `useChat`, `usePrompt` | `useChat` |
| [Summarizer](https://developer.chrome.com/docs/ai/summarizer-api) | `createSummarizer` | `useSummarizer` | Core re-export |
| [Writer](https://developer.chrome.com/docs/ai/writer-api) | `createWriter` | `useWriter` | Core re-export |
| [Rewriter](https://developer.chrome.com/docs/ai/rewriter-api) | `createRewriter` | `useRewriter` | Core re-export |
| [Proofreader](https://developer.chrome.com/docs/ai/proofreader-api) | `createProofreader` | `useProofreader` | Core re-export |
| [Translator](https://developer.chrome.com/docs/ai/translator-api) | `createTranslator` | `useTranslator` | Core re-export |
| [Language Detector](https://developer.chrome.com/docs/ai/language-detection) | `createLanguageDetector` | `useLanguageDetector` | Core re-export |

## Demos

```bash
pnpm install
pnpm dev:react
pnpm dev:vue
```

React runs at <http://localhost:5173>; Vue runs at <http://localhost:5174>. See Chrome's
[Get started](https://developer.chrome.com/docs/ai/get-started) guide or Edge's
[Prompt API docs](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/prompt-api)
for the browser setup needed to exercise the real model path.

## License

MIT
