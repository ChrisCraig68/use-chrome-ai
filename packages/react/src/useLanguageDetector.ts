import { useCallback, useEffect, useRef, useState } from "react";
import {
  createLanguageDetector,
  type DetectResult,
  isAbortError,
  type LanguageDetectorOptions,
} from "use-chrome-ai";
import { type AiStatus, optionsKey, useAiStatus, useController } from "./internal";

export interface LanguageDetectorHook extends AiStatus {
  /** Latest detection results (ranked by confidence), or null. */
  result: DetectResult[] | null;
  isPending: boolean;
  error: Error | null;
  /** Detect the language(s) of text. Never rejects — see `error`. */
  detect: (text: string) => Promise<DetectResult[] | null>;
}

export function useLanguageDetector(options: LanguageDetectorOptions = {}): LanguageDetectorHook {
  const controller = useController(
    () => createLanguageDetector(options),
    optionsKey("languageDetector", options),
  );
  const base = useAiStatus(controller);
  const [result, setResult] = useState<DetectResult[] | null>(null);
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const ac = useRef<AbortController | null>(null);

  useEffect(() => () => ac.current?.abort(), []);

  const detect = useCallback(
    async (text: string): Promise<DetectResult[] | null> => {
      ac.current?.abort();
      const next = new AbortController();
      ac.current = next;
      setError(null);
      setPending(true);
      try {
        const r = await controller.detect(text, next.signal);
        setResult(r);
        return r;
      } catch (err) {
        if (!isAbortError(err)) setError(err instanceof Error ? err : new Error(String(err)));
        return null;
      } finally {
        setPending(false);
      }
    },
    [controller],
  );

  return { ...base, result, isPending, error: error ?? base.status.error, detect };
}
