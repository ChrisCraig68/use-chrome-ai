import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

// Vue demo app. Imports the packages FROM SOURCE (via the aliases below) so editing any
// packages/**/src file hot-reloads here — no rebuild needed.
export default defineConfig(({ command }) => ({
  // Served at /vue/ under the repo subpath on GitHub Pages; "/" for local dev.
  base: command === "build" ? "/use-chrome-ai/vue/" : "/",
  plugins: [vue()],
  resolve: {
    alias: [
      {
        find: "@use-chrome-ai/vue",
        replacement: fileURLToPath(new URL("../../packages/vue/src/index.ts", import.meta.url)),
      },
      {
        find: "use-chrome-ai",
        replacement: fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
      },
    ],
  },
  // Writes into the shared demo dist alongside the React build (see examples/react/vite.config.ts).
  build: { outDir: "../dist/vue", emptyOutDir: false },
  server: { port: 5174, open: false },
}));
