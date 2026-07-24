import { vi } from "vitest";
import type { Transport } from "../src/remote/protocol";

/** Build a `ReadableStream<string>` that enqueues `deltas`, then either closes or
 *  errors. Honors a pre-aborted signal. */
export function streamOf(
  deltas: string[],
  opts: { fail?: () => unknown; signal?: AbortSignal } = {},
): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      if (opts.signal?.aborted) {
        controller.error(new DOMException("Aborted", "AbortError"));
        return;
      }
      for (const d of deltas) controller.enqueue(d);
      if (opts.fail) {
        controller.error(opts.fail());
        return;
      }
      controller.close();
    },
  });
}

export interface FakeApiOptions {
  availability?: string;
  deltas?: string[];
  /** Emit these through the create() monitor (download progress). Bare numbers are
   *  Chrome-style 0..1 fractions; objects are Edge-style byte counts with a `total`. */
  emitProgress?: Array<number | { loaded: number; total: number }>;
  /** If set, the streaming method errors with this after emitting deltas. */
  failStreamWith?: () => unknown;
  /** Non-streaming result (summarize/translate/etc.). */
  result?: string;
  /** proofread() raw return value. */
  proofreadResult?: unknown;
  /** detect() return value. */
  detectResult?: unknown;
}

export interface FakeApi {
  Ctor: {
    availability: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  createCount: () => number;
  /** Every session ever produced (by create() or clone()), in creation order. */
  sessions: () => FakeSession[];
  lastSession: () => FakeSession | null;
}

export interface FakeSession {
  prompt: ReturnType<typeof vi.fn>;
  promptStreaming: ReturnType<typeof vi.fn>;
  summarize: ReturnType<typeof vi.fn>;
  summarizeStreaming: ReturnType<typeof vi.fn>;
  write: ReturnType<typeof vi.fn>;
  writeStreaming: ReturnType<typeof vi.fn>;
  rewrite: ReturnType<typeof vi.fn>;
  rewriteStreaming: ReturnType<typeof vi.fn>;
  translate: ReturnType<typeof vi.fn>;
  translateStreaming: ReturnType<typeof vi.fn>;
  proofread: ReturnType<typeof vi.fn>;
  detect: ReturnType<typeof vi.fn>;
  clone: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

/** A configurable fake of any Chrome AI global class + session. */
export function makeFakeApi(opts: FakeApiOptions = {}): FakeApi {
  let count = 0;
  const allSessions: FakeSession[] = [];
  const deltas = opts.deltas ?? ["He", "llo"];

  function makeSession(): FakeSession {
    const streamArgs = (signal?: AbortSignal) =>
      streamOf(deltas, {
        ...(opts.failStreamWith ? { fail: opts.failStreamWith } : {}),
        ...(signal ? { signal } : {}),
      });
    const session: FakeSession = {
      prompt: vi.fn(async (input: string) => opts.result ?? `full:${input}`),
      promptStreaming: vi.fn((_input: string, o?: { signal?: AbortSignal }) =>
        streamArgs(o?.signal),
      ),
      summarize: vi.fn(async () => opts.result ?? deltas.join("")),
      summarizeStreaming: vi.fn((_t: string, o?: { signal?: AbortSignal }) =>
        streamArgs(o?.signal),
      ),
      write: vi.fn(async () => opts.result ?? deltas.join("")),
      writeStreaming: vi.fn((_t: string, o?: { signal?: AbortSignal }) => streamArgs(o?.signal)),
      rewrite: vi.fn(async () => opts.result ?? deltas.join("")),
      rewriteStreaming: vi.fn((_t: string, o?: { signal?: AbortSignal }) => streamArgs(o?.signal)),
      translate: vi.fn(async () => opts.result ?? deltas.join("")),
      translateStreaming: vi.fn((_t: string, o?: { signal?: AbortSignal }) =>
        streamArgs(o?.signal),
      ),
      proofread: vi.fn(async () => opts.proofreadResult ?? { correctedInput: "", corrections: [] }),
      detect: vi.fn(async () => opts.detectResult ?? []),
      clone: vi.fn(async () => makeSession()),
      destroy: vi.fn(),
    };
    allSessions.push(session);
    return session;
  }

  const Ctor = {
    availability: vi.fn(async () => opts.availability ?? "available"),
    create: vi.fn(async (o: { monitor?: (m: EventTarget) => void }) => {
      count++;
      if (o?.monitor && opts.emitProgress) {
        const target = new EventTarget();
        o.monitor(target);
        for (const p of opts.emitProgress) {
          const init = typeof p === "number" ? { loaded: p } : p;
          target.dispatchEvent(new ProgressEvent("downloadprogress", init));
        }
      }
      return makeSession();
    }),
  };

  return {
    Ctor,
    createCount: () => count,
    sessions: () => allSessions,
    lastSession: () => allSessions[allSessions.length - 1] ?? null,
  };
}

/** Install a fake global class (e.g. "LanguageModel") and return an uninstaller. */
export function installGlobal(name: string, value: unknown): () => void {
  const g = globalThis as Record<string, unknown>;
  const had = name in g;
  const prev = g[name];
  g[name] = value;
  return () => {
    if (had) g[name] = prev;
    else delete g[name];
  };
}

/** Force `navigator.userActivation.isActive`. Returns an uninstaller. */
export function setUserActivation(isActive: boolean): () => void {
  const nav = globalThis.navigator as unknown as Record<string, unknown>;
  const prev = Object.getOwnPropertyDescriptor(nav, "userActivation");
  Object.defineProperty(nav, "userActivation", {
    value: { isActive },
    configurable: true,
    writable: true,
  });
  return () => {
    if (prev) Object.defineProperty(nav, "userActivation", prev);
    else delete nav.userActivation;
  };
}

export interface TransportPair {
  /** Give this to `exposeController`. */
  host: Transport;
  /** Give this to `connectController` — several clients may share it, as they would in
   *  a real extension where every context sees the same `chrome.runtime` traffic. */
  client: Transport;
}

/** A two-ended in-memory {@link Transport}. Messages are JSON round-tripped and
 *  delivered out of band, so anything the protocol can't serialize (an `Error`, a
 *  session handle) fails here exactly as it would over `chrome.runtime`. */
export function transportPair(): TransportPair {
  const hostHandlers = new Set<(m: unknown) => void>();
  const clientHandlers = new Set<(m: unknown) => void>();

  const deliver = (to: Set<(m: unknown) => void>, message: unknown): void => {
    const wire = JSON.stringify(message);
    queueMicrotask(() => {
      for (const fn of [...to]) fn(JSON.parse(wire));
    });
  };
  const endpoint = (
    inbox: Set<(m: unknown) => void>,
    outbox: Set<(m: unknown) => void>,
  ): Transport => ({
    send: (message) => deliver(outbox, message),
    onMessage: (handler) => {
      inbox.add(handler);
      return () => {
        inbox.delete(handler);
      };
    },
  });

  return {
    host: endpoint(hostHandlers, clientHandlers),
    client: endpoint(clientHandlers, hostHandlers),
  };
}

/** Let every queued message (and the replies it triggers) land. */
export function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Collect every state a store emits while `fn` runs. */
export async function captureStates<S>(
  store: { subscribe(fn: () => void): () => void; getSnapshot(): S },
  fn: () => Promise<void>,
): Promise<S[]> {
  const seen: S[] = [store.getSnapshot()];
  const unsub = store.subscribe(() => seen.push(store.getSnapshot()));
  try {
    await fn();
  } finally {
    unsub();
  }
  return seen;
}
