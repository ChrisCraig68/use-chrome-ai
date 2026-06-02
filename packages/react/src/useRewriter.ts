import { useCallback } from "react";
import { createRewriter, type RewriteParams, type RewriterOptions } from "use-chrome-ai";
import { optionsKey, type TaskHook, useController, useTask } from "./internal";

export interface RewriterHook extends TaskHook<RewriteParams> {
  /** Rewrite text (tone/length come from the hook options), streaming into `result`. */
  rewrite: (text: string, perCall?: { context?: string }) => Promise<string>;
}

/** Changing `options` (e.g. tone) transparently recreates the session, since the
 *  Rewriter pins tone/length at create time. */
export function useRewriter(options: RewriterOptions = {}): RewriterHook {
  const controller = useController(() => createRewriter(options), optionsKey("rewriter", options));
  const task = useTask<RewriteParams>(controller);
  const rewrite = useCallback(
    (text: string, perCall?: { context?: string }) => task.stream({ text, ...(perCall ?? {}) }),
    [task.stream],
  );
  return { ...task, rewrite };
}
