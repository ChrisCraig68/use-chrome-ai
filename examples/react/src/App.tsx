import { useState } from "react";
import { detectBrowser, isSupported } from "use-chrome-ai";
import { Chat } from "./Chat";
import { SmartTooltip } from "./SmartTooltip";
import { Summarize } from "./Summarize";

const TABS = {
  "Smart Tooltip": SmartTooltip,
  Chat: Chat,
  Summarizer: Summarize,
} as const;

type TabName = keyof typeof TABS;

export function App() {
  const [tab, setTab] = useState<TabName>("Smart Tooltip");
  const Active = TABS[tab];
  const supported = isSupported();

  return (
    <div className="app">
      <header className="brand">
        <h1>use-chrome-ai</h1>
      </header>
      <p className="lede">
        Headless primitives for the browsers' built-in AI. These demos use the React hooks — the
        same core also powers the <a href="vue/">Vue adapter →</a>
      </p>

      {!supported && (
        <div className="banner">
          Built-in AI globals weren't detected in this browser. The demos still render, but AI
          actions show the <b>unavailable</b> fallback. Use a desktop browser with built-in AI
          enabled (Chrome or Edge) — see{" "}
          <a
            href={
              detectBrowser() === "edge"
                ? "https://learn.microsoft.com/en-us/microsoft-edge/web-platform/prompt-api"
                : "https://developer.chrome.com/docs/ai/get-started"
            }
            target="_blank"
            rel="noreferrer"
          >
            the setup guide for your browser
          </a>
          .
        </div>
      )}

      <nav className="tabs" role="tablist">
        {(Object.keys(TABS) as TabName[]).map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={name === tab}
            className="tab"
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </nav>

      <Active />
    </div>
  );
}
