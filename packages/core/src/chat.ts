import {
  buildLanguageModelHints,
  type LanguageModelOptions,
  type LanguageModelSession,
} from "./apis/languageModel";
import { getGlobal } from "./availability";
import { type AiCtor, type BaseController, SessionLifecycle, store } from "./lifecycle";
import { drainStream, isAbortError } from "./stream";
import { ContextFullError } from "./types";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  /** System prompt. Defaults to "You are a helpful assistant." */
  system?: string;
  /** Conversation to seed the session with (replayed after the system message). */
  initialMessages?: ChatMessage[];
  topK?: number;
  temperature?: number;
  expectedInputs?: LanguageModelOptions["expectedInputs"];
  expectedOutputs?: LanguageModelOptions["expectedOutputs"];
}

export interface ChatController extends BaseController {
  /** The running transcript. Mutated in place as messages stream in. */
  readonly messages: ChatMessage[];
  /** Send a user message; yields assistant response deltas. The session keeps context. */
  send(text: string, opts?: { signal?: AbortSignal }): AsyncGenerator<string>;
  /** Clear the transcript and drop the session (a fresh one opens on next send). */
  reset(): void;
}

const DEFAULT_SYSTEM = "You are a helpful assistant.";

/**
 * A multi-turn chat over the LanguageModel (Prompt API). One session holds the whole
 * conversation's context. The system message is placed at index 0 of `initialPrompts`
 * (the API rejects it anywhere else).
 */
export function createChat(options: ChatOptions = {}): ChatController {
  const messages: ChatMessage[] = options.initialMessages ? [...options.initialMessages] : [];

  const life = new SessionLifecycle<LanguageModelSession>({
    api: "LanguageModel",
    getCtor: () => getGlobal<AiCtor<LanguageModelSession>>("LanguageModel"),
    createOptions: () => ({
      // Session is created once (on first send); `messages` is the seed at that point.
      // Subsequent sends reuse the live session, which retains context internally.
      initialPrompts: [{ role: "system", content: options.system ?? DEFAULT_SYSTEM }, ...messages],
      ...(options.topK !== undefined ? { topK: options.topK } : {}),
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...buildLanguageModelHints(options),
    }),
    availabilityOptions: () => buildLanguageModelHints(options),
  });

  async function* send(text: string, opts: { signal?: AbortSignal } = {}): AsyncGenerator<string> {
    opts.signal?.throwIfAborted();
    // Warm BEFORE appending so the session is created with the prior transcript only.
    const session = await life.warm(opts.signal ? { signal: opts.signal } : {});
    messages.push({ role: "user", content: text });
    const assistant: ChatMessage = { role: "assistant", content: "" };
    messages.push(assistant);
    life.setPhase("streaming");
    try {
      for await (const delta of drainStream(
        session.promptStreaming(text, opts.signal ? { signal: opts.signal } : undefined),
      )) {
        assistant.content += delta;
        yield delta;
      }
    } catch (err) {
      if (isAbortError(err)) throw err;
      // Either the context window is full or the model was evicted mid-session. The
      // session handle is dead either way — drop it. The user starts a fresh chat.
      life.invalidate();
      if (err instanceof DOMException && err.name === "QuotaExceededError") {
        throw new ContextFullError();
      }
      throw err;
    } finally {
      if (life.getSnapshot().phase === "streaming") life.setPhase("idle");
    }
  }

  function reset(): void {
    messages.length = 0;
    if (options.initialMessages) messages.push(...options.initialMessages);
    life.invalidate();
  }

  return { ...store(life), messages, send, reset };
}
