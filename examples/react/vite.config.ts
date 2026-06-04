import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// React demo app. Uses the published npm packages so the demo behaves like a real consumer app.
export default defineConfig(({ command }) => ({
  // Hosted under the repo subpath on GitHub Pages; "/" for local dev.
  base: command === "build" ? "/use-chrome-ai/" : "/",
  plugins: [react()],
  // Combined demo build: React at dist/, Vue at dist/vue/. `pnpm build:demos` cleans dist
  // first and builds in order, so emptyOutDir stays off here.
  build: { outDir: "../dist", emptyOutDir: false },
  server: { port: 5173, open: false },
}));
