# AGENTS.md

Guidance for AI coding agents (and humans) working in this repo. For using the library in
*your own* project, see [`llms.txt`](./llms.txt) and the per-framework quick starts in `docs/`.

## What this is

A **pnpm monorepo** publishing headless, framework-agnostic primitives for the browsers'
built-in AI APIs — the standardized globals (`LanguageModel`, `Summarizer`, …) shipped in
Chrome and Edge (language-model APIs run on Gemini Nano / Phi-4-mini respectively;
Translator and Language Detector use dedicated task models). Logic only — no UI
components. The package names keep the historical `use-chrome-ai` prefix, but nothing in
the code is Chrome-specific.

```
packages/core    → "use-chrome-ai"          zero-dependency, framework-agnostic core
packages/react   → "@use-chrome-ai/react"   React hooks (peer: react; dep: use-chrome-ai)
packages/vue     → "@use-chrome-ai/vue"     Vue composables (peer: vue; dep: use-chrome-ai)
examples/react   → standalone Vite + React demo app (imports packages from source)
examples/vue     → standalone Vite + Vue demo app (imports packages from source)
docs/            → per-framework quick starts + signatures (core/react/vue), enabling built-in AI
```

Per-framework quick starts live in `docs/{core,react,vue}.md`; each package's `README.md` is a
thin pointer to its doc. The root `README.md` is the light overview that links to them.

## Commands

```bash
pnpm install            # install the workspace
pnpm -r typecheck       # tsc --noEmit in every package (examples have no typecheck script)
pnpm -r test            # vitest (mocked AI globals — no real model needed)
pnpm -r build           # tsup → dist for packages; vite build for the demo apps
pnpm lint               # biome check (lint + format verify); CI runs `biome ci .`
pnpm lint:fix           # biome check --write (safe lint fixes + format)
pnpm format             # biome format --write (format only)
pnpm dev:react          # React demo app  → http://localhost:5173
pnpm dev:vue            # Vue demo app    → http://localhost:5174
pnpm build:demos        # build both demos into examples/dist (React at /, Vue at /vue/)
pnpm changeset          # record a change for the next release
```

Always run `pnpm -r typecheck && pnpm -r test && pnpm lint` after changing code. Tests run against **mocked
globals** (see `packages/*/tests/helpers.ts`); the real model path is verified manually
in a browser with built-in AI enabled — Chrome and/or Edge (`pnpm dev:react`).

## Architecture (read before changing core)

- **`packages/core/src/lifecycle.ts` is the heart.** `SessionLifecycle` is a state machine over
  a cached session, exposed as a `useSyncExternalStore`-shaped store (`subscribe`/`getSnapshot`/
  `getServerSnapshot`). Every framework adapter binds to it.
- **Per-API factories** live in `packages/core/src/apis/`. One per global class. `task.ts` builds
  the streaming request/response controllers (Summarizer/Writer/Rewriter/Translator).
- **`packages/core/src/remote/` bridges a controller across JS contexts** (extension offscreen
  document ↔ side panel). `host.ts` serves one, `client.ts` returns a proxy implementing the
  same `Store` + controller interfaces, `protocol.ts` owns the versioned message shapes and the
  Error/state wire forms. It talks only to the injected `Transport` — no `chrome.*` anywhere.
- The React/Vue adapters are **thin** — they own a controller and mirror its status into the
  framework's reactivity. New methods/behavior belong in core, not the adapter.

## Conventions & invariants (don't break these)

- **Core must stay zero-dependency.** It reads only the AI globals on `globalThis`, lazily, inside
  functions (never at module top level) — no other global/host coupling. This keeps it usable in
  any document context and keeps `sideEffects:false` honest.
- **`getSnapshot()` must return the same frozen object until a real change** — a fresh object each
  call makes `useSyncExternalStore` infinite-loop. State is replaced wholesale in `update()`.
- **Two orthogonal axes.** `availability` ("can this run here") and `phase` ("what is it doing now")
  are independent; never collapse them.
- **In-flight create dedup.** Concurrent `warm()`/`download()` calls share one `create()` (one download).
- **`AbortError` is control flow, not failure.** Never `invalidate()` on it (use `isAbortError`).
  Any *other* session-method failure calls `invalidate()` (the browser can evict the model mid-session)
  → destroy the dead handle + re-check availability.
- **Downloads are explicit.** A normal call (`warm()`, and the `run`/`stream`/`send`/`prompt` paths
  that route through it) never starts a download — it throws `ActivationRequiredError` while the model
  is still `downloadable`. Only `download()` starts the download, and it requires a user gesture
  (`navigator.userActivation.isActive`). Don't auto-download from effects.
- **Spec-first, never browser-sniffed.** Feature support comes from the globals and
  `availability()`, not the browser name. `detectBrowser()` exists solely for setup copy
  (which vendor docs to link); do not key behavior off it.
- **Hooks never reject** (they set `error`); **core `create*` functions DO reject** (imperative control).
- **The token/quota surface is volatile — keep all of it in `core/src/usage.ts`.** Member names
  have been renamed once already; do not spread them across files.
- **Per-API language-hint shapes genuinely differ** (LanguageModel `expectedInputs/expectedOutputs`
  vs task APIs `expectedInputLanguages/outputLanguage` vs Translator `sourceLanguage/targetLanguage`).
  Each factory owns its shape; don't unify them.
- Match the existing comment density and naming. Prefer preserving proven behavior over inventing.

## Releasing

Independently versioned via changesets. `pnpm changeset` → commit → on merge to `main` the
release workflow opens a "Version Packages" PR; merging it publishes. Requires an `NPM_TOKEN`
secret and the `@use-chrome-ai` npm org. The example apps are `private` and never publish.
