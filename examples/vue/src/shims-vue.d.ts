// Lets TypeScript/editors resolve `.vue` single-file component imports.
declare module "*.vue" {
  import type { DefineComponent } from "vue";

  // biome-ignore lint/suspicious/noExplicitAny: standard Vue SFC shim
  const component: DefineComponent<Record<string, never>, Record<string, never>, any>;
  export default component;
}
