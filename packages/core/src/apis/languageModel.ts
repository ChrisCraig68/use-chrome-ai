import { getGlobal } from "../availability";
import {
  type AiCtor,
  type BaseController,
  SessionLifecycle,
  store,
  streamCall,
} from "../lifecycle";
import { isAbortError } from "../stream";

export interface LanguageModelSession {
  prompt(
    input: string,
    opts?: { signal?: AbortSignal; responseConstraint?: object },
  ): Promise<string>;
  promptStreaming(input: string, opts?: { signal?: AbortSignal }): ReadableStream<string>;
  clone(opts?: { signal?: AbortSignal }): Promise<LanguageModelSession>;
  destroy?(): void;
}

export interface PromptMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LanguageModelOptions {
  /** Shorthand for a single system message (placed at index 0 of `initialPrompts`). */
  system?: string;
  /** Full initial prompt list. A `system` role, if present, MUST be at index 0. */
  initialPrompts?: PromptMessage[];
  /** Best-effort hint — some browsers/contexts ignore sampling params (Chrome web pages do). */
  topK?: number;
  /** Best-effort hint — some browsers/contexts ignore sampling params (Chrome web pages do). */
  temperature?: number;
  /** Defaults to `[{ type: 'text', languages: ['en'] }]`. Add image/audio for multimodal. */
  expectedInputs?: Array<{ type: string; languages?: string[] }>;
  expectedOutputs?: Array<{ type: string; languages?: string[] }>;
}

/** LanguageModel uses a different lang-hint shape than the task APIs. */
export const LM_HINTS = {
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }],
};

export function buildLanguageModelHints(opts: LanguageModelOptions): Record<string, unknown> {
  return {
    expectedInputs: opts.expectedInputs ?? LM_HINTS.expectedInputs,
    expectedOutputs: opts.expectedOutputs ?? LM_HINTS.expectedOutputs,
  };
}

function initialPromptsFor(opts: LanguageModelOptions): PromptMessage[] | undefined {
  if (opts.initialPrompts?.length) return opts.initialPrompts;
  if (opts.system) return [{ role: "system", content: opts.system }];
  return undefined;
}

export interface PromptOptions {
  signal?: AbortSignal;
  /** JSON Schema the output is grammar-constrained to match (structured output). */
  responseConstraint?: object;
}

export interface LanguageModelController extends BaseController {
  /** One-shot prompt. Resolves with the full response. */
  prompt(input: string, opts?: PromptOptions): Promise<string>;
  /** One-shot streaming prompt. Yields response deltas. */
  promptStream(input: string, opts?: { signal?: AbortSignal }): AsyncGenerator<string>;
}

/**
 * A one-shot LanguageModel (Prompt API) controller. Each call runs on a throwaway
 * `clone()` of a warm base session so the system prompt is paid for once. For
 * multi-turn conversations with memory, use {@link createChat} instead.
 */
export function createLanguageModel(options: LanguageModelOptions = {}): LanguageModelController {
  const life = new SessionLifecycle<LanguageModelSession>({
    api: "LanguageModel",
    getCtor: () => getGlobal<AiCtor<LanguageModelSession>>("LanguageModel"),
    createOptions: () => {
      const initialPrompts = initialPromptsFor(options);
      return {
        ...(initialPrompts ? { initialPrompts } : {}),
        ...(options.topK !== undefined ? { topK: options.topK } : {}),
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
        ...buildLanguageModelHints(options),
      };
    },
    availabilityOptions: () => buildLanguageModelHints(options),
  });

  return {
    ...store(life),
    async prompt(input, opts = {}) {
      const base = await life.warm(opts.signal ? { signal: opts.signal } : {});
      let clone: LanguageModelSession | undefined;
      try {
        clone = await base.clone(opts.signal ? { signal: opts.signal } : undefined);
        return await clone.prompt(input, {
          ...(opts.signal ? { signal: opts.signal } : {}),
          ...(opts.responseConstraint ? { responseConstraint: opts.responseConstraint } : {}),
        });
      } catch (err) {
        if (!isAbortError(err)) life.invalidate();
        throw err;
      } finally {
        clone?.destroy?.();
      }
    },
    async *promptStream(input, opts = {}) {
      const base = await life.warm(opts.signal ? { signal: opts.signal } : {});
      let clone: LanguageModelSession;
      try {
        clone = await base.clone(opts.signal ? { signal: opts.signal } : undefined);
      } catch (err) {
        if (!isAbortError(err)) life.invalidate();
        throw err;
      }
      // streamCall owns the clone: it destroys it and invalidates on a real failure.
      yield* streamCall(
        life,
        (s) => s.promptStreaming(input, opts.signal ? { signal: opts.signal } : undefined),
        opts.signal,
        clone,
      );
    },
  };
}
