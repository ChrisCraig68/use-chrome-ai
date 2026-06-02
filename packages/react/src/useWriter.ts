import { useCallback } from "react";
import { createWriter, type WriteParams, type WriterOptions } from "use-chrome-ai";
import { optionsKey, type TaskHook, useController, useTask } from "./internal";

export interface WriterHook extends TaskHook<WriteParams> {
  /** Generate text from a prompt, streaming into `result`. Resolves with the full text. */
  write: (prompt: string, perCall?: { context?: string }) => Promise<string>;
}

export function useWriter(options: WriterOptions = {}): WriterHook {
  const controller = useController(() => createWriter(options), optionsKey("writer", options));
  const task = useTask<WriteParams>(controller);
  const write = useCallback(
    (prompt: string, perCall?: { context?: string }) => task.stream({ prompt, ...(perCall ?? {}) }),
    [task.stream],
  );
  return { ...task, write };
}
