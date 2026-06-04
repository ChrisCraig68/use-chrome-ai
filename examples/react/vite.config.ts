import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// React demo app. Imports the packages FROM SOURCE (via the aliases below) so editing any
// packages/**/src file hot-reloads here — no rebuild needed. The aliases make the demo code
// identical to real consumer code.
export default defineConfig(({ command }) => ({
  // Hosted under the repo subpath on GitHub Pages; "/" for local dev.
  base: command === "build" ? "/use-chrome-ai/" : "/",
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@use-chrome-ai/react",
        replacement: fileURLToPath(new URL("../../packages/react/src/index.ts", import.meta.url)),
      },
      {
        find: "use-chrome-ai",
        replacement: fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
      },
    ],
  },
  // Combined demo build: React at dist/, Vue at dist/vue/. `pnpm build:demos` cleans dist
  // first and builds in order, so emptyOutDir stays off here.
  build: { outDir: "../dist", emptyOutDir: false },
  server: { port: 5173, open: false },
}));
