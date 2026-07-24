import { afterEach, describe, expect, it, vi } from "vitest";
import { createSummarizer, type SummarizeParams } from "../src/apis/summarizer";
import type { BaseController, TaskController } from "../src/lifecycle";
import { connectController, type RemoteController } from "../src/remote/client";
import { exposeController } from "../src/remote/host";
import { isAbortError } from "../src/stream";
import {
  ActivationRequiredError,
  BuiltInAiError,
  ContextFullError,
  type ControllerState,
  type DownloadOptions,
  deriveModelStatus,
  UnavailableError,
} from "../src/types";
import { installGlobal, makeFakeApi, settle, setUserActivation, transportPair } from "./helpers";

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
  vi.restoreAllMocks();
});

const INITIAL: ControllerState = Object.freeze({
  supported: true,
  checked: false,
  availability: "downloadable" as const,
  phase: "idle" as const,
  downloadProgress: 0,
  error: null,
});

/** A hand-driven stand-in for a real controller, so tests can steer state, arguments,
 *  and generator timing precisely. `behavior` is overridable per test. */
function makeStub() {
  const spy = {
    download: [] as DownloadOptions[],
    warmSignals: [] as Array<AbortSignal | undefined>,
    runSignals: [] as Array<AbortSignal | undefined>,
    streamSignals: [] as Array<AbortSignal | undefined>,
    refreshed: 0,
    invalidated: 0,
    destroyed: 0,
  };
  const behavior = {
    run: async (_params: unknown): Promise<string> => "ran",
    async *stream(params: unknown, _signal?: AbortSignal): AsyncGenerator<string> {
      const { text } = params as { text: string };
      yield `${text}:1`;
      yield `${text}:2`;
    },
    prompt: async (input: string): Promise<string> => `answer:${input}`,
    async *promptStream(input: string): AsyncGenerator<string> {
      yield `${input}!`;
    },
  };

  let state = INITIAL;
  const listeners = new Set<() => void>();
  function set(patch: Partial<ControllerState>): void {
    state = Object.freeze({ ...state, ...patch });
    for (const fn of listeners) fn();
  }

  const controller: RemoteController<{ text: string }> = {
    subscribe(onChange) {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    getSnapshot: () => state,
    getServerSnapshot: () => INITIAL,
    async refresh() {
      spy.refreshed += 1;
      set({ checked: true, availability: "available" });
      return state.availability;
    },
    async warm(opts = {}) {
      spy.warmSignals.push(opts.signal);
      return { session: true };
    },
    async download(opts = {}) {
      spy.download.push(opts);
      set({ checked: true, availability: "available", downloadProgress: 1 });
      return { session: true };
    },
    invalidate() {
      spy.invalidated += 1;
    },
    destroy() {
      spy.destroyed += 1;
    },
    run: (params, signal) => {
      spy.runSignals.push(signal);
      return behavior.run(params);
    },
    stream: (params, signal) => {
      spy.streamSignals.push(signal);
      return behavior.stream(params, signal);
    },
    prompt: (input) => behavior.prompt(input),
    promptStream: (input) => behavior.promptStream(input),
  };

  return { controller, spy, behavior, set };
}

/** Host + one client over a fresh transport pair, torn down after the test. */
function wire(controller: BaseController = makeStub().controller) {
  const pair = transportPair();
  const stop = exposeController("summarizer", controller, pair.host);
  cleanups.push(stop);
  return { pair, stop };
}

/** A generator that yields once, then blocks until its signal aborts. */
async function* hangAfterFirst(signal?: AbortSignal): AsyncGenerator<string> {
  yield "first";
  await new Promise<never>((_, reject) => {
    signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  });
}

describe("remote controllers — store contract", () => {
  it("serves a 'checking' snapshot until the host's first state lands", async () => {
    const stub = makeStub();
    const { pair } = wire(stub.controller);
    const client = connectController<TaskController<{ text: string }>>("summarizer", pair.client);

    // Before the first sync: neutral, not a download CTA and not "unavailable".
    const pending = client.getSnapshot();
    expect(pending.checked).toBe(false);
    const status = deriveModelStatus(pending, () => Promise.resolve());
    expect(status.isChecking).toBe(true);
    expect(status.isUnavailable).toBe(false);

    await settle();
    expect(client.getSnapshot().checked).toBe(false); // host hasn't checked either
    stub.set({ checked: true, availability: "available" });
    await settle();
    expect(client.getSnapshot().availability).toBe("available");
  });

  it("returns the SAME snapshot reference until a real change", async () => {
    const stub = makeStub();
    const { pair } = wire(stub.controller);
    const client = connectController("summarizer", pair.client);
    await settle();

    const first = client.getSnapshot();
    expect(client.getSnapshot()).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);

    // A redundant push (same values, new object host-side) must not change the ref —
    // useSyncExternalStore reads that as a change and re-renders forever.
    stub.set({});
    await settle();
    expect(client.getSnapshot()).toBe(first);

    stub.set({ phase: "streaming" });
    await settle();
    expect(client.getSnapshot()).not.toBe(first);
    expect(client.getSnapshot().phase).toBe("streaming");
  });

  it("getServerSnapshot is the stable unavailable state (SSR safe)", () => {
    const { pair } = wire();
    const client = connectController("summarizer", pair.client);
    const server = client.getServerSnapshot();
    expect(server).toBe(client.getServerSnapshot());
    expect(server.supported).toBe(false);
    expect(server.availability).toBe("unavailable");
  });

  it("notifies subscribers and stops after unsubscribe", async () => {
    const stub = makeStub();
    const { pair } = wire(stub.controller);
    const client = connectController("summarizer", pair.client);
    const seen: string[] = [];
    const unsub = client.subscribe(() => seen.push(client.getSnapshot().phase));

    stub.set({ phase: "running" });
    await settle();
    expect(seen).toEqual(["running"]);

    unsub();
    stub.set({ phase: "idle" });
    await settle();
    expect(seen).toEqual(["running"]);
  });
});

