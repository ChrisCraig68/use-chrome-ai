import type { LanguageModelController } from "../apis/languageModel";
import {
  type BaseController,
  hasUserActivation,
  SERVER_STATE,
  type TaskController,
} from "../lifecycle";
import { ActivationRequiredError, type ControllerState, type DownloadOptions } from "../types";
import {
  type CallMethod,
  fromWireError,
  fromWireState,
  type HostMessage,
  PROTOCOL_VERSION,
  parse,
  type StreamMethod,
  type Transport,
} from "./protocol";

/** The full surface a connected proxy implements. Narrow it at the call site — a
 *  `connectController<TaskController<SummarizeParams>>(…)` exposes only run/stream. */
export interface RemoteController<TParams = unknown>
  extends TaskController<TParams>,
    LanguageModelController {}

export interface ConnectOptions {
  /** Name used in errors thrown locally (the `download()` gesture check). Defaults to
   *  the controller `id`. */
  api?: string;
}

/**
 * Served until the host's first state push lands. Mirrors `SessionLifecycle`'s own
 * pre-refresh state — an optimistic availability guarded by `checked: false` — so a UI
 * shows "checking" rather than committing to a download CTA it may have to retract.
 */
const PENDING_STATE: ControllerState = Object.freeze({
  supported: true,
  checked: false,
  availability: "downloadable" as const,
  phase: "idle" as const,
  downloadProgress: 0,
  error: null,
});

let seq = 0;
function newId(): string {
  seq += 1;
  return `${Math.random().toString(36).slice(2, 10)}${seq.toString(36)}`;
}

function abortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

/** Whether two snapshots are the same state. Errors compare by wire identity — a
 *  rehydrated Error is a fresh object every time, and a redundant push must not change
 *  the snapshot reference (`useSyncExternalStore` treats that as a real change). */
function same(a: ControllerState, b: ControllerState): boolean {
  return (
    a.supported === b.supported &&
    a.checked === b.checked &&
    a.availability === b.availability &&
    a.phase === b.phase &&
    a.downloadProgress === b.downloadProgress &&
    a.error?.name === b.error?.name &&
    a.error?.message === b.error?.message
  );
}

/** Where an in-flight request's messages go. A single-value call ignores `chunk`. */
interface Sink {
  chunk(value: string): void;
  done(value: unknown): void;
  fail(err: Error): void;
}

