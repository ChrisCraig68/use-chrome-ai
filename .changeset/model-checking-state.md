---
"use-chrome-ai": patch
"@use-chrome-ai/react": patch
"@use-chrome-ai/vue": patch
---

Expose whether availability has been resolved yet: `ControllerState.checked` and the derived `ModelStatus.isChecking`. Until the first `availability()` check resolves, `availability` is an optimistic guess, so UIs can gate on `isChecking` to show a neutral state instead of briefly flashing a download CTA for a model that is already installed.
