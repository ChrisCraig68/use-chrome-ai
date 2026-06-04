import { useSummarizer } from "@use-chrome-ai/react";
import { useState } from "react";

const SAMPLE = `Researchers at Stanford this week described a new battery chemistry that could
meaningfully extend the range of electric vehicles. The design replaces the graphite anode used
in most lithium-ion cells with a silicon-based material that stores far more charge by weight.
In lab tests, prototype cells kept more than 80 percent of their capacity after 1,000 charging
cycles — addressing the durability problem that has long held silicon anodes back, since they
tend to crack as they expand and contract. The team estimates that, at mass-production scale,
the approach could cut cost per kilowatt-hour while adding roughly 20 percent more driving range.
Several manufacturers have already licensed the patent, though the researchers caution that
commercial cells are probably still three to five years away. Independent experts called the
results promising but stressed that lab durability often degrades once cells are built at full
size and subjected to real-world temperatures and fast charging.`;

export function Summarize() {
  const [text, setText] = useState(SAMPLE);
  const [type, setType] = useState<"tldr" | "key-points">("key-points");

  const { summarize, result, isStreaming, model } = useSummarizer({ type, length: "short" });

  if (model.isUnavailable) {
    return (
      <div className="panel">
        <p className="error" style={{ margin: 0 }}>
          The Summarizer API isn't available in this browser.
        </p>
      </div>
    );
  }

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <textarea className="field" value={text} onChange={(e) => setText(e.target.value)} rows={6} />

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <select
          className="field"
          style={{ width: "auto" }}
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
        >
          <option value="key-points">Key points</option>
          <option value="tldr">TL;DR</option>
        </select>

        {!model.isChecking && model.availability === "downloadable" ? (
          <button type="button" className="btn btn-primary" onClick={() => model.download()}>
            Enable on-device AI
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => summarize(text)}
            disabled={!model.isReady || isStreaming}
          >
            {isStreaming ? "Summarizing…" : "Summarize"}
          </button>
        )}
      </div>

      {model.isDownloading && (
        <div className="progress-row">
          Downloading model… <progress value={model.progress} max={1} />
        </div>
      )}

      {(result || isStreaming) && (
        <div className="result">
          {result}
          {isStreaming && <span className="blink">▋</span>}
        </div>
      )}
    </div>
  );
}
