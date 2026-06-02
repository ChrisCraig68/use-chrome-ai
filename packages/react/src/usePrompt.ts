import { useCallback, useEffect, useRef, useState } from "react";
import { createLanguageModel, isAbortError, type LanguageModelOptions } from "use-chrome-ai";
import { type AiStatus, optionsKey, useAiStatus, useController } from "./internal";

export interface PromptHook extends AiStatus {
  /** Latest streamed response. */
  result: string;
  isStreaming: boolean;
  error: Error | null;
  stop: () => void;
  /** One-shot prompt, streaming into `result`. Resolves with the full text. Never rejects. */
  prompt: (input: string) => Promise<string>;
}

/**
 * One-shot LanguageModel prompting (no conversation memory). For a stateful chatbot
 * use {@link useChat}. For grammar-constrained / structured output, use the core
 * `createLanguageModel().prompt(input, { responseConstraint })`.
 */
export function usePrompt(options: LanguageModelOptions = {}): PromptHook {
  const controller = useController(() => createLanguageModel(options), optionsKey("prompt", options));
  const base = useAiStatus(controller);
  const [result, setResult] = useState("");
  const [isStreaming, setStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const ac = useRef<AbortController | null>(null);

  useEffect(() => () => ac.current?.abort(), []);

  const stop = useCallback(() => ac.current?.abort(), []);

  const prompt = useCallback(
    async (input: string): Promise<string> => {
      ac.current?.abort();
      const next = new AbortController();
      ac.current = next;
      setResult("");
      setError(null);
      setStreaming(true);
      let acc = "";
      try {
        for await (const delta of controller.promptStream(input, { signal: next.signal })) {
          acc += delta;
          setResult(acc);
        }
      } catch (err) {
        if (!isAbortError(err)) setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setStreaming(false);
      }
      return acc;
    },
    [controller],
  );

  return { ...base, result, isStreaming, error: error ?? base.status.error, stop, prompt };
}
