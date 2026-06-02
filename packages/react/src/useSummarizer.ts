import { useCallback } from "react";
import {
  createSummarizer,
  type SummarizeParams,
  type SummarizerOptions,
} from "use-chrome-ai";
import { optionsKey, type TaskHook, useController, useTask } from "./internal";

export interface SummarizerHook extends TaskHook<SummarizeParams> {
  /** Summarize text, streaming into `result`. Resolves with the full summary. */
  summarize: (text: string, perCall?: { context?: string }) => Promise<string>;
}

export function useSummarizer(options: SummarizerOptions = {}): SummarizerHook {
  const controller = useController(() => createSummarizer(options), optionsKey("summarizer", options));
  const task = useTask<SummarizeParams>(controller);
  const summarize = useCallback(
    (text: string, perCall?: { context?: string }) => task.stream({ text, ...(perCall ?? {}) }),
    [task.stream],
  );
  return { ...task, summarize };
}
