import type { TaskController } from "../lifecycle";
import { createTaskController } from "./task";

interface WriterSession {
  write(prompt: string, opts?: { context?: string; signal?: AbortSignal }): Promise<string>;
  writeStreaming(
    prompt: string,
    opts?: { context?: string; signal?: AbortSignal },
  ): ReadableStream<string>;
  destroy?(): void;
}

export interface WriterOptions {
  tone?: "formal" | "neutral" | "casual";
  format?: "plain-text" | "markdown";
  length?: "short" | "medium" | "long";
  sharedContext?: string;
  expectedInputLanguages?: string[];
  outputLanguage?: string;
}

export interface WriteParams {
  prompt: string;
  context?: string;
}

export function createWriter(options: WriterOptions = {}): TaskController<WriteParams> {
  const hints = () => ({
    expectedInputLanguages: options.expectedInputLanguages ?? ["en"],
    outputLanguage: options.outputLanguage ?? "en",
  });
  return createTaskController<WriterSession, WriteParams>({
    api: "Writer",
    globalName: "Writer",
    createOptions: () => ({
      tone: options.tone ?? "neutral",
      format: options.format ?? "plain-text",
      length: options.length ?? "medium",
      ...(options.sharedContext ? { sharedContext: options.sharedContext } : {}),
      ...hints(),
    }),
    availabilityOptions: hints,
    run: (s, p, signal) =>
      s.write(p.prompt, {
        ...(p.context ? { context: p.context } : {}),
        ...(signal ? { signal } : {}),
      }),
    stream: (s, p, o) =>
      s.writeStreaming(p.prompt, { ...(p.context ? { context: p.context } : {}), ...o }),
  });
}
