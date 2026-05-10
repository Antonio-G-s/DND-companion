/* ============================================
   main.ts — App entry point
   Mounts the root Svelte component.
   ============================================ */

import App from "./App.svelte";

const app = new App({
  target: document.getElementById("app")!,
});

export default app;
