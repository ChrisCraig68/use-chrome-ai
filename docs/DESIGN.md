# Design notes

How `use-chrome-ai` is shaped, for the curious. The operational invariants for working in the code live in [AGENTS.md](../AGENTS.md).

## Goals

1. **Primitives, not UI.** Ship the hard on-device glue — availability gating, download progress, streaming, abort, eviction recovery — and let you build the UI.
2. **Framework-agnostic core, thin adapters.** A zero-dependency TS core; React hooks and a Vue adapter on top; other frameworks cheap to add.

## Layers

```
@use-chrome-ai/react   →  hooks (useChat, useSummarizer, … + useAiController escape hatch)
@use-chrome-ai/vue     →  composables (useChat, useModelStatus)
use-chrome-ai          →  core: createChat + 7 per-API factories
                          SessionLifecycle (availability · download · session · stream · evict)
                          drainStream / isAbortError · availability · usage
                               ↓ reads only
                          globalThis.{LanguageModel,Summarizer,Writer,Rewriter,
                                      Proofreader,Translator,LanguageDetector}
```

## The core seam: `SessionLifecycle`

A state machine wrapped around a cached session, exposed as a `useSyncExternalStore`-shaped observable (`subscribe` / `getSnapshot` / `getServerSnapshot`). Every framework adapter binds to the same object, so each adapter is near-zero logic.

Two orthogonal axes drive everything: **`availability`** ("can this run here") and **`phase`** ("what is it doing now") — independent, so a model can be `available` while `streaming`, or `downloading` (in another tab) while this controller is `idle`. Concurrent downloads dedup to one. If Chrome evicts the model mid-session, any non-`AbortError` failure re-checks availability and drops the dead handle; starting a download requires a user gesture.

## Per-API factories

One factory per global class. Create-time options (Summarizer `type`, Rewriter `tone`/`length`, Translator language pair) are pinned at construction; to vary them you build another controller — which the React hooks do automatically when an option changes. Each API's language-hint shape genuinely differs, so each factory owns its own shape rather than forcing a shared one.

## Streaming

`AsyncGenerator<string>` is the streaming boundary (`drainStream` turns the spec's `ReadableStream<string>` into one). It composes with `for await`, gives backpressure, and makes abort fall out as a thrown `AbortError`. The hooks collect the generator into a `result`/`messages` field; power users can consume it directly from the core.

## Packaging

A pnpm monorepo with independently-versioned (changesets) packages: an agnostic core plus one thin adapter package per framework, each declaring only its own framework peer. ESM-only, `sideEffects:false`, tree-shakeable.

## Out of scope (for now)

UI components; chat-history persistence (it's in-memory); cloud fallback; multimodal Prompt input; Proofreader streaming (request/response only); exposing raw token/quota numbers in the default hook surface.
