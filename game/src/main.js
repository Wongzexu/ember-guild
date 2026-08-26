import { createApp, reactive } from "vue";
import App from "./App.vue";
import { createInitialState, tick, TICK_MS } from "./engine/core.js";
import { createSaveAdapter, migrate } from "./engine/save.js";
import "./style.css";

const adapter = createSaveAdapter();
const AUTOSAVE_MS = 30000;

function snapshot(state) {
  return JSON.parse(JSON.stringify(state));
}

async function bootstrap() {
  let state;
  const saved = await adapter.load();
  if (saved === null) {
    state = createInitialState();
    await adapter.save(snapshot(state));
  } else {
    state = migrate(saved);
  }

  const r = reactive(state);

  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    const dt = now - last;
    last = now;
    Object.assign(r, tick(r, dt));
  }, TICK_MS);

  setInterval(() => {
    r.meta.lastSavedAt = Date.now();
    adapter.save(snapshot(r));
  }, AUTOSAVE_MS);

  window.addEventListener("beforeunload", () => {
    r.meta.lastSavedAt = Date.now();
    adapter.save(snapshot(r));
  });

  createApp(App, { state: r }).mount("#app");
}

bootstrap();