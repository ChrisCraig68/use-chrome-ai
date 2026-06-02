// Framework-free usage — the same core that powers the React hooks. Works in a plain
// web page or inside a Chrome extension document (side panel, content script, offscreen).
// (Reference only — not part of the build.)
import {
  createChat,
  createSummarizer,
  createTranslator,
  isSupported,
} from "use-chrome-ai";

if (!isSupported()) {
  console.warn("Built-in AI not available here.");
}

// --- Streaming chat ---
const chat = createChat({ system: "You are a helpful assistant." });

async function ask(text: string): Promise<void> {
  // Call this from a click handler so the first run can download the model.
  for await (const delta of chat.send(text)) {
    process.stdout.write(delta); // or append to the DOM
  }
}

// --- One-shot summarize ---
async function summarize(article: string): Promise<string> {
  const summarizer = createSummarizer({ type: "key-points", length: "short" });
  return summarizer.run({ text: article });
}

// --- Translate, streaming ---
async function translate(text: string): Promise<void> {
  const translator = createTranslator({ sourceLanguage: "en", targetLanguage: "fr" });
  for await (const delta of translator.stream({ text })) {
    process.stdout.write(delta);
  }
}

// --- Subscribe to model/download status (drive a custom progress UI) ---
const summarizer = createSummarizer();
const unsubscribe = summarizer.subscribe(() => {
  const s = summarizer.getSnapshot();
  console.log(s.availability, s.phase, s.downloadProgress);
});
// later: unsubscribe();

export { ask, summarize, translate, unsubscribe };
