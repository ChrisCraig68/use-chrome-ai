import type { TaskController } from "../lifecycle";
import { createTaskController } from "./task";

interface SummarizerSession {
  summarize(text: string, opts?: { context?: string; signal?: AbortSignal }): Promise<string>;
  summarizeStreaming(text: string, opts?: { context?: string; signal?: AbortSignal }): ReadableStream<string>;
  destroy?(): void;
}

export interface SummarizerOptions {
  type?: "tldr" | "key-points" | "teaser" | "headline";
  format?: "plain-text" | "markdown";
  length?: "short" | "medium" | "long";
  /** Context shared across every summarize call on this session. */
  sharedContext?: string;
  expectedInputLanguages?: string[];
  outputLanguage?: string;
}

export interface SummarizeParams {
  text: string;
  /** Per-call context (e.g. where the text came from). */
  context?: string;
}

export function createSummarizer(options: SummarizerOptions = {}): TaskController<SummarizeParams> {
  const hints = () => ({
    expectedInputLanguages: options.expectedInputLanguages ?? ["en"],
    outputLanguage: options.outputLanguage ?? "en",
  });
  return createTaskController<SummarizerSession, SummarizeParams>({
    api: "Summarizer",
    globalName: "Summarizer",
    createOptions: () => ({
      type: options.type ?? "tldr",
      format: options.format ?? "plain-text",
      length: options.length ?? "short",
      ...(options.sharedContext ? { sharedContext: options.sharedContext } : {}),
      ...hints(),
    }),
    availabilityOptions: hints,
    run: (s, p, signal) =>
      s.summarize(p.text, { ...(p.context ? { context: p.context } : {}), ...(signal ? { signal } : {}) }),
    stream: (s, p, o) =>
      s.summarizeStreaming(p.text, { ...(p.context ? { context: p.context } : {}), ...o }),
  });
}
