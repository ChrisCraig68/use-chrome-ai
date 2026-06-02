# Design notes

Why `use-chrome-ai` is shaped the way it is. For contributors and the curious.

## Goals

1. **Primitives, not UI.** Ship the hard on-device glue (availability gating, download
   progress, streaming, abort, eviction recovery). Let developers build their own UI.
2. **Framework-agnostic core, thin adapters.** A zero-dependency TS core; React hooks and a
   Vue adapter on top; Svelte/vanilla cheap to add later.
3. **Light enough for a Chrome extension.** No `chrome.*` coupling, no runtime deps, ESM,
   tree-shakeable.

## Layers

```
@use-chrome-ai/react   →  hooks (useChat, useSummarizer, … + useAiController escape hatch)
use-chrome-ai         →  core: createChat + 7 per-API factories
                         SessionLifecycle (availability · download · session · stream · evict)
                         drainStream / isAbortError · availability · usage (quarantined)
                              ↓ reads only
                         globalThis.{LanguageModel,Summarizer,Writer,Rewriter,
                                     Proofreader,Translator,LanguageDetector}
```

## The core seam: `SessionLifecycle`

A state machine wrapped around a cached session, exposed as a `useSyncExternalStore`-shaped
observable (`subscribe` / `getSnapshot` / `getServerSnapshot`). It's the generalized,
`chrome.*`-free port of the source extension's `BaseAdapter`. Every framework binds to the
same object; the React adapter is near-zero logic.

Load-bearing invariants:

- **Frozen snapshot, replaced wholesale.** `getSnapshot()` returns the same reference until
  a real change. A stray in-place mutation or a getter that builds a fresh object would make
  `useSyncExternalStore` loop forever. Enforced in `update()`; tested.
- **Two orthogonal axes.** `availability` ("can this run here") and `phase` ("what is it
  doing now") are independent — a model can be `available` while `streaming`, or
  `downloading` (another tab) while this controller is `idle`.
- **In-flight create dedup.** Concurrent `warm()` calls share one `create()` (one download).
- **Eviction recovery.** Chrome can drop the model mid-session. Any non-`AbortError` failure
  of a session method calls `invalidate()` → destroy the dead handle + re-check availability.
  `AbortError` is control flow and must *not* invalidate.
- **User-activation gate.** Starting a download requires a user gesture. `warm()` throws
  `ActivationRequiredError` when a download is needed but `navigator.userActivation.isActive`
  is false — so a model never silently fails to download from an effect. Once `available`,
  no gesture is needed.

## Per-API factories

One factory per global class. Create-time options (Summarizer `type`, Rewriter `tone`/
`length`, Translator language pair) are **pinned at construction**; to vary them you build
another controller — the React hooks do this automatically when the option changes, which
makes Rewriter's "recreate the session to change tone" behavior fall out for free.

Lang-hint shapes differ by API and are *not* unified (LanguageModel uses
`expectedInputs/expectedOutputs`; the task APIs use `expectedInputLanguages/outputLanguage`;
Translator uses `sourceLanguage/targetLanguage`). Each factory owns its shape.

Quirks absorbed per factory: LanguageModel clones a warm base per one-shot call; Proofreader
serializes calls through a promise chain (the session handles one at a time) and treats
correction `types` as an optional array; Translator notes that per-pair download progress is
hidden by Chrome for privacy.

## Streaming & abort

`AsyncGenerator<string>` is the streaming boundary (`drainStream` turns the spec's
`ReadableStream<string>` into one). It composes with `for await`, gives backpressure, and
makes abort fall out as a thrown `AbortError`. The React hooks collect the generator into a
`result`/`messages` state field; power users can consume the generator directly from the core.

## Quota: quarantined

The token/quota surface is the spec-churniest part (renamed once already; LanguageModel now
uses `contextUsage`/`contextWindow`, task APIs still use `inputUsage`/`inputQuota`). All of it
lives in `core/usage.ts` (reads both families), and v1 only surfaces graceful
`QuotaExceededError → ContextFullError` handling in chat. Any future rename touches one file.

## Packaging

A **pnpm monorepo** with independently-versioned (changesets) published packages:

```
packages/core    → "use-chrome-ai"          zero-dep, framework-agnostic
packages/react   → "@use-chrome-ai/react"   peer: react;  dep: use-chrome-ai
packages/vue     → "@use-chrome-ai/vue"      peer: vue;    dep: use-chrome-ai
examples/        → playground (imports the packages from source via Vite aliases)
```

This is the TanStack-Query / Floating-UI shape: an agnostic core + thin per-framework adapters
as separate packages. We chose it over a single package with subpath exports specifically
because of multi-framework support — each adapter declares only its own framework peer, ships
its own minimal build toolchain (no React's JSX types contaminating Vue's `.d.ts`, etc.), and
versions independently. Bundle isolation is solved either way by `sideEffects:false` + ESM
tree-shaking; the monorepo wins on peer-dep hygiene, build isolation, and convention. Each
adapter marks `use-chrome-ai` (and its framework) **external**, so it's never re-bundled.

ESM-only (every extension bundler is ESM-native; dual CJS risks the dual-package hazard).
Footprints (gzipped): core ≈ 4.8 KB (all 7 APIs; one API tree-shakes to ~1.7 KB), react adapter
≈ 1.7 KB, vue adapter ≈ 0.65 KB — each on top of the shared external core.

## Deliberately out of scope (v1)

UI components; a persistence `StorageAdapter` (chat history is in-memory — add a seam if asked);
WebLLM/cloud fallback; multimodal Prompt input; Proofreader streaming (request/response only
for now); exposing the raw token/quota numbers in the default hook surface.

## Provenance

The lifecycle, streaming, clone-per-call, proofreader serialization, and chat turn-loop
patterns are ported from the **Nib** Chrome extension
(`src/offscreen/sessions/{base,prompt,stream,chat,proofreader,…}.ts`,
`src/shared/model-status.ts`), with all `chrome.runtime`/offscreen transport removed.
