---
"use-chrome-ai": minor
"@use-chrome-ai/react": patch
"@use-chrome-ai/vue": patch
---

Add a `requireGesture` opt-out to `download()` for extension offscreen documents.

`download()` gates on `navigator.userActivation.isActive`, which is correct for ordinary
web pages but blocks the standard Manifest V3 pattern of owning the AI session in an
[offscreen document](https://developer.chrome.com/docs/extensions/reference/api/offscreen):
a popup/side-panel click's activation doesn't propagate there, so `download()` threw
`ActivationRequiredError` even though the browser would start the download.

- `download({ requireGesture: false })` (on `SessionLifecycle`, every core controller, and
  the React/Vue `model.download()`) bypasses the local activation check. Use it only when
  the gesture was verified on the other side of a message boundary.
- Default behavior is unchanged — the gesture is still required unless you opt out.
- `warm()` still never downloads, regardless of this option.
- New `DownloadOptions` type is exported from the core package.

The React and Vue adapters thread the option through `model.download()`, so extension UIs
built on the hooks/composables work too.
