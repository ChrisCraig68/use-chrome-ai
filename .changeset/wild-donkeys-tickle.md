---
"use-chrome-ai": minor
---

Add remote controllers: `exposeController` / `connectController` bridge a controller
across JavaScript contexts over an injectable `Transport`, so a UI with no built-in AI
globals (an extension popup, side panel, options page, or content script) can drive a
session owned elsewhere — the offscreen-document case in Manifest V3.

A connected controller implements the same `Store<ControllerState>` and controller
interfaces as a local one, so `useSyncExternalStore` and the React/Vue adapters bind to it
unchanged. The protocol covers `BaseController`, `TaskController`, and
`LanguageModelController`: streaming with per-request ids, client-initiated cancellation
that ends the generator without a round-trip, typed errors rethrown as their real classes,
and a `download()` gesture check that runs in the document where the click happened.

Core stays zero-dependency and free of `chrome.*` — `Transport` is two functions you
implement over `chrome.runtime`, a `MessagePort`, a `BroadcastChannel`, or a WebSocket.
`createChat` is out of scope (its transcript is mutated in place); expose a
`LanguageModelController` instead.
