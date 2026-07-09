/** True for the `AbortError` thrown when a request is cancelled or superseded.
 *  This is expected control flow, NOT a model failure — callers must not treat it
 *  as a reason to invalidate (evict) the cached session. */
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

/** Read a `ReadableStream<string>` to completion, yielding each chunk. Every
 *  built-in AI streaming method (`promptStreaming`, `summarizeStreaming`, …) returns
 *  one of these; this is the single place we turn it into an async iterable. */
export async function* drainStream(stream: ReadableStream<string>): AsyncGenerator<string> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return;
      if (value) yield value;
    }
  } finally {
    reader.releaseLock();
  }
}
