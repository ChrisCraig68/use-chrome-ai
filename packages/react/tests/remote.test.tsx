import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import {
  connectController,
  createSummarizer,
  exposeController,
  type SummarizeParams,
  type TaskController,
  type Transport,
} from "use-chrome-ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAiController } from "../src/useAiController";
import { installGlobal, makeFakeApi, setUserActivation, transportPair } from "./helpers";

const cleanups: Array<() => void> = [];
afterEach(() => {
  cleanup();
  while (cleanups.length) cleanups.pop()?.();
  vi.restoreAllMocks();
});

/**
 * The UI half of an extension: a side panel with no AI globals of its own, bound to a
 * controller living in the offscreen document. No hook code changes — `useAiController`
 * owns the proxy exactly as it would a local controller.
 */
function RemoteProbe({ transport }: { transport: Transport }) {
  const { model, controller } = useAiController(
    () => connectController<TaskController<SummarizeParams>>("summarizer", transport),
    "remote-summarizer",
  );
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  return (
    <div>
      <span data-testid="availability">{model.availability}</span>
      <span data-testid="checking">{String(model.isChecking)}</span>
      <span data-testid="progress">{model.progress}</span>
      <button
        type="button"
        onClick={async () => {
          let acc = "";
          for await (const delta of controller.stream({ text: "a long passage" })) {
            acc += delta;
            setResult(acc);
          }
        }}
      >
        summarize
      </button>
      <button
        type="button"
        onClick={() => {
          // Core rejects (imperative control); a real UI decides what to show.
          model.download().catch((err: Error) => setError(err.name));
        }}
      >
        download
      </button>
      <p data-testid="result">{result}</p>
      <p data-testid="error">{error}</p>
    </div>
  );
}

/** Stand up the host half (offscreen document) over an in-memory transport pair. */
function offscreen(opts: Parameters<typeof makeFakeApi>[0] = {}) {
  const api = makeFakeApi(opts);
  cleanups.push(installGlobal("Summarizer", api.Ctor));
  const pair = transportPair();
  const summarizer = createSummarizer();
  cleanups.push(exposeController("summarizer", summarizer, pair.host));
  cleanups.push(() => summarizer.destroy());
  return { api, transport: pair.client };
}

describe("React hooks over a remote controller", () => {
  it("shows 'checking' until the host's state arrives, then syncs", async () => {
    const { api, transport } = offscreen({ availability: "available" });

    render(<RemoteProbe transport={transport} />);
    // Nothing has crossed the boundary yet — neutral, not a download CTA.
    expect(screen.getByTestId("checking").textContent).toBe("true");

    await waitFor(() => expect(screen.getByTestId("availability").textContent).toBe("available"));
    expect(screen.getByTestId("checking").textContent).toBe("false");
    // The mount-time refresh() ran on the host, and opened no session.
    expect(api.Ctor.availability).toHaveBeenCalled();
    expect(api.createCount()).toBe(0);
  });

  it("streams from the host into React state", async () => {
    const { api, transport } = offscreen({ deltas: ["Sum", "mary"] });
    render(<RemoteProbe transport={transport} />);

    fireEvent.click(screen.getByText("summarize"));

    await waitFor(() => expect(screen.getByTestId("result").textContent).toBe("Summary"));
    expect(api.lastSession()?.summarizeStreaming).toHaveBeenCalled();
  });

  it("gates download() on the gesture in THIS document and downloads on the host", async () => {
    // The click happens here; the offscreen document has no activation of its own, so
    // the proxy checks locally and tells the host to skip its check.
    cleanups.push(setUserActivation(true));
    const { api, transport } = offscreen({ availability: "downloadable", emitProgress: [0.5] });
    render(<RemoteProbe transport={transport} />);
    await waitFor(() =>
      expect(screen.getByTestId("availability").textContent).toBe("downloadable"),
    );

    fireEvent.click(screen.getByText("download"));

    await waitFor(() => expect(screen.getByTestId("availability").textContent).toBe("available"));
    expect(api.createCount()).toBe(1);
    expect(screen.getByTestId("progress").textContent).toBe("1");
  });

  it("refuses download() without a gesture in the UI document", async () => {
    cleanups.push(setUserActivation(false));
    const { api, transport } = offscreen({ availability: "downloadable" });
    render(<RemoteProbe transport={transport} />);
    await waitFor(() =>
      expect(screen.getByTestId("availability").textContent).toBe("downloadable"),
    );

    fireEvent.click(screen.getByText("download"));

    await waitFor(() =>
      expect(screen.getByTestId("error").textContent).toBe("ActivationRequiredError"),
    );
    expect(api.createCount()).toBe(0);
    expect(screen.getByTestId("availability").textContent).toBe("downloadable");
  });
});
