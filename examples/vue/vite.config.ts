import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

// Vue demo app. Uses the published npm packages so the demo behaves like a real consumer app.
export default defineConfig(({ command }) => ({
  // Served at /vue/ under the repo subpath on GitHub Pages; "/" for local dev.
  base: command === "build" ? "/use-chrome-ai/vue/" : "/",
  plugins: [vue()],
  // Writes into the shared demo dist alongside the React build (see examples/react/vite.config.ts).
  build: { outDir: "../dist/vue", emptyOutDir: false },
  server: { port: 5174, open: false },
}));
