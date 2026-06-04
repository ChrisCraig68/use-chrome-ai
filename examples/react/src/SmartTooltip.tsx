import { usePrompt } from "@use-chrome-ai/react";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";

/**
 * Smart tooltip: highlight any text in the passage and a popover appears next to the
 * selection. It explains the selection on-device immediately — no extra click — and
 * streams the answer inline. Retry re-runs the current action; Simplify and Key points
 * swap to a different prompt on the same selection. One `usePrompt` hook + a little
 * selection/positioning glue — no UI library.
 */

interface Selection {
  text: string;
  rect: DOMRect;
}

const DEFAULT_ACTION = {
  label: "Explain",
  build: (t: string) => `Explain the following in one or two plain sentences:\n\n"""${t}"""`,
};

const ALT_ACTIONS = [
  {
    label: "Simplify",
    build: (t: string) =>
      `Explain the following in the simplest possible terms, with no jargon, in one short paragraph:\n\n"""${t}"""`,
  },
  {
    label: "Key points",
    build: (t: string) => `Summarize the following as 2–4 short bullet points:\n\n"""${t}"""`,
  },
];

const ALL_ACTIONS = [DEFAULT_ACTION, ...ALT_ACTIONS];

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
  const [active, setActive] = useState<string>(DEFAULT_ACTION.label);
  const passageRef = useRef<HTMLParagraphElement>(null);
  const autoRanFor = useRef<Selection | null>(null);

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
    // A new selection opens a fresh tooltip: abort any in-flight stream so stale text from
    // the previous selection never lingers, then let the effect below auto-run Explain.
    stop();
    setSelection({ text, rect: range.getBoundingClientRect() });
  }, [stop]);

  const runAction = useCallback(
    (label: string, text: string) => {
      const action = ALL_ACTIONS.find((a) => a.label === label) ?? DEFAULT_ACTION;
      setActive(label);
      void prompt(action.build(text));
    },
    [prompt],
  );

  // Auto-run Explain as soon as a new selection is made and the model is ready (covers
  // both "ready immediately" and "ready right after the download CTA finishes").
  useEffect(() => {
    if (!selection || !model.isReady || autoRanFor.current === selection) {
      return;
    }
    autoRanFor.current = selection;
    runAction(DEFAULT_ACTION.label, selection.text);
  }, [selection, model.isReady, runAction]);

  // Dismiss on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelection(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="card">
      <p className="muted" style={{ fontSize: 15, marginTop: 0 }}>
        Select any text in the passage below — an on-device explanation appears instantly, with
        options to simplify or pull out the key points.
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
            <span className="tip-label">{active}</span>
            <button type="button" className="icon-btn" onClick={() => setSelection(null)}>
              ✕
            </button>
          </div>

          {model.isChecking ? (
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>
              Checking availability…
            </p>
          ) : model.isUnavailable ? (
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
              {model.isDownloading && (
                <div className="progress-row" style={{ marginBottom: 10 }}>
                  Downloading model… <progress value={model.progress} max={1} />
                </div>
              )}

              <div
                style={{
                  fontSize: 15,
                  lineHeight: 1.55,
                  whiteSpace: "pre-wrap",
                  maxHeight: "40vh",
                  overflow: "auto",
                }}
              >
                {result}
                {isStreaming && <span className="blink">▋</span>}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginTop: 12,
                  paddingTop: 10,
                  borderTop: "1px solid hsl(var(--border))",
                }}
              >
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={isStreaming || !model.isReady}
                  onClick={() => runAction(active, selection.text)}
                >
                  ↻ Retry
                </button>
                {ALT_ACTIONS.map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    className={`btn btn-sm ${active === a.label ? "btn-primary" : ""}`}
                    disabled={isStreaming || !model.isReady}
                    onClick={() => runAction(a.label, selection.text)}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function popoverPosition(rect: DOMRect): CSSProperties {
  const width = 340;
  const gap = 8;
  const base: CSSProperties = {
    position: "fixed",
    left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
    width,
    zIndex: 1000,
  };
  // Flip above the selection when there isn't enough room below, anchoring by `bottom`
  // so an auto-height popover grows upward and never clips at the viewport bottom.
  if (window.innerHeight - rect.bottom < 280) {
    return { ...base, bottom: Math.max(8, window.innerHeight - rect.top + gap) };
  }
  return { ...base, top: rect.bottom + gap };
}