describe("remote controllers — method calls", () => {
  it("forwards refresh/warm/invalidate and returns serializable results", async () => {
    const stub = makeStub();
    const { pair } = wire(stub.controller);
    const client = connectController("summarizer", pair.client);

    await expect(client.refresh()).resolves.toBe("available");
    expect(stub.spy.refreshed).toBe(1);

    // The session itself can't cross — warm() resolves with undefined by design.
    await expect(client.warm()).resolves.toBeUndefined();
    expect(stub.spy.warmSignals).toHaveLength(1);

    client.invalidate();
    await settle();
    expect(stub.spy.invalidated).toBe(1);
  });

  it("forwards run() and the LanguageModel surface", async () => {
    const stub = makeStub();
    const { pair } = wire(stub.controller);
    const client = connectController<RemoteController<{ text: string }>>("summarizer", pair.client);

    await expect(client.run({ text: "hi" })).resolves.toBe("ran");
    await expect(client.prompt("why")).resolves.toBe("answer:why");

    const deltas: string[] = [];
    for await (const d of client.promptStream("hey")) deltas.push(d);
    expect(deltas).toEqual(["hey!"]);
  });

  it("streams deltas in order", async () => {
    const { pair } = wire();
    const client = connectController<TaskController<{ text: string }>>("summarizer", pair.client);
    const deltas: string[] = [];
    for await (const d of client.stream({ text: "a" })) deltas.push(d);
    expect(deltas).toEqual(["a:1", "a:2"]);
  });

  it("keeps concurrent streams separate (request ids, interleaved on the wire)", async () => {
    const stub = makeStub();
    stub.behavior.stream = async function* (params) {
      const { text } = params as { text: string };
      for (const i of [1, 2, 3]) {
        await settle(); // let the other stream get a turn
        yield `${text}${i}`;
      }
    };
    const { pair } = wire(stub.controller);
    const client = connectController<TaskController<{ text: string }>>("summarizer", pair.client);

    const collect = async (text: string): Promise<string[]> => {
      const out: string[] = [];
      for await (const d of client.stream({ text })) out.push(d);
      return out;
    };
    const [a, b] = await Promise.all([collect("a"), collect("b")]);
    expect(a).toEqual(["a1", "a2", "a3"]);
    expect(b).toEqual(["b1", "b2", "b3"]);
  });

  it("reports a method the exposed controller doesn't have", async () => {
    // A BaseController-only host: run() has nowhere to go.
    const stub = makeStub();
    const {
      subscribe,
      getSnapshot,
      getServerSnapshot,
      refresh,
      warm,
      download,
      invalidate,
      destroy,
    } = stub.controller;
    const { pair } = wire({
      subscribe,
      getSnapshot,
      getServerSnapshot,
      refresh,
      warm,
      download,
      invalidate,
      destroy,
    });
    const client = connectController<TaskController<{ text: string }>>("summarizer", pair.client);
    await expect(client.run({ text: "x" })).rejects.toBeInstanceOf(BuiltInAiError);
  });

  it("ignores traffic for other controllers on the same transport", async () => {
    const stub = makeStub();
    const pair = transportPair();
    cleanups.push(exposeController("summarizer", stub.controller, pair.host));
    const other = connectController("translator", pair.client);
    const client = connectController("summarizer", pair.client);

    stub.set({ checked: true, availability: "available" });
    await settle();
    expect(client.getSnapshot().availability).toBe("available");
    expect(other.getSnapshot().checked).toBe(false); // never heard from a host
  });
});

