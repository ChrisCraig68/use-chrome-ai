// A complete on-device chatbot in React. Copy into any Vite/Next/CRA app.
// (Styling is plain CSS classes from examples/styles.css — the library ships no UI.)
import { useChat } from "@use-chrome-ai/react";

export function Chat() {
  const {
    messages,
    input,
    setInput,
    send,
    stop,
    reset,
    isStreaming,
    error,
    availability,
    isUnavailable,
    isDownloading,
    downloadProgress,
    download,
  } = useChat({ system: "You are a concise, friendly assistant." });

  if (isUnavailable) {
    return (
      <div className="card">
        <p className="muted" style={{ margin: 0 }}>
          On-device AI isn't available in this browser. Try desktop Chrome 138+.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      {availability === "downloadable" && (
        <button type="button" className="btn btn-primary" onClick={() => download()}>
          Enable on-device AI
        </button>
      )}
      {isDownloading && (
        <div className="progress-row" style={{ marginBottom: 12 }}>
          Downloading model… <progress value={downloadProgress} max={1} />
        </div>
      )}

      <div className="thread">
        {messages.length === 0 && (
          <div className="empty">Ask anything — it runs entirely on your device.</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`row ${m.role}`}>
            <div className={`avatar ${m.role === "user" ? "me" : "ai"}`}>
              {m.role === "user" ? "Me" : "AI"}
            </div>
            <div className={`bubble ${m.role}`}>
              {m.content || (isStreaming && i === messages.length - 1 ? <span className="blink">▋</span> : null)}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="error">{error.message}</p>}

      <form className="composer" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <input
          className="field"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. Draft a polite reply declining a meeting invite"
          disabled={isStreaming}
        />
        {isStreaming ? (
          <button type="button" className="btn" onClick={stop}>Stop</button>
        ) : (
          <button type="submit" className="btn btn-primary" disabled={!input.trim()}>Send</button>
        )}
        {messages.length > 0 && !isStreaming && (
          <button type="button" className="btn" onClick={reset}>Reset</button>
        )}
      </form>
    </div>
  );
}
