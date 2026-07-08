---
"@use-chrome-ai/react": patch
"@use-chrome-ai/vue": patch
---

useChat now publishes the user's turn to `messages` as soon as `send()` is called, instead of after the first reply token arrives. Previously, on a cold session the sent message stayed invisible through the whole session warm-up, so chat UIs looked frozen until the model started replying. While `isStreaming` is true and the last message is the user's, the reply hasn't started yet — render a "thinking…" indicator off that. A send that fails before the reply starts still leaves no stray message in the transcript.
