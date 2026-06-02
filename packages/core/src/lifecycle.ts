import { normalizeAvailability } from "./availability";
import { drainStream, isAbortError } from "./stream";
import {
  ActivationRequiredError,
  type Availability,
  type ControllerState,
  type Phase,
  type Store,
  UnavailableError,
} from "./types";

/** A Chrome built-in AI global class: static `availability()` + `create()`. */
export interface AiCtor<TSession> {
  availability?: (opts?: unknown) => Promise<string>;
  create: (opts?: unknown) => Promise<TSession>;
}

export interface LifecycleConfig<TSession> {
  /** Human-facing name for errors, e.g. "Summarizer". */
  api: string;
  /** Lazily read the global class (returns undefined when unsupported). */
  getCtor: () => AiCtor<TSession> | undefined;
  /** Options passed to `create()`. Must be a superset of `availabilityOptions()`. */
  createOptions: () => Record<string, unknown>;
  /** Options passed to `availability()`. The spec requires the SAME options used
   *  for `create()` (availability is option-specific, e.g. per language pair). */
  availabilityOptions?: () => Record<string, unknown> | undefined;
}

/** The lifecycle/state methods every controller shares (the framework-agnostic seam). */
export interface BaseController extends Store<ControllerState> {
  refresh(): Promise<Availability>;
  warm(opts?: { signal?: AbortSignal }): Promise<unknown>;
  /** Gesture-friendly alias for `warm()` — name it in click handlers to start a download. */
  download(opts?: { signal?: AbortSignal }): Promise<unknown>;
  invalidate(): void;
  destroy(): void;
}

/** A request/response + streaming controller (Summarizer, Writer, Rewriter, Translator). */
export interface TaskController<TParams> extends BaseController {
  run(params: TParams, signal?: AbortSignal): Promise<string>;
  stream(params: TParams, signal?: AbortSignal): AsyncGenerator<string>;
}

const SERVER_STATE: ControllerState = Object.freeze({
  supported: false,
  availability: "unavailable" as const,
  phase: "idle" as const,
  downloadProgress: 0,
  error: null,
});

/** Whether there's a transient user activation right now. Chrome requires one to
 *  *start* a model download. Missing API (non-Chromium) → assume true so we never
 *  block on a browser that wouldn't gate downloads anyway. */
function hasUserActivation(): boolean {
  const ua = (globalThis as { navigator?: { userActivation?: { isActive?: boolean } } }).navigator
    ?.userActivation;
  return ua && typeof ua.isActive === "boolean" ? ua.isActive : true;
}

/**
 * Shared lifecycle for every Chrome AI session: `availability()` → `create({monitor})`
 * → cached session, with download-progress reporting and eviction recovery. This is
 * the generalized, `chrome.*`-free port of the source extension's `BaseAdapter`.
 *
 * It is a `useSyncExternalStore`-shaped observable: `subscribe`/`getSnapshot` let any
 * framework bind to status with near-zero glue.
 */
export class SessionLifecycle<TSession> implements Store<ControllerState> {
  private current: TSession | null = null;
  /** In-flight `create()` so concurrent `warm()` calls dedupe into one download. */
  private creating: Promise<TSession> | null = null;
  private readonly listeners = new Set<() => void>();
  private state: ControllerState;
  private checked = false;

  constructor(private readonly config: LifecycleConfig<TSession>) {
    const supported = config.getCtor() !== undefined;
    this.state = Object.freeze({
      supported,
      availability: supported ? "downloadable" : "unavailable",
      phase: "idle",
      downloadProgress: 0,
      error: null,
    });
  }

  // ---- Store seam (bind via useSyncExternalStore) ----
  subscribe = (onChange: () => void): (() => void) => {
    this.listeners.add(onChange);
    return () => {
      this.listeners.delete(onChange);
    };
  };
  getSnapshot = (): ControllerState => this.state;
  getServerSnapshot = (): ControllerState => SERVER_STATE;

  /** The live cached session, or null. For power users via the escape hatch. */
  get session(): TSession | null {
    return this.current;
  }

  private update(patch: Partial<ControllerState>): void {
    // Replace the frozen object wholesale — a stray in-place mutation or a getter
    // that returns a fresh object would make useSyncExternalStore loop forever.
    this.state = Object.freeze({ ...this.state, ...patch });
    for (const fn of this.listeners) fn();
  }

  setPhase(phase: Phase): void {
    if (this.state.phase !== phase) this.update({ phase });
  }

  setError(error: unknown): void {
    this.update({ phase: "error", error: error instanceof Error ? error : new Error(String(error)) });
  }

  /** Ported `availability()`. Calls the static availability with the SAME options
   *  `create()` will use, normalizes the result, and never throws. */
  async refresh(): Promise<Availability> {
    const Ctor = this.config.getCtor();
    if (!Ctor) {
      this.checked = true;
      this.update({ supported: false, availability: "unavailable" });
      return "unavailable";
    }
    if (!Ctor.availability) {
      // Some APIs may not expose availability(); assume downloadable and let create() decide.
      this.checked = true;
      this.update({ supported: true });
      return this.state.availability;
    }
    try {
      const raw = await Ctor.availability(this.config.availabilityOptions?.());
      const availability = normalizeAvailability(String(raw));
      this.checked = true;
      this.update({ supported: true, availability, error: null });
      return availability;
    } catch (err) {
      this.checked = true;
      this.update({
        availability: "unavailable",
        error: err instanceof Error ? err : new Error(String(err)),
      });
      return "unavailable";
    }
  }

