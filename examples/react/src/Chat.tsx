// A complete on-device chatbot in React. Copy into any Vite/Next/CRA app.
// (Styling is plain CSS classes from examples/styles.css — the library ships no UI.)
import { useChat } from "@use-chrome-ai/react";

export function Chat() {
  const { messages, input, setInput, send, stop, reset, isStreaming, error, model } = useChat({
    system: "You are a concise, friendly assistant.",
  });

  if (model.isUnavailable) {
    return (
      <div className="panel">
        <p className="muted" style={{ margin: 0 }}>
          On-device AI isn't available in this browser. Try desktop Chrome 138+.
        </p>
      </div>
    );
  }

  return (
    <div className="panel">
      {!model.isChecking && model.availability === "downloadable" && (
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginBottom: 12 }}
          onClick={() => model.download()}
        >
          Enable on-device AI
        </button>
      )}
      {model.isDownloading && (
        <div className="progress-row" style={{ marginBottom: 12 }}>
          Downloading model… <progress value={model.progress} max={1} />
        </div>
      )}

      <div className="chat-window">
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
                {m.content ||
                  (isStreaming && i === messages.length - 1 ? (
                    <span className="blink">▋</span>
                  ) : null)}
              </div>
            </div>
          ))}
        </div>

        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            className="field"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. Draft a polite reply declining a meeting invite"
            disabled={isStreaming || !model.isReady}
          />
          {isStreaming ? (
            <button type="button" className="btn" onClick={stop}>
              Stop
            </button>
          ) : (
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!input.trim() || !model.isReady}
            >
              Send
            </button>
          )}
          {messages.length > 0 && !isStreaming && (
            <button type="button" className="btn" onClick={reset}>
              Reset
            </button>
          )}
        </form>
      </div>

      {error && (
        <p className="error" style={{ marginTop: 10 }}>
          {error.message}
        </p>
      )}
    </div>
  );
}
