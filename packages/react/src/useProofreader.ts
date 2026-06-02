import { useCallback, useEffect, useRef, useState } from "react";
import {
  createProofreader,
  isAbortError,
  type ProofreaderOptions,
  type ProofreadResult,
} from "use-chrome-ai";
import { type AiStatus, optionsKey, useAiStatus, useController } from "./internal";

export interface ProofreaderHook extends AiStatus {
  /** Latest proofread result, or null. */
  result: ProofreadResult | null;
  /** A proofread call is in flight. */
  isPending: boolean;
  error: Error | null;
  /** Proofread text. Resolves with corrections. Never rejects — see `error`. */
  proofread: (text: string) => Promise<ProofreadResult | null>;
}

/** Proofreader is request/response (no streaming) — hence `isPending`, not `isStreaming`. */
export function useProofreader(options: ProofreaderOptions = {}): ProofreaderHook {
  const controller = useController(() => createProofreader(options), optionsKey("proofreader", options));
  const base = useAiStatus(controller);
  const [result, setResult] = useState<ProofreadResult | null>(null);
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const ac = useRef<AbortController | null>(null);

  useEffect(() => () => ac.current?.abort(), []);

  const proofread = useCallback(
    async (text: string): Promise<ProofreadResult | null> => {
      ac.current?.abort();
      const next = new AbortController();
      ac.current = next;
      setError(null);
      setPending(true);
      try {
        const r = await controller.proofread(text, next.signal);
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

  return { ...base, result, isPending, error: error ?? base.status.error, proofread };
}