  /**
   * Ensure a live session exists, creating (and downloading) it if needed. Concurrent
   * calls dedupe. Throws {@link ActivationRequiredError} when a download is needed but
   * there's no user gesture — so a model never silently fails to download from an effect.
   */
  async warm(opts: { signal?: AbortSignal } = {}): Promise<TSession> {
    opts.signal?.throwIfAborted();
    if (this.current) return this.current;
    if (this.creating) return this.creating;

    const Ctor = this.config.getCtor();
    if (!Ctor) throw new UnavailableError(this.config.api);
    if (!this.checked) await this.refresh();
    // Re-check after the async refresh: a concurrent warm() may have started creating.
    if (this.current) return this.current;
    if (this.creating) return this.creating;
    if (this.state.availability === "unavailable") throw new UnavailableError(this.config.api);
    // Only the first download needs a gesture. If the model is already downloaded
    // ('available') or a download is in progress ('downloading'), create() is fine.
    if (this.state.availability === "downloadable" && !hasUserActivation()) {
      throw new ActivationRequiredError(this.config.api);
    }

    this.creating = this.create(Ctor, opts.signal);
    return this.creating;
  }

  download(opts: { signal?: AbortSignal } = {}): Promise<TSession> {
    return this.warm(opts);
  }

  private async create(Ctor: AiCtor<TSession>, signal?: AbortSignal): Promise<TSession> {
    if (this.state.availability !== "available") this.update({ phase: "creating" });
    const options = {
      ...this.config.createOptions(),
      ...(signal ? { signal } : {}),
      monitor: (m: EventTarget) => {
        m.addEventListener("downloadprogress", (e) => {
          const loaded = (e as ProgressEvent).loaded;
          this.update({
            phase: "creating",
            availability: "downloading",
            downloadProgress: typeof loaded === "number" ? loaded : this.state.downloadProgress,
          });
        });
      },
    };
    try {
      const session = await Ctor.create(options);
      this.current = session;
      this.update({ availability: "available", phase: "idle", downloadProgress: 1, error: null });
      return session;
    } catch (err) {
      this.update({ phase: "error", error: err instanceof Error ? err : new Error(String(err)) });
      throw err;
    } finally {
      this.creating = null;
    }
  }

  /**
   * Drop the cached session and re-check availability. Chrome can evict the on-device
   * model at any time — "even mid-session, without regard for running prompts" — leaving
   * our handle dead. Call this on any non-abort failure of a session method.
   */
  invalidate(): void {
    const s = this.current as { destroy?: () => void } | null;
    try {
      s?.destroy?.();
    } catch {
      // The session may already be torn down by the eviction itself.
    }
    this.current = null;
    void this.refresh();
  }

  destroy(): void {
    const s = this.current as { destroy?: () => void } | null;
    try {
      s?.destroy?.();
    } catch {
      // ignore
    }
    this.current = null;
    this.listeners.clear();
  }
}

/** Expose the lifecycle's framework-agnostic surface (without the per-API methods). */
export function store<TSession>(life: SessionLifecycle<TSession>): BaseController {
  return {
    subscribe: life.subscribe,
    getSnapshot: life.getSnapshot,
    getServerSnapshot: life.getServerSnapshot,
    refresh: () => life.refresh(),
    warm: (opts) => life.warm(opts),
    download: (opts) => life.download(opts),
    invalidate: () => life.invalidate(),
    destroy: () => life.destroy(),
  };
}

/** Non-streaming call wrapper: warm → run → (on real failure) invalidate + record error. */
export async function runCall<TSession, R>(
  life: SessionLifecycle<TSession>,
  call: (session: TSession) => Promise<R>,
  signal?: AbortSignal,
): Promise<R> {
  signal?.throwIfAborted();
  const session = await life.warm(signal ? { signal } : {});
  life.setPhase("running");
  try {
    return await call(session);
  } catch (err) {
    if (!isAbortError(err)) {
      life.invalidate();
      life.setError(err);
    }
    throw err;
  } finally {
    if (life.getSnapshot().phase === "running") life.setPhase("idle");
  }
}

/** Streaming call wrapper: warm → drain → (on real failure) invalidate. AbortError is
 *  rethrown without invalidating. `oneOff`, if given, is used instead of the cached
 *  session and destroyed afterwards (for ad-hoc sessions like a clone). */
export async function* streamCall<TSession>(
  life: SessionLifecycle<TSession>,
  make: (session: TSession) => ReadableStream<string>,
  signal?: AbortSignal,
  oneOff?: TSession,
): AsyncGenerator<string> {
  signal?.throwIfAborted();
  const session = oneOff ?? (await life.warm(signal ? { signal } : {}));
  life.setPhase("streaming");
  try {
    yield* drainStream(make(session));
  } catch (err) {
    if (!isAbortError(err)) {
      life.invalidate();
      life.setError(err);
    }
    throw err;
  } finally {
    if (life.getSnapshot().phase === "streaming") life.setPhase("idle");
    if (oneOff) (oneOff as { destroy?: () => void }).destroy?.();
  }
}
