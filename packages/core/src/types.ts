/** Normalized availability of an on-device model — what `X.availability()` reports.
 *  Independent of what *this* controller is currently doing (see {@link Phase}). */
export type Availability = "unavailable" | "downloadable" | "downloading" | "available";

/** What a single controller is doing right now. Orthogonal to {@link Availability}:
 *  e.g. a model can be `availability: 'available'` while `phase: 'streaming'`. */
export type Phase = "idle" | "creating" | "running" | "streaming" | "error";

/** The observable state every controller exposes via `getSnapshot()`. Frozen and
 *  replaced wholesale on every change so `useSyncExternalStore` never tears or loops. */
export interface ControllerState {
  /** The underlying global class (e.g. `Summarizer`) exists in this environment. */
  readonly supported: boolean;
  /** Whether `availability()` has resolved at least once. Until then `availability` is an
   *  optimistic guess — gate UI on this (or {@link ModelStatus.isChecking}) to avoid
   *  flashing a download CTA for a model that's actually already installed. */
  readonly checked: boolean;
  readonly availability: Availability;
  readonly phase: Phase;
  /** 0..1, meaningful while a model is downloading (first `create()`). */
  readonly downloadProgress: number;
  readonly error: Error | null;
}

/** Options for an explicit model download (`download()` / {@link ModelStatus.download}). */
export interface DownloadOptions {
  /** Abort the download (and the underlying `create()`). */
  signal?: AbortSignal;
  /**
   * Whether to require a transient user activation (`navigator.userActivation.isActive`)
   * in *this* document before starting the download. Defaults to `true`.
   *
   * Set it to `false` only when the gesture was already verified on the other side of a
   * message boundary — the canonical case being a Chrome extension **offscreen document**,
   * which owns the AI session but where a popup/side-panel click's activation does not
   * propagate (so `isActive` is `false` there even though the browser would start the
   * download). This is a deliberate opt-out for that cross-document pattern, not a general
   * license to auto-download multi-GB weights. `warm()` never downloads regardless. */
  requireGesture?: boolean;
}

/** A UI-friendly view of a controller's model lifecycle: the raw snapshot, derived
 *  booleans, download progress, and the gesture-gated download trigger. Framework
 *  adapters group these under a single `model` field so a hook's own surface stays small. */
export interface ModelStatus {
  /** The full controller snapshot — escape hatch for `phase` / `error`. */
  status: ControllerState;
  availability: Availability;
  /** 0..1, meaningful while a model is downloading. */
  progress: number;
  /** The API's global class exists in this browser. */
  supported: boolean;
  /** Not supported here, or availability is `unavailable`. Render a fallback. */
  isUnavailable: boolean;
  /** Availability hasn't been resolved yet (first `availability()` round-trip still
   *  pending). Show a neutral "checking" state rather than committing to a download CTA. */
  isChecking: boolean;
  /** A model download is in progress. */
  isDownloading: boolean;
  /** The model is downloaded and ready to use. */
  isReady: boolean;
  /** Start the model download. Call from a click/tap handler (the browser needs a gesture).
   *  Pass `{ requireGesture: false }` only when the gesture was verified across a message
   *  boundary (e.g. an extension offscreen document) — see {@link DownloadOptions}. */
  download: (opts?: DownloadOptions) => Promise<unknown>;
}

/** Build a {@link ModelStatus} view from a controller snapshot and its `download` trigger.
 *  Shared by the React and Vue adapters so the derivation lives in exactly one place. */
export function deriveModelStatus(
  status: ControllerState,
  download: (opts?: DownloadOptions) => Promise<unknown>,
): ModelStatus {
  return {
    status,
    availability: status.availability,
    progress: status.downloadProgress,
    supported: status.supported,
    isUnavailable: !status.supported || status.availability === "unavailable",
    isChecking: status.supported && !status.checked,
    isDownloading: status.phase === "creating" || status.availability === "downloading",
    isReady: status.availability === "available",
    download,
  };
}

/** The minimal store contract a UI framework binds to. Matches React's
 *  `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` exactly. */
export interface Store<S> {
  subscribe(onChange: () => void): () => void;
  /** Returns the SAME reference until a real change — required by useSyncExternalStore. */
  getSnapshot(): S;
  /** Stable "unavailable" snapshot for SSR (no AI globals on the server). */
  getServerSnapshot(): S;
}

export class BuiltInAiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BuiltInAiError";
  }
}

/** @deprecated Renamed {@link BuiltInAiError} — the APIs ship in more browsers than
 *  Chrome (Edge implements them too). Same class; `instanceof` works with either name.
 *  Note `error.name` is now `"BuiltInAiError"`. */
export const ChromeAiError = BuiltInAiError;
/** @deprecated Renamed {@link BuiltInAiError}. */
export type ChromeAiError = BuiltInAiError;

/** The API's global class is absent, or `availability()` reports `unavailable`.
 *  Built-in AI ships in desktop Chromium browsers (Chrome, Edge); each API reaches
 *  each browser on its own schedule, and some are flag/origin-trial gated. */
export class UnavailableError extends BuiltInAiError {
  constructor(public readonly api: string) {
    super(
      `${api} is not available here. It requires a desktop browser with built-in AI (e.g. recent Chrome or Edge); each API ships on its own schedule and may also need a flag or origin-trial token.`,
    );
    this.name = "UnavailableError";
  }
}

/** The model still needs to download (multi-GB) before this API can run. A normal call
 *  never starts that download — call `download()` explicitly, from a click/tap handler
 *  (the browser only starts the download from a user gesture). */
export class ActivationRequiredError extends BuiltInAiError {
  constructor(public readonly api: string) {
    super(
      `${api} needs its model downloaded first. Call download() from a click/tap handler (the browser only starts the download from a user gesture); a normal call will not auto-download.`,
    );
    this.name = "ActivationRequiredError";
  }
}

/** A chat exceeded the model's context window (mapped from `QuotaExceededError`).
 *  The session is unusable; call `reset()` to start a fresh conversation. */
export class ContextFullError extends BuiltInAiError {
  constructor() {
    super(
      "The chat exceeded the model's context window. Call reset() to start a new conversation.",
    );
    this.name = "ContextFullError";
  }
}
