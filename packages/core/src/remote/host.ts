import type { PromptOptions } from "../apis/languageModel";
import type { BaseController } from "../lifecycle";
import { BuiltInAiError } from "../types";
import {
  type CallMessage,
  type ClientMessage,
  type HostMessage,
  PROTOCOL_VERSION,
  parse,
  type Transport,
  toWireError,
  toWireState,
} from "./protocol";

/** The methods the protocol knows how to forward. A controller only needs the ones its
 *  clients actually call — a missing one fails that call, not the connection. */
interface HostTarget extends BaseController {
  run?(params: unknown, signal?: AbortSignal): Promise<string>;
  stream?(params: unknown, signal?: AbortSignal): AsyncGenerator<string>;
  prompt?(input: string, opts?: PromptOptions): Promise<string>;
  promptStream?(input: string, opts?: { signal?: AbortSignal }): AsyncGenerator<string>;
}

export interface ExposeOptions {
  /** Abort a request still running this many milliseconds after it started. A backstop
   *  for clients that vanish without a chance to say so (a popup closing mid-stream);
   *  clients that call `destroy()` are cleaned up immediately regardless. Off by default
   *  — a long generation is not a leak. */
  requestTimeoutMs?: number;
}

function must<F>(fn: F | undefined, name: string): F {
  if (!fn) throw new BuiltInAiError(`The controller exposed here has no ${name}() method.`);
  return fn;
}

/** Fixed dispatch for the single-value methods — no reflection over arbitrary members.
 *  The `AbortSignal` is created host-side per request and injected here. */
const CALLS: Record<
  string,
  (c: HostTarget, args: unknown[], signal: AbortSignal) => Promise<unknown>
> = {
  refresh: (c) => c.refresh(),
  // warm()/download() resolve with the live session, which cannot cross the boundary —
  // the session stays here. Clients get `undefined` and read progress off the state push.
  warm: async (c, _args, signal) => {
    await c.warm({ signal });
  },
  // The user gesture happened in the client's document, which checked it there; this
  // document has no transient activation of its own, so skip the local check.
  download: async (c, _args, signal) => {
    await c.download({ signal, requireGesture: false });
  },
  invalidate: async (c) => {
    c.invalidate();
  },
  run: (c, args, signal) => must(c.run, "run").call(c, args[0], signal),
  prompt: (c, args, signal) =>
    must(c.prompt, "prompt").call(c, args[0] as string, {
      ...(args[1] as PromptOptions | undefined),
      signal,
    }),
};

/** Fixed dispatch for the streaming methods. */
const STREAMS: Record<
  string,
  (c: HostTarget, args: unknown[], signal: AbortSignal) => AsyncGenerator<string>
> = {
  stream: (c, args, signal) => must(c.stream, "stream").call(c, args[0], signal),
  promptStream: (c, args, signal) =>
    must(c.promptStream, "promptStream").call(c, args[0] as string, { signal }),
};

/**
 * Serve a controller to other JavaScript contexts over a {@link Transport}. Run this
 * where the AI globals actually exist — in a Manifest V3 extension that means the
 * offscreen document, since the globals aren't exposed to the service worker.
 *
 * State changes are pushed to every connected client; each client's calls get their own
 * `AbortController` so one cancelling doesn't disturb the others. Returns a function that
 * stops serving (and aborts anything still in flight); it does NOT destroy the controller.
 *
 * Trusted contexts only — this is a same-extension/same-app bridge with no origin checks.
 */
export function exposeController(
  id: string,
  controller: BaseController,
  transport: Transport,
  options: ExposeOptions = {},
): () => void {
  const target = controller as HostTarget;
  /** In-flight requests, keyed `clientId|requestId` (client ids contain no `|`). */
  const live = new Map<string, { ac: AbortController; timer?: ReturnType<typeof setTimeout> }>();

  const post = (msg: HostMessage, cid: string): void =>
    transport.send({ v: PROTOCOL_VERSION, id, cid, ...msg });

  const pushState = (cid: string): void =>
    post({ t: "state", state: toWireState(controller.getSnapshot()) }, cid);

  function drop(key: string): { ac: AbortController } | undefined {
    const entry = live.get(key);
    if (!entry) return undefined;
    if (entry.timer !== undefined) clearTimeout(entry.timer);
    live.delete(key);
    return entry;
  }

  function cancel(key: string): void {
    drop(key)?.ac.abort();
  }

  async function invoke(cid: string, msg: CallMessage): Promise<void> {
    const key = `${cid}|${msg.rid}`;
    const ac = new AbortController();
    live.set(key, {
      ac,
      ...(options.requestTimeoutMs
        ? { timer: setTimeout(() => cancel(key), options.requestTimeoutMs) }
        : {}),
    });
    try {
      const streaming = STREAMS[msg.method];
      if (streaming) {
        for await (const chunk of streaming(target, msg.args, ac.signal)) {
          post({ t: "chunk", rid: msg.rid, value: chunk }, cid);
        }
        post({ t: "done", rid: msg.rid }, cid);
        return;
      }
      const call = CALLS[msg.method];
      if (!call) throw new BuiltInAiError(`Unknown remote method "${msg.method}".`);
      post({ t: "result", rid: msg.rid, value: await call(target, msg.args, ac.signal) }, cid);
    } catch (err) {
      post({ t: "error", rid: msg.rid, error: toWireError(err) }, cid);
    } finally {
      drop(key);
    }
  }

  const unsubscribe = controller.subscribe(() => pushState(""));

  const offMessage = transport.onMessage((raw) => {
    const msg = parse<ClientMessage>(raw, id);
    if (!msg) return;
    switch (msg.t) {
      case "hello":
        // Answer only the asker; the other clients already have this state.
        pushState(msg.cid);
        break;
      case "call":
        void invoke(msg.cid, msg);
        break;
      case "cancel":
        cancel(`${msg.cid}|${msg.rid}`);
        break;
      case "bye":
        for (const key of [...live.keys()]) {
          if (key.startsWith(`${msg.cid}|`)) cancel(key);
        }
        break;
    }
  });

  return () => {
    unsubscribe();
    offMessage();
    for (const key of [...live.keys()]) cancel(key);
  };
}
