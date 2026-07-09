import type { TaskController } from "../lifecycle";
import { createTaskController } from "./task";

interface TranslatorSession {
  translate(text: string, opts?: { signal?: AbortSignal }): Promise<string>;
  translateStreaming(text: string, opts?: { signal?: AbortSignal }): ReadableStream<string>;
  destroy?(): void;
}

export interface TranslatorPair {
  sourceLanguage: string;
  targetLanguage: string;
}

export interface TranslateParams {
  text: string;
}

/**
 * A Translator controller bound to one language pair. Availability is per-pair.
 *
 * Note: Chromium intentionally hides per-language-pair download status for privacy,
 * so `downloadProgress` may stay at 0 then jump to 1 for the Translator — don't rely
 * on a smooth progress bar here the way you can for the language-model APIs.
 */
export function createTranslator(pair: TranslatorPair): TaskController<TranslateParams> {
  const opts = () => ({ sourceLanguage: pair.sourceLanguage, targetLanguage: pair.targetLanguage });
  return createTaskController<TranslatorSession, TranslateParams>({
    api: "Translator",
    globalName: "Translator",
    createOptions: opts,
    availabilityOptions: opts,
    run: (s, p, signal) => s.translate(p.text, signal ? { signal } : undefined),
    stream: (s, p, o) => s.translateStreaming(p.text, o),
  });
}
