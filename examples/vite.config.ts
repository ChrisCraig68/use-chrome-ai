import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

// Dev playground. Imports the packages FROM SOURCE (via the aliases below) so editing any
// packages/**/src file hot-reloads here — no rebuild needed. React demos live at "/", the
// Vue demo at "/vue.html". The aliases make the demo code identical to real consumer code.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react(), vue()],
  resolve: {
    alias: [
      {
        find: "@use-chrome-ai/react",
        replacement: fileURLToPath(new URL("../packages/react/src/index.ts", import.meta.url)),
      },
      {
        find: "@use-chrome-ai/vue",
        replacement: fileURLToPath(new URL("../packages/vue/src/index.ts", import.meta.url)),
      },
      {
        find: "use-chrome-ai",
        replacement: fileURLToPath(new URL("../packages/core/src/index.ts", import.meta.url)),
      },
    ],
  },
  server: { port: 5173, open: false },
});