describe("remote controllers — error rehydration", () => {
  const cases: Array<[string, () => Error, (err: unknown) => void]> = [
    [
      "UnavailableError",
      () => new UnavailableError("Summarizer"),
      (err) => {
        expect(err).toBeInstanceOf(UnavailableError);
        expect((err as UnavailableError).api).toBe("Summarizer");
      },
    ],
    [
      "ActivationRequiredError",
      () => new ActivationRequiredError("Summarizer"),
      (err) => expect(err).toBeInstanceOf(ActivationRequiredError),
    ],
    [
      "ContextFullError",
      () => new ContextFullError(),
      (err) => expect(err).toBeInstanceOf(ContextFullError),
    ],
    [
      "BuiltInAiError",
      () => new BuiltInAiError("something specific"),
      (err) => {
        expect(err).toBeInstanceOf(BuiltInAiError);
        expect((err as Error).message).toBe("something specific");
      },
    ],
  ];

  for (const [name, make, check] of cases) {
    it(`rethrows a ${name} thrown by the host`, async () => {
      const stub = makeStub();
      stub.behavior.run = async () => {
        throw make();
      };
      const { pair } = wire(stub.controller);
      const client = connectController<TaskController<{ text: string }>>("summarizer", pair.client);
      await client.run({ text: "x" }).then(
        () => expect.unreachable("should have rejected"),
        (err) => check(err),
      );
    });
  }

  it("keeps a plain Error's name and message", async () => {
    const stub = makeStub();
    stub.behavior.run = async () => {
      const err = new Error("boom");
      err.name = "TypeError";
      throw err;
    };
    const { pair } = wire(stub.controller);
    const client = connectController<TaskController<{ text: string }>>("summarizer", pair.client);
    const err = await client.run({ text: "x" }).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("TypeError");
    expect(err.message).toBe("boom");
  });

  it("rehydrates the error carried in ControllerState (Errors don't survive JSON)", async () => {
    const stub = makeStub();
    const { pair } = wire(stub.controller);
    const client = connectController("summarizer", pair.client);

    stub.set({ phase: "error", error: new UnavailableError("Summarizer") });
    await settle();
    const { error } = client.getSnapshot();
    expect(error).toBeInstanceOf(UnavailableError);
    expect((error as UnavailableError).api).toBe("Summarizer");
  });

  it("rethrows a host AbortError as a real AbortError (isAbortError still works)", async () => {
    const stub = makeStub();
    stub.behavior.run = async () => {
      throw new DOMException("Aborted", "AbortError");
    };
    const { pair } = wire(stub.controller);
    const client = connectController<TaskController<{ text: string }>>("summarizer", pair.client);
    const err = await client.run({ text: "x" }).catch((e) => e);
    expect(isAbortError(err)).toBe(true);
  });
});

