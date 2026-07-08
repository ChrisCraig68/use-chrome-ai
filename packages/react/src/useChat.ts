import { useCallback, useEffect, useRef, useState } from "react";
import { type ChatMessage, type ChatOptions, createChat, isAbortError } from "use-chrome-ai";
import { type AiStatus, optionsKey, useAiStatus, useController } from "./internal";

export interface ChatHook extends AiStatus {
  /** The conversation transcript. The user's turn appears as soon as `send()` is
   *  called; while `isStreaming` is true and the last entry is the user's, the
   *  reply hasn't started yet (render a "thinking…" indicator off that). */
  messages: ChatMessage[];
  /** Controlled input value (optional convenience). */
  input: string;
  setInput: (value: string) => void;
  /** Send a message (defaults to the current `input`), streaming the reply in. Never rejects. */
  send: (text?: string) => Promise<void>;
  /** Abort the in-flight response. */
  stop: () => void;
  /** Clear the conversation and start fresh. */
  reset: () => void;
  isStreaming: boolean;
  error: Error | null;
}

/** A streaming chatbot in one hook. Build any UI on top — this ships no components. */
export function useChat(options: ChatOptions = {}): ChatHook {
  // Key on the conversation-shaping options; transient per-call state lives in React.
  const controller = useController(
    () => createChat(options),
    optionsKey("chat", {
      system: options.system,
      initialMessages: options.initialMessages,
      topK: options.topK,
      temperature: options.temperature,
    }),
  );
  const base = useAiStatus(controller);
  const [messages, setMessages] = useState<ChatMessage[]>(() => controller.messages.slice());
  const [input, setInput] = useState("");
  const [isStreaming, setStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const ac = useRef<AbortController | null>(null);

  // Resync transcript when the controller is rebuilt (options changed).
  useEffect(() => {
    setMessages(controller.messages.slice());
    setError(null);
  }, [controller]);

  useEffect(() => () => ac.current?.abort(), []);

  const stop = useCallback(() => ac.current?.abort(), []);

  const send = useCallback(
    async (text?: string): Promise<void> => {
      const content = (text ?? input).trim();
      if (!content || isStreaming) return;
      setInput("");
      ac.current?.abort();
      const next = new AbortController();
      ac.current = next;
      setError(null);
      setStreaming(true);
      // The controller appends the user turn only once the session is warm — on a cold
      // start that gap is long enough to make the UI look frozen. Publish the turn now;
      // every later sync (per delta, and the `finally` below) replaces this snapshot
      // with the controller's transcript, so a failed send leaves no stray message.
      setMessages([...controller.messages, { role: "user", content }]);
      try {
        for await (const _delta of controller.send(content, { signal: next.signal })) {
          // The controller mutates its `messages` array in place; copy it into state
          // on each delta so React re-renders the streaming bubble.
          setMessages(controller.messages.slice());
        }
      } catch (err) {
        if (!isAbortError(err)) setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setMessages(controller.messages.slice());
        setStreaming(false);
      }
    },
    [controller, input, isStreaming],
  );

  const reset = useCallback(() => {
    ac.current?.abort();
    controller.reset();
    setMessages(controller.messages.slice());
    setError(null);
  }, [controller]);

  return {
    ...base,
    messages,
    input,
    setInput,
    send,
    stop,
    reset,
    isStreaming,
    error: error ?? base.model.status.error,
  };
}
