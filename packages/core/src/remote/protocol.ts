import { normalizeAvailability } from "../availability";
import {
  ActivationRequiredError,
  BuiltInAiError,
  ContextFullError,
  type ControllerState,
  type Phase,
  UnavailableError,
} from "../types";

/**
 * The only thing a remote controller needs from its host environment: a way to post a
 * message and a way to receive them. Implement it over `chrome.runtime` messaging, a
 * `MessagePort`, a `BroadcastChannel`, or a WebSocket — core stays zero-dependency and
 * never touches `chrome.*`.
 *
 * Messages must survive whatever serialization the channel applies; the protocol only
 * ever sends JSON-safe values.
 */
export interface Transport {
  send(message: unknown): void;
  /** Register a handler; returns an unsubscribe function. */
  onMessage(handler: (message: unknown) => void): () => void;
}

/** Bumped on any breaking change to the message shapes. Peers ignore other versions. */
export const PROTOCOL_VERSION = 1;

/** Every message carries the protocol version, the controller id (so one transport can
 *  carry several controllers plus unrelated traffic), and the client it belongs to.
 *  `cid: ""` means "broadcast to every client of this controller". */
export interface Envelope {
  v: number;
  id: string;
  cid: string;
}

/** Methods that resolve with a single value. */
export type CallMethod = "refresh" | "warm" | "download" | "invalidate" | "run" | "prompt";
/** Methods that yield a series of text deltas. */
export type StreamMethod = "stream" | "promptStream";

export interface CallMessage {
  t: "call";
  rid: string;
  method: CallMethod | StreamMethod;
  /** The serializable leading arguments; the host supplies the `AbortSignal` itself. */
  args: unknown[];
}

export type ClientMessage =
  | { t: "hello" }
  | CallMessage
  | { t: "cancel"; rid: string }
  /** This client is going away: cancel everything still running for it. */
  | { t: "bye" };

export type HostMessage =
  | { t: "state"; state: WireState }
  | { t: "result"; rid: string; value: unknown }
  | { t: "chunk"; rid: string; value: string }
  | { t: "done"; rid: string }
  | { t: "error"; rid: string; error: WireError };

/** Wire form of an `Error`. Error instances don't keep their class (or survive at all)
 *  across JSON messaging, so they cross as a name + message and are rebuilt on arrival. */
export interface WireError {
  name: string;
  message: string;
  /** The `api` field of {@link UnavailableError} / {@link ActivationRequiredError}. */
  api?: string;
}

/** {@link ControllerState} with `error` in its wire form. */
export interface WireState {
  supported: boolean;
  checked: boolean;
  availability: string;
  phase: Phase;
  downloadProgress: number;
  error: WireError | null;
}

export function toWireError(err: unknown): WireError {
  if (!(err instanceof Error)) return { name: "Error", message: String(err) };
  const api = (err as { api?: unknown }).api;
  return {
    name: err.name,
    message: err.message,
    ...(typeof api === "string" ? { api } : {}),
  };
}

/**
 * Rebuild the real error class so `instanceof` keeps working in client code. The typed
 * errors carry their own messages, so only `api` needs to cross for those. Anything else
 * becomes a plain `Error` with its `name` preserved.
 */
export function fromWireError(wire: WireError, api: string): Error {
  switch (wire.name) {
    // AbortError is control flow, not failure — isAbortError() tests `instanceof
    // DOMException`, so it has to come back as one.
    case "AbortError":
      return new DOMException(wire.message, "AbortError");
    case "UnavailableError":
      return new UnavailableError(wire.api ?? api);
    case "ActivationRequiredError":
      return new ActivationRequiredError(wire.api ?? api);
    case "ContextFullError":
      return new ContextFullError();
    case "BuiltInAiError":
      return new BuiltInAiError(wire.message);
    default: {
      const err = new Error(wire.message);
      err.name = wire.name;
      return err;
    }
  }
}

export function toWireState(state: ControllerState): WireState {
  return {
    supported: state.supported,
    checked: state.checked,
    availability: state.availability,
    phase: state.phase,
    downloadProgress: state.downloadProgress,
    error: state.error ? toWireError(state.error) : null,
  };
}

/** Rebuild a frozen {@link ControllerState}. Frozen because the client serves it straight
 *  out of `getSnapshot()`. */
export function fromWireState(wire: WireState, api: string): ControllerState {
  return Object.freeze({
    supported: wire.supported,
    checked: wire.checked,
    availability: normalizeAvailability(String(wire.availability)),
    phase: wire.phase,
    downloadProgress: wire.downloadProgress,
    error: wire.error ? fromWireError(wire.error, api) : null,
  });
}

/**
 * Accept a message if it belongs to this protocol version and controller. Pass `cid` on
 * the client side to also drop messages addressed to a different client (`cid: ""` is a
 * broadcast and always passes); the host omits it and accepts every client.
 */
export function parse<M extends { t: string }>(
  raw: unknown,
  id: string,
  cid?: string,
): (M & Envelope) | null {
  if (typeof raw !== "object" || raw === null) return null;
  const msg = raw as Partial<Envelope> & { t?: unknown };
  if (msg.v !== PROTOCOL_VERSION || msg.id !== id) return null;
  if (typeof msg.t !== "string" || typeof msg.cid !== "string") return null;
  if (cid !== undefined && msg.cid !== "" && msg.cid !== cid) return null;
  return raw as M & Envelope;
}
