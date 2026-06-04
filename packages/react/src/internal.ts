import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  type BaseController,
  type ControllerState,
  deriveModelStatus,
  isAbortError,
  type ModelStatus,
  type Store,
  type TaskController,
} from "use-chrome-ai";

/** Bind to a controller's status. Tearing-free and SSR-safe (getServerSnapshot). */
export function useModelStatus(controller: Store<ControllerState>): ControllerState {
  return useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getServerSnapshot,
  );
}

/**
 * Own a controller across renders. Rebuilds it when `key` changes (e.g. the create
 * options changed) and disposes it on unmount. `make` is called during render but is
 * side-effect-free until the controller is actually used (warm/run/stream).
 */
export function useController<T extends BaseController>(make: () => T, key: string): T {
  const ref = useRef<{ key: string; ctrl: T } | null>(null);
  if (!ref.current || ref.current.key !== key) {
    ref.current?.ctrl.destroy();
    ref.current = { key, ctrl: make() };
  }
  // Destroy on unmount only. We intentionally do NOT null the ref here: under React
  // StrictMode's dev mount→unmount→remount, nulling would make the next render build a
  // brand-new controller (losing an in-progress chat session). The controller is
  // revivable — a later warm() opens a fresh session if this one was destroyed.
  useEffect(
    () => () => {
      ref.current?.ctrl.destroy();
    },
    [],
  );
  return ref.current.ctrl;
}

/** Stable key from a plain options object. */
export function optionsKey(prefix: string, options: unknown): string {
  return `${prefix}:${JSON.stringify(options ?? {})}`;
}

/** The shared surface every hook spreads: the whole model lifecycle grouped under one
 *  `model` field, so each hook's own methods/results stay at the top level. */
export interface AiStatus {
  /** Model availability, download progress, readiness booleans, and `download()`. */
  model: ModelStatus;
}

export function useAiStatus(controller: BaseController): AiStatus {
  const status = useModelStatus(controller);
  const download = useCallback(() => controller.download(), [controller]);
  useEffect(() => {
    void controller.refresh();
  }, [controller]);
  return { model: deriveModelStatus(status, download) };
}

export interface TaskHook<TParams> extends AiStatus {
  /** Latest streamed text (accumulates during streaming). */
  result: string;
  isStreaming: boolean;
  error: Error | null;
  stop: () => void;
  /** Stream into `result`; resolves with the full text. Never rejects — see `error`. */
  stream: (params: TParams) => Promise<string>;
}

/** Backs the streaming task hooks (summarizer/writer/rewriter/translator). */
export function useTask<TParams>(controller: TaskController<TParams>): TaskHook<TParams> {
  const base = useAiStatus(controller);
  const [result, setResult] = useState("");
  const [isStreaming, setStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const ac = useRef<AbortController | null>(null);

  useEffect(() => () => ac.current?.abort(), []);

  const stop = useCallback(() => ac.current?.abort(), []);

  const stream = useCallback(
    async (params: TParams): Promise<string> => {
      ac.current?.abort();
      const controllerSignal = new AbortController();
      ac.current = controllerSignal;
      setResult("");
      setError(null);
      setStreaming(true);
      let acc = "";
      try {
        for await (const delta of controller.stream(params, controllerSignal.signal)) {
          acc += delta;
          setResult(acc);
        }
      } catch (err) {
        if (!isAbortError(err)) setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setStreaming(false);
      }
      return acc;
    },
    [controller],
  );

  return { ...base, result, isStreaming, error: error ?? base.model.status.error, stop, stream };
}
