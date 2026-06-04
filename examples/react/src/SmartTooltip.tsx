import { usePrompt } from "@use-chrome-ai/react";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";

/**
 * Smart tooltip: highlight any text in the passage and a popover appears next to the
 * selection with on-device AI actions that stream their answer inline. The whole thing
 * is one `usePrompt` hook + a bit of selection/positioning glue — no UI library.
 */

interface Selection {
  text: string;
  rect: DOMRect;
}

const ACTIONS: Array<{ label: string; build: (text: string) => string }> = [
  {
    label: "Explain",
    build: (t) => `Explain the following in one or two plain sentences:\n\n"""${t}"""`,
  },
  {
    label: "Simplify",
    build: (t) =>
      `Explain the following in the simplest possible terms, with no jargon, in one short paragraph:\n\n"""${t}"""`,
  },
  {
    label: "Key points",
    build: (t) => `Summarize the following as 2–4 short bullet points:\n\n"""${t}"""`,
  },
];

const PASSAGE = `The Federal Reserve raised its benchmark interest rate by a quarter point on
Wednesday, lifting the federal funds rate to its highest level in more than two decades.
Policymakers signaled they remain prepared to tighten further if inflation — which has cooled
from its 2022 peak but still runs above the central bank's 2 percent target — fails to keep
falling. Higher rates ripple through the economy by raising borrowing costs on mortgages, car
loans, and corporate debt, which tends to dampen hiring and business investment. Critics warn
that moving too aggressively risks tipping the economy into a recession, while the Fed counters
that allowing inflation to become entrenched would be far more painful to unwind later.`;

export function SmartTooltip() {
  const { prompt, result, isStreaming, model, stop } = usePrompt({
    system: "You are a concise explainer. Answer briefly and clearly.",
  });

  const [selection, setSelection] = useState<Selection | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const passageRef = useRef<HTMLParagraphElement>(null);

  const onMouseUp = useCallback(() => {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    if (!text || !sel || sel.rangeCount === 0) {
      return;
    }
    const range = sel.getRangeAt(0);
    if (passageRef.current && !passageRef.current.contains(range.commonAncestorContainer)) {
      return;
    }
    // A new selection opens a fresh tooltip: abort any in-flight stream and clear the
    // previous answer so stale text from the last selection never lingers.
    stop();
    setActive(null);
    setSelection({ text, rect: range.getBoundingClientRect() });
  }, [stop]);

  // Dismiss on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelection(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const run = (label: string, build: (text: string) => string) => {
    if (!selection) return;
    setActive(label);
    // The model is already downloaded by now — the download CTA gates these actions — so this just runs.
    void prompt(build(selection.text));
  };

  return (
    <div className="card">
      <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
        Select any text in the passage below — a smart tooltip appears with on-device AI actions.
      </p>

      <p ref={passageRef} onMouseUp={onMouseUp} className="passage">
        {PASSAGE}
      </p>

      {selection && (
        <div
          className="popover"
          style={popoverPosition(selection.rect)}
          onMouseDown={(e) => e.preventDefault()}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <span className="badge">Smart tooltip</span>
            <button type="button" className="icon-btn" onClick={() => setSelection(null)}>
              ✕
            </button>
          </div>

          {model.isUnavailable ? (
            <p className="error" style={{ margin: 0 }}>
              On-device AI isn't available in this browser.
            </p>
          ) : model.availability === "downloadable" ? (
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: "100%" }}
              onClick={() => model.download()}
            >
              Enable on-device AI (downloads the model)
            </button>
          ) : (
            <>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {ACTIONS.map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    className={`btn btn-sm ${active === a.label ? "btn-primary" : ""}`}
                    disabled={isStreaming || !model.isReady}
                    onClick={() => run(a.label, a.build)}
                  >
                    {a.label}
                  </button>
                ))}
              </div>

              {model.isDownloading && (
                <div className="progress-row" style={{ marginTop: 10 }}>
                  Downloading model… <progress value={model.progress} max={1} />
                </div>
              )}

              {active && (result || isStreaming) && (
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: "1px solid var(--border)",
                    fontSize: 14,
                    lineHeight: 1.55,
                    whiteSpace: "pre-wrap",
                    maxHeight: 200,
                    overflow: "auto",
                  }}
                >
                  {result}
                  {isStreaming && <span className="blink">▋</span>}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function popoverPosition(rect: DOMRect): CSSProperties {
  const width = 340;
  return {
    position: "fixed",
    top: Math.min(rect.bottom + 8, window.innerHeight - 260),
    left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
    width,
    zIndex: 1000,
  };
}
