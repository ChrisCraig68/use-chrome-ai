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
  readonly availability: Availability;
  readonly phase: Phase;
  /** 0..1, meaningful while a model is downloading (first `create()`). */
  readonly downloadProgress: number;
  readonly error: Error | null;
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

export class ChromeAiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChromeAiError";
  }
}

/** The API's global class is absent, or `availability()` reports `unavailable`.
 *  Built-in AI is desktop-Chromium-only and (in web pages) flag/origin-trial gated. */
export class UnavailableError extends ChromeAiError {
  constructor(public readonly api: string) {
    super(
      `${api} is not available here. Chrome 138+ (desktop) with built-in AI enabled is required; in a web page the API may also need a flag or origin-trial token.`,
    );
    this.name = "UnavailableError";
  }
}

/** The model still needs to download (multi-GB) and that download must be started
 *  from a user gesture. Call `download()` (or the action) from a click/tap handler. */
export class ActivationRequiredError extends ChromeAiError {
  constructor(public readonly api: string) {
    super(
      `${api} needs to download its model, which Chrome only allows from a user gesture. Call download() (or trigger the action) from a click/tap handler.`,
    );
    this.name = "ActivationRequiredError";
  }
}

/** A chat exceeded the model's context window (mapped from `QuotaExceededError`).
 *  The session is unusable; call `reset()` to start a fresh conversation. */
export class ContextFullError extends ChromeAiError {
  constructor() {
    super("The chat exceeded the model's context window. Call reset() to start a new conversation.");
    this.name = "ContextFullError";
  }
}