/** A push/pull buffer between the transport handler and a consumer's `for await`. */
function channel() {
  const buffer: string[] = [];
  let closed = false;
  let failure: Error | null = null;
  let wake: (() => void) | null = null;
  const nudge = (): void => {
    const fn = wake;
    wake = null;
    fn?.();
  };
  return {
    push(value: string): void {
      if (closed) return;
      buffer.push(value);
      nudge();
    },
    end(): void {
      closed = true;
      nudge();
    },
    fail(err: Error): void {
      if (closed) return;
      failure = err;
      closed = true;
      nudge();
    },
    /** Yields everything already buffered before surfacing the end/failure. */
    async *drain(): AsyncGenerator<string> {
      while (true) {
        const next = buffer.shift();
        if (next !== undefined) {
          yield next;
          continue;
        }
        if (failure) throw failure;
        if (closed) return;
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
    },
  };
}

/**
 * Bind to a controller {@link exposeController | exposed} in another context. The result
 * implements the same `Store<ControllerState>` + controller interfaces as a local
 * controller, so the React and Vue adapters bind to it unchanged.
 *
 * ```ts
 * const summarizer = connectController<TaskController<SummarizeParams>>("summarizer", transport);
 * for await (const delta of summarizer.stream({ text })) out += delta;
 * ```
 *
 * Differences from a local controller, all forced by the boundary:
 * - `warm()` and `download()` resolve with `undefined` — the session stays on the host.
 * - `download()` checks the user gesture *here* (where the click happened) and tells the
 *   host to skip its own check, since activation doesn't cross contexts.
 * - `destroy()` tears down this proxy only. The host controller keeps running for the
 *   other clients; `invalidate()` still forwards, since dropping a dead session is a
 *   decision about the shared model.
 */
export function connectController<T extends BaseController = RemoteController>(
  id: string,
  transport: Transport,
  options: ConnectOptions = {},
): T {
  const cid = newId();
  const api = options.api ?? id;
  const listeners = new Set<() => void>();
  const pending = new Map<string, Sink>();
  let state = PENDING_STATE;
  let detach: (() => void) | null = null;

  const post = (msg: object): void => transport.send({ v: PROTOCOL_VERSION, id, cid, ...msg });

  function setState(next: ControllerState): void {
    if (same(state, next)) return;
    state = next;
    for (const fn of listeners) fn();
  }

  function receive(raw: unknown): void {
    const msg = parse<HostMessage>(raw, id, cid);
    if (!msg) return;
    if (msg.t === "state") {
      setState(fromWireState(msg.state, api));
      return;
    }
    const sink = pending.get(msg.rid);
    if (!sink) return; // Already settled locally (cancelled), or not ours.
    switch (msg.t) {
      case "chunk":
        sink.chunk(msg.value);
        break;
      case "result":
        pending.delete(msg.rid);
        sink.done(msg.value);
        break;
      case "done":
        pending.delete(msg.rid);
        sink.done(undefined);
        break;
      case "error":
        pending.delete(msg.rid);
        sink.fail(fromWireError(msg.error, api));
        break;
    }
  }

  /** Attach lazily so a proxy stays usable after `destroy()` — React's StrictMode
   *  remount destroys and reuses a controller, and the local one is revivable too. */
  function attach(): void {
    if (detach) return;
    detach = transport.onMessage(receive);
    post({ t: "hello" });
  }

  function call(
    method: CallMethod,
    args: unknown[],
    signal: AbortSignal | undefined,
  ): Promise<unknown> {
    attach();
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(abortError());
        return;
      }
      const rid = newId();
      // Membership in `pending` IS the "not settled yet" flag.
      function onAbort(): void {
        if (!pending.delete(rid)) return;
        post({ t: "cancel", rid });
        reject(abortError());
      }
      const off = (): void => signal?.removeEventListener("abort", onAbort);
      pending.set(rid, {
        chunk() {},
        done(value) {
          off();
          resolve(value);
        },
        fail(err) {
          off();
          reject(err);
        },
      });
      signal?.addEventListener("abort", onAbort);
      post({ t: "call", rid, method, args });
    });
  }

  async function* stream(
    method: StreamMethod,
    args: unknown[],
    signal: AbortSignal | undefined,
  ): AsyncGenerator<string> {
    attach();
    signal?.throwIfAborted();
    const rid = newId();
    const chan = channel();
    // Terminate on the caller's signal immediately — waiting for the host's round-trip
    // would leave the generator hanging on a cancellation the caller already made.
    const onAbort = (): void => chan.fail(abortError());
    signal?.addEventListener("abort", onAbort);
    pending.set(rid, { chunk: chan.push, done: () => chan.end(), fail: chan.fail });
    post({ t: "call", rid, method, args });
    try {
      yield* chan.drain();
    } finally {
      signal?.removeEventListener("abort", onAbort);
      // Still pending means we're leaving early (abort, or the consumer broke out of the
      // loop) — the host is still generating, so tell it to stop.
      if (pending.delete(rid)) post({ t: "cancel", rid });
    }
  }

  const proxy: RemoteController = {
    subscribe(onChange) {
      attach();
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    getSnapshot: () => state,
    getServerSnapshot: () => SERVER_STATE,

    refresh: () => call("refresh", [], undefined) as Promise<ControllerState["availability"]>,
    warm: (opts = {}) => call("warm", [], opts.signal),
    async download(opts: DownloadOptions = {}) {
      // The gesture is real *here* — this is where the click happened. Check it locally
      // under the same rules a local controller uses, then let the host skip its own
      // check (a host document never has transient activation of its own).
      if ((opts.requireGesture ?? true) && !hasUserActivation()) {
        throw new ActivationRequiredError(api);
      }
      return call("download", [], opts.signal);
    },
    invalidate() {
      // Fire-and-forget: the interface returns void, so there's nowhere to report a
      // transport failure. The host's invalidate() itself never rejects.
      void call("invalidate", [], undefined).catch(() => {});
    },
    destroy() {
      const orphans = [...pending.values()];
      pending.clear();
      post({ t: "bye" });
      detach?.();
      detach = null;
      listeners.clear();
      for (const sink of orphans) sink.fail(abortError());
    },

    run: (params, signal) => call("run", [params], signal) as Promise<string>,
    stream: (params, signal) => stream("stream", [params], signal),
    prompt: (input, opts = {}) =>
      call(
        "prompt",
        [input, opts.responseConstraint ? { responseConstraint: opts.responseConstraint } : {}],
        opts.signal,
      ) as Promise<string>,
    promptStream: (input, opts: { signal?: AbortSignal } = {}) =>
      stream("promptStream", [input], opts.signal),
  };

  attach();
  return proxy as unknown as T;
}
