// @vitest-environment jsdom
// 回归：右栏「战记 ⇄ 时间线」切换后，时间线必须仍渲染编年史条目且显示状态恢复
// （display:none 期间浏览器会丢 scrollTop → 切回时 watch 需重新钉底）
import { describe, it, expect, beforeAll } from "vitest";
import { reactive, nextTick } from "vue";
import { createApp } from "vue";
import App from "../App.vue";
import { createInitialState } from "../engine/core.js";

beforeAll(() => {
  // jsdom 无布局引擎，scrollTo 未实现 → 打桩避免虚拟控制台报错
  Element.prototype.scrollTo = () => {};
});

async function mountApp() {
  document.body.innerHTML = `<div id="app"></div>`;
  const state = reactive(createInitialState());
  state.onboarding = { step: "completed", completed: true };
  const app = createApp(App, { state });
  app.mount("#app");
  await nextTick();
  return { app, state };
}

describe("战记 ⇄ 时间线切换", () => {
  it("切回时间线后编年史条目仍然渲染", async () => {
    const { app } = await mountApp();
    const btn = document.querySelector(".battlelog-link");
    expect(btn, "右栏战记入口应存在").toBeTruthy();

    btn.click();
    await nextTick();
    expect(document.querySelector(".blog"), "战记面板应显示").toBeTruthy();

    btn.click();
    await nextTick();
    const tl = document.querySelector(".timeline");
    expect(tl.children.length, "时间线条目数").toBeGreaterThan(0);
    expect(tl.style.display, "display 应恢复").not.toBe("none");
    app.unmount();
  });

  it("战记打开期间编年史增长，切回后条目完整且不报错", async () => {
    const { app, state } = await mountApp();
    const before = state.chronicle.length;
    document.querySelector(".battlelog-link").click();
    await nextTick();

    state.chronicle = [
      ...state.chronicle,
      { t: Date.now(), text: "战记打开期间新增的里程碑。", legend: 0 },
    ];
    await nextTick();

    document.querySelector(".battlelog-link").click();
    await nextTick();
    const tl = document.querySelector(".timeline");
    expect(tl.children.length).toBe(before + 1);
    app.unmount();
  });
});