describe("remote controllers — cancellation", () => {
  it("terminates a stream on the caller's signal without waiting for the host", async () => {
    const stub = makeStub();
    stub.behavior.stream = (_params, signal) => hangAfterFirst(signal);
    const { pair } = wire(stub.controller);
    const client = connectController<TaskController<{ text: string }>>("summarizer", pair.client);

    const ac = new AbortController();
    const chunks: string[] = [];
    const done = (async () => {
      try {
        for await (const d of client.stream({ text: "x" }, ac.signal)) chunks.push(d);
      } catch (err) {
        return err;
      }
    })();

    await settle();
    expect(chunks).toEqual(["first"]);

    ac.abort();
    // No settle(): the generator must end on the local signal, not a round-trip.
    expect(isAbortError(await done)).toBe(true);

    // …and the host is told, so it stops generating.
    await settle();
    expect(stub.spy.streamSignals[0]?.aborted).toBe(true);
  });

  it("cancels the host request when the consumer breaks out of the loop early", async () => {
    const stub = makeStub();
    stub.behavior.stream = (_params, signal) => hangAfterFirst(signal);
    const { pair } = wire(stub.controller);
    const client = connectController<TaskController<{ text: string }>>("summarizer", pair.client);

    for await (const _d of client.stream({ text: "x" })) break;

    await settle();
    expect(stub.spy.streamSignals[0]?.aborted).toBe(true);
  });

  it("rejects an in-flight run() on abort and cancels it host-side", async () => {
    const stub = makeStub();
    stub.behavior.run = async () =>
      new Promise<string>(() => {
        /* never settles */
      });
    const { pair } = wire(stub.controller);
    const client = connectController<TaskController<{ text: string }>>("summarizer", pair.client);

    const ac = new AbortController();
    const call = client.run({ text: "x" }, ac.signal);
    await settle();
    ac.abort();
    expect(isAbortError(await call.catch((e) => e))).toBe(true);

    await settle();
    expect(stub.spy.runSignals[0]?.aborted).toBe(true);
  });

  it("rejects immediately when the signal is already aborted", async () => {
    const { pair } = wire();
    const client = connectController<TaskController<{ text: string }>>("summarizer", pair.client);
    const signal = AbortSignal.abort();
    expect(isAbortError(await client.run({ text: "x" }, signal).catch((e) => e))).toBe(true);
    await expect(async () => {
      for await (const _d of client.stream({ text: "x" }, signal)) {
        /* unreachable */
      }
    }).rejects.toSatisfy(isAbortError);
  });
});

describe("remote controllers — download gesture", () => {
  it("checks the gesture on the client and never reaches the host without one", async () => {
    cleanups.push(setUserActivation(false));
    const stub = makeStub();
    const { pair } = wire(stub.controller);
    const client = connectController("summarizer", pair.client);

    await expect(client.download()).rejects.toBeInstanceOf(ActivationRequiredError);
    await settle();
    expect(stub.spy.download).toHaveLength(0);
  });

  it("forwards with requireGesture:false once the client has verified the gesture", async () => {
    cleanups.push(setUserActivation(true));
    const stub = makeStub();
    const { pair } = wire(stub.controller);
    const client = connectController("summarizer", pair.client);

    await client.download();
    expect(stub.spy.download).toHaveLength(1);
    // The host document has no activation of its own; it must not re-check.
    expect(stub.spy.download[0]?.requireGesture).toBe(false);
    expect(client.getSnapshot().availability).toBe("available");
  });

  it("download({ requireGesture: false }) skips the client check too", async () => {
    cleanups.push(setUserActivation(false));
    const stub = makeStub();
    const { pair } = wire(stub.controller);
    const client = connectController("summarizer", pair.client);

    await client.download({ requireGesture: false });
    expect(stub.spy.download).toHaveLength(1);
  });
});

