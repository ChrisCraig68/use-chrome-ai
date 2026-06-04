import { useState } from "react";
import { isSupported } from "use-chrome-ai";
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
        <span className="dot" />
        <h1>use-chrome-ai</h1>
        <span className="badge">on-device</span>
      </header>
      <p className="lede">
        Headless primitives for Chrome's built-in AI. These demos use the React hooks — the same
        core also powers the <a href="vue/">Vue adapter →</a>
      </p>

      {!supported && (
        <div className="banner">
          Built-in AI globals weren't detected in this browser. The demos still render, but AI
          actions show the <b>unavailable</b> fallback. Use desktop Chrome with built-in AI enabled
          — see{" "}
          <a href="https://developer.chrome.com/docs/ai/get-started" target="_blank" rel="noreferrer">
            Google's setup guide
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
