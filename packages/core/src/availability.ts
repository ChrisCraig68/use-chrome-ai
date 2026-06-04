import type { Availability } from "./types";

/** Maps the spec's availability strings (current + legacy) to our union. */
export function normalizeAvailability(raw: string): Availability {
  switch (raw) {
    case "available":
    case "readily":
      return "available";
    case "downloadable":
    case "after-download":
      return "downloadable";
    case "downloading":
      return "downloading";
    // "unavailable" (current), "no" (legacy), and anything unknown:
    default:
      return "unavailable";
  }
}

/** Every Chrome built-in AI API, by the lowercase name we use in our public API. */
export type ChromeAiApi =
  | "languageModel"
  | "summarizer"
  | "writer"
  | "rewriter"
  | "proofreader"
  | "translator"
  | "languageDetector";

/** The global class name each API is exposed under. */
export const GLOBAL_NAME: Record<ChromeAiApi, string> = {
  languageModel: "LanguageModel",
  summarizer: "Summarizer",
  writer: "Writer",
  rewriter: "Rewriter",
  proofreader: "Proofreader",
  translator: "Translator",
  languageDetector: "LanguageDetector",
};

/** Read a global lazily. Never read AI globals at module top level — typings/timing
 *  drift would break tree-shaking and SSR. Always go through here, inside a call. */
export function getGlobal<T = unknown>(name: string): T | undefined {
  return (globalThis as Record<string, unknown>)[name] as T | undefined;
}

/** True if a specific API's global class exists in this environment. */
export function isApiSupported(api: ChromeAiApi): boolean {
  return getGlobal(GLOBAL_NAME[api]) !== undefined;
}

/** True if ANY built-in AI global exists. Cheap, synchronous capability check — use it
 *  to decide whether to render AI features at all before doing the async `availability()`
 *  round-trip. */
export function isSupported(): boolean {
  return (Object.values(GLOBAL_NAME) as string[]).some((name) => getGlobal(name) !== undefined);
}