describe("remote controllers — lifecycle", () => {
  it("fans state out to every connected client", async () => {
    const stub = makeStub();
    const { pair } = wire(stub.controller);
    const popup = connectController("summarizer", pair.client);
    const sidePanel = connectController("summarizer", pair.client);
    await settle();

    stub.set({ checked: true, availability: "available" });
    await settle();
    expect(popup.getSnapshot().availability).toBe("available");
    expect(sidePanel.getSnapshot().availability).toBe("available");
  });

  it("destroy() tears down only that client — never the host controller", async () => {
    const stub = makeStub();
    const { pair } = wire(stub.controller);
    const popup = connectController("summarizer", pair.client);
    const sidePanel = connectController("summarizer", pair.client);
    await settle();

    popup.destroy();
    stub.set({ checked: true, availability: "available" });
    await settle();

    expect(stub.spy.destroyed).toBe(0); // the host session survives the popup closing
    expect(sidePanel.getSnapshot().availability).toBe("available");
    expect(popup.getSnapshot().availability).toBe("downloadable"); // frozen at disconnect
  });

  it("cancels a disconnecting client's in-flight requests host-side", async () => {
    const stub = makeStub();
    stub.behavior.stream = (_params, signal) => hangAfterFirst(signal);
    const { pair } = wire(stub.controller);
    const client = connectController<TaskController<{ text: string }>>("summarizer", pair.client);

    const chunks: string[] = [];
    const done = (async () => {
      try {
        for await (const d of client.stream({ text: "x" })) chunks.push(d);
      } catch (err) {
        return err;
      }
    })();
    await settle();
    expect(chunks).toEqual(["first"]);

    client.destroy(); // the popup closed mid-stream
    expect(isAbortError(await done)).toBe(true);
    await settle();
    expect(stub.spy.streamSignals[0]?.aborted).toBe(true);
  });

  it("a destroyed client revives on reuse (React StrictMode remounts one)", async () => {
    const stub = makeStub();
    const { pair } = wire(stub.controller);
    const client = connectController("summarizer", pair.client);
    await settle();

    client.destroy();
    const seen: string[] = [];
    client.subscribe(() => seen.push(client.getSnapshot().availability));

    stub.set({ checked: true, availability: "available" });
    await settle();
    expect(seen).toContain("available");
  });

  it("requestTimeoutMs aborts a request from a client that never came back", async () => {
    const stub = makeStub();
    stub.behavior.stream = (_params, signal) => hangAfterFirst(signal);
    const pair = transportPair();
    cleanups.push(
      exposeController("summarizer", stub.controller, pair.host, { requestTimeoutMs: 10 }),
    );
    const client = connectController<TaskController<{ text: string }>>("summarizer", pair.client);

    void (async () => {
      try {
        for await (const _d of client.stream({ text: "x" })) {
          /* the client goes away here */
        }
      } catch {
        /* ignore */
      }
    })();
    await settle();
    expect(stub.spy.streamSignals[0]?.aborted).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(stub.spy.streamSignals[0]?.aborted).toBe(true);
  });

  it("the stop function ends state pushes without destroying the controller", async () => {
    const stub = makeStub();
    const { pair, stop } = wire(stub.controller);
    const client = connectController("summarizer", pair.client);
    await settle();

    stop();
    stub.set({ checked: true, availability: "available" });
    await settle();
    expect(client.getSnapshot().availability).toBe("downloadable");
    expect(stub.spy.destroyed).toBe(0);
  });
});

describe("remote controllers — over a real controller", () => {
  it("drives a real Summarizer from the client side", async () => {
    const api = makeFakeApi({ deltas: ["Sum", "mary"], availability: "available" });
    cleanups.push(installGlobal("Summarizer", api.Ctor));

    const pair = transportPair();
    const summarizer = createSummarizer({ type: "tldr" });
    cleanups.push(exposeController("summarizer", summarizer, pair.host));
    cleanups.push(() => summarizer.destroy());

    const client = connectController<TaskController<SummarizeParams>>("summarizer", pair.client);
    await expect(client.refresh()).resolves.toBe("available");
    expect(client.getSnapshot().checked).toBe(true);

    let out = "";
    for await (const delta of client.stream({ text: "a long passage" })) out += delta;
    expect(out).toBe("Summary");
    expect(api.createCount()).toBe(1);

    await expect(client.run({ text: "again" })).resolves.toBe("Summary");
    // Phase changes streamed back while it ran, and it's idle again now.
    expect(client.getSnapshot().phase).toBe("idle");
  });

  it("surfaces a real UnavailableError across the boundary", async () => {
    // No global installed: the host controller is genuinely unavailable.
    const pair = transportPair();
    const summarizer = createSummarizer();
    cleanups.push(exposeController("summarizer", summarizer, pair.host));

    const client = connectController<TaskController<SummarizeParams>>("summarizer", pair.client);
    await expect(client.run({ text: "x" })).rejects.toBeInstanceOf(UnavailableError);
    expect(client.getSnapshot().supported).toBe(false);
  });
});
