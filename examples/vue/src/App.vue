<script setup lang="ts">
import { useChat } from "@use-chrome-ai/vue";
import { ref } from "vue";

// The Vue composable mirrors the React useChat — same core, same streaming behavior.
const { messages, isStreaming, model, send, stop, reset } = useChat({
  system: "You are a concise, friendly assistant.",
});

const input = ref("");

function onSubmit() {
  const text = input.value;
  input.value = "";
  void send(text);
}
</script>

<template>
  <div class="app" style="max-width: 600px">
    <header class="brand">
      <span class="dot" />
      <h1>@use-chrome-ai/vue</h1>
      <span class="badge">on-device</span>
    </header>
    <p class="lede">Same core as the React demos, bound with a Vue composable.</p>

    <div class="card" style="margin-top: 22px">
      <p v-if="model.isUnavailable" class="muted" style="margin: 0">
        On-device AI isn't available in this browser.
      </p>

      <template v-else>
        <button
          v-if="model.availability === 'downloadable'"
          type="button"
          class="btn btn-primary"
          @click="model.download()"
        >
          Enable on-device AI
        </button>
        <div v-if="model.isDownloading" class="progress-row" style="margin-bottom: 12px">
          Downloading model… <progress :value="model.progress" max="1" />
        </div>

        <div class="thread">
          <div v-if="messages.length === 0" class="empty">
            Ask anything — it runs entirely on your device.
          </div>
          <div v-for="(m, i) in messages" :key="i" class="row" :class="m.role">
            <div class="avatar" :class="m.role === 'user' ? 'me' : 'ai'">
              {{ m.role === "user" ? "Me" : "AI" }}
            </div>
            <div class="bubble" :class="m.role">
              <template v-if="m.content">{{ m.content }}</template>
              <span v-else-if="isStreaming && i === messages.length - 1" class="blink">▋</span>
            </div>
          </div>
        </div>

        <form class="composer" @submit.prevent="onSubmit">
          <input
            v-model="input"
            class="field"
            :disabled="isStreaming || !model.isReady"
            placeholder="Ask something…"
          />
          <button v-if="isStreaming" type="button" class="btn" @click="stop">Stop</button>
          <button
            v-else
            type="submit"
            class="btn btn-primary"
            :disabled="!input.trim() || !model.isReady"
          >
            Send
          </button>
          <button v-if="messages.length > 0 && !isStreaming" type="button" class="btn" @click="reset">
            Reset
          </button>
        </form>
      </template>
    </div>

    <p style="margin-top: 24px"><a href="../">← Back to the React demos</a></p>
  </div>
</template>
