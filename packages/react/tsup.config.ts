import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  dts: true,
  treeshake: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  // Never bundle React or the core — they're a peer and a dependency respectively.
  external: ["react", "react-dom", "react/jsx-runtime", "use-chrome-ai"],
});
