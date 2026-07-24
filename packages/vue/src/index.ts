import {
  type ChatMessage,
  type ChatOptions,
  createChat,
  type DownloadOptions,
  deriveModelStatus,
  isAbortError,
  type ModelStatus,
  type Store,
} from "use-chrome-ai";
import {
  type ComputedRef,
  computed,
  type DeepReadonly,
  onMounted,
  onScopeDispose,
  type Ref,
  readonly,
  ref,
  shallowRef,
} from "vue";

/**
 * Bind any controller's status to a Vue ref — the framework-agnostic seam, Vue edition.
 * The SAME `subscribe`/`getSnapshot` store that the React hooks consume drives Vue
 * reactivity here, in a handful of lines. This is the proof that the core is genuinely
 * framework-agnostic.
 */
export function useModelStatus<S>(store: Store<S>): DeepReadonly<Ref<S>> {
  const state = shallowRef(store.getSnapshot()) as Ref<S>;
  const unsubscribe = store.subscribe(() => {
    state.value = store.getSnapshot();
  });
  onScopeDispose(unsubscribe);
  return readonly(state) as DeepReadonly<Ref<S>>;
}

export interface UseChatReturn {
  /** Model availability, download progress, readiness booleans, and `download()`. */
  model: ComputedRef<ModelStatus>;
  messages: Ref<ChatMessage[]>;
  isStreaming: Ref<boolean>;
  error: ComputedRef<Error | null>;
  /** Send a message; streams the reply into `messages`. Never rejects — see `error`. */
  send: (text: string) => Promise<void>;
  stop: () => void;
  reset: () => void;
}

/** A streaming chatbot composable, mirroring the React `useChat`. */
export function useChat(options: ChatOptions = {}): UseChatReturn {
  const chat = createChat(options);
  const status = useModelStatus(chat);
  onMounted(() => {
    void chat.refresh();
  });
  const download = (opts?: DownloadOptions) => chat.download(opts);
  const model = computed(() => deriveModelStatus(status.value, download));
  const messages = shallowRef<ChatMessage[]>(chat.messages.slice());
  const isStreaming = ref(false);
  const error = ref<Error | null>(null);
  // Surface the latest async error, falling back to a controller-level error (e.g. a failed
  // availability check) — mirrors the React hooks' `error ?? model.status.error`.
  const exposedError = computed<Error | null>(() => error.value ?? status.value.error);
  let ac: AbortController | null = null;

  async function send(text: string): Promise<void> {
    const content = text.trim();
    if (!content || isStreaming.value) return;
    ac?.abort();
    ac = new AbortController();
    error.value = null;
    isStreaming.value = true;
    // Mirror the React useChat: the controller appends the user turn only once the
    // session is warm, so publish it now. Every later sync replaces this snapshot.
    messages.value = [...chat.messages, { role: "user", content }];
    try {
      for await (const _delta of chat.send(content, { signal: ac.signal })) {
        messages.value = chat.messages.slice();
      }
    } catch (err) {
      if (!isAbortError(err)) error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
      messages.value = chat.messages.slice();
      isStreaming.value = false;
    }
  }

  function stop(): void {
    ac?.abort();
  }

  function reset(): void {
    ac?.abort();
    chat.reset();
    messages.value = chat.messages.slice();
    error.value = null;
  }

  onScopeDispose(() => {
    ac?.abort();
    chat.destroy();
  });

  return { model, messages, isStreaming, error: exposedError, send, stop, reset };
}

// Re-export the framework-agnostic core for convenience.
export * from "use-chrome-ai";
