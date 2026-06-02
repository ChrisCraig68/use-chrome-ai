import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useChat } from "../src/useChat";
import { useSummarizer } from "../src/useSummarizer";
import { installGlobal, makeFakeApi } from "./helpers";

const cleanups: Array<() => void> = [];
afterEach(() => {
  cleanup();
  while (cleanups.length) cleanups.pop()?.();
  vi.restoreAllMocks();
});

function ChatProbe() {
  const { messages, send, isUnavailable } = useChat({ system: "sys" });
  return (
    <div>
      <span data-testid="unavailable">{String(isUnavailable)}</span>
      <button type="button" onClick={() => send("hi")}>
        send
      </button>
      <ul>
        {messages.map((m, i) => (
          <li key={i} data-testid="msg">
            {m.role}:{m.content}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SummarizerProbe() {
  const { summarize, result } = useSummarizer();
  return (
    <div>
      <button type="button" onClick={() => summarize("a long passage")}>
        go
      </button>
      <p data-testid="result">{result}</p>
    </div>
  );
}

describe("React hooks", () => {
  it("useChat streams a reply into the rendered transcript", async () => {
    const api = makeFakeApi({ deltas: ["Hel", "lo"] });
    cleanups.push(installGlobal("LanguageModel", api.Ctor));

    render(<ChatProbe />);
    expect(screen.getByTestId("unavailable").textContent).toBe("false");

    fireEvent.click(screen.getByText("send"));

    await waitFor(() => {
      const msgs = screen.getAllByTestId("msg").map((n) => n.textContent);
      expect(msgs).toContain("user:hi");
      expect(msgs).toContain("assistant:Hello");
    });
  });

  it("useChat reports unavailable (no throw) when built-in AI is absent", () => {
    // No global installed.
    render(<ChatProbe />);
    expect(screen.getByTestId("unavailable").textContent).toBe("true");
  });

  it("useSummarizer streams into result", async () => {
    const api = makeFakeApi({ deltas: ["Sum", "mary"] });
    cleanups.push(installGlobal("Summarizer", api.Ctor));
    render(<SummarizerProbe />);
    fireEvent.click(screen.getByText("go"));
    await waitFor(() => expect(screen.getByTestId("result").textContent).toBe("Summary"));
  });
});
