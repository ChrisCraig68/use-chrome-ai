import type { TaskController } from "../lifecycle";
import { createTaskController } from "./task";

interface RewriterSession {
  rewrite(text: string, opts?: { context?: string; signal?: AbortSignal }): Promise<string>;
  rewriteStreaming(text: string, opts?: { context?: string; signal?: AbortSignal }): ReadableStream<string>;
  destroy?(): void;
}

export interface RewriterOptions {
  /** Pinned at session create — to change it, construct another controller (the
   *  React `useRewriter` hook does this automatically when the option changes). */
  tone?: "as-is" | "more-formal" | "more-casual";
  format?: "as-is" | "plain-text" | "markdown";
  length?: "as-is" | "shorter" | "longer";
  sharedContext?: string;
  expectedInputLanguages?: string[];
  outputLanguage?: string;
}

export interface RewriteParams {
  text: string;
  context?: string;
}

export function createRewriter(options: RewriterOptions = {}): TaskController<RewriteParams> {
  const hints = () => ({
    expectedInputLanguages: options.expectedInputLanguages ?? ["en"],
    outputLanguage: options.outputLanguage ?? "en",
  });
  return createTaskController<RewriterSession, RewriteParams>({
    api: "Rewriter",
    globalName: "Rewriter",
    createOptions: () => ({
      tone: options.tone ?? "as-is",
      format: options.format ?? "as-is",
      length: options.length ?? "as-is",
      ...(options.sharedContext ? { sharedContext: options.sharedContext } : {}),
      ...hints(),
    }),
    availabilityOptions: hints,
    run: (s, p, signal) =>
      s.rewrite(p.text, { ...(p.context ? { context: p.context } : {}), ...(signal ? { signal } : {}) }),
    stream: (s, p, o) =>
      s.rewriteStreaming(p.text, { ...(p.context ? { context: p.context } : {}), ...o }),
  });
}
