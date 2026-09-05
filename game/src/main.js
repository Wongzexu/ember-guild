import { createApp, reactive } from "vue";
import App from "./App.vue";
import { createInitialState, tick, TICK_MS } from "./engine/core.js";
import { createSaveAdapter, migrate } from "./engine/save.js";
import "./style.css";

const adapter = createSaveAdapter();
const AUTOSAVE_MS = 30000;
// 一键清档标志：清档 → reload 的间隙里，beforeunload/自动存档不得把旧状态写回
const DISCARD_KEY = "ardora_discard_save";

function discardingSave() {
  return sessionStorage.getItem(DISCARD_KEY) === "1";
}

sessionStorage.removeItem(DISCARD_KEY);

function snapshot(state) {
  const { combatEvents, ...persisted } = state;
  void combatEvents;
  return JSON.parse(JSON.stringify(persisted));
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
    if (discardingSave()) return;
    r.meta.lastSavedAt = Date.now();
    adapter.save(snapshot(r));
  }, AUTOSAVE_MS);

  window.addEventListener("beforeunload", () => {
    if (discardingSave()) return;
    r.meta.lastSavedAt = Date.now();
    adapter.save(snapshot(r));
  });

  createApp(App, { state: r }).mount("#app");
}

bootstrap();
