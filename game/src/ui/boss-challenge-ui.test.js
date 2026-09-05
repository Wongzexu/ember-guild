// @vitest-environment jsdom
// 回归（#16 二批 UI 反馈）：挑战 Boss = 目标替换而非击杀——
// ① 血条显示缓存必须清空（否则 Boss 血条沿用旧怪残血）；② 不播旧怪死亡动画；
// ③ Boss 战有明确标识（战斗框/血条/顶部标签）；④ 发现 Boss 有全局 Toast；
// ⑤ 出征中/待命两态「挑战 Boss」入口唯一。
import { describe, it, expect, beforeAll } from "vitest";
import { reactive, nextTick } from "vue";
import { createApp } from "vue";
import App from "../App.vue";
import { createInitialState, tick } from "../engine/core.js";
import { createParty, startExpedition, challengeBoss } from "../engine/expedition.js";

beforeAll(() => {
  Element.prototype.scrollTo = () => {};
});

async function mountApp(initial = {}) {
  document.body.innerHTML = `<div id="app"></div>`;
  const state = reactive({ ...createInitialState(), ...initial });
  state.onboarding = { step: "completed", completed: true };
  const app = createApp(App, { state });
  app.mount("#app");
  await nextTick();
  return { app, state };
}

function navTo(mainText) {
  const btn = [...document.querySelectorAll(".nav-btn")].find((b) => b.textContent.includes(mainText));
  expect(btn, `导航按钮「${mainText}」应存在`).toBeTruthy();
  btn.click();
  return nextTick();
}

const challengeButtons = () =>
  [...document.querySelectorAll("button")].filter((b) => b.textContent.trim() === "挑战 Boss");

describe("Boss 挑战 UI（目标替换 ≠ 击杀）", () => {
  it("出征中挑战：血条立即满血、不播旧怪死亡、顶部出现正在挑战标识、入口唯一", async () => {
    const { app, state } = await mountApp({
      bossSpotted: { "mist-fringe": true },
      regionKills: { "mist-fringe": 10 },
    });
    await navTo("远征");
    state.parties = [startExpedition(createParty("eigrem", "mist-fringe"))];
    Object.assign(state, tick(state, 500)); // 刷普通怪（同 main.js 循环）
    await nextTick();

    const normalName = state.parties[0].monster.name;
    expect(state.parties[0].monster.id).not.toBe("golden-mantella");
    // 出征中：挑战入口唯一 = 顶部按钮（区域卡内不重复）
    expect(challengeButtons().length).toBe(1);

    Object.assign(state, challengeBoss(state, "mist-fringe"));
    await nextTick();

    // ① 血条缓存清空 → 回退 live state（Boss 满血 60/60 = 100%），不再沿用旧怪残血
    const fill = document.querySelector(".fill.foe");
    expect(fill.style.width).toBe("100%");
    // ② 替换非击杀：名牌立即显示 Boss（若误播死亡动画，1.2s 内显示的是旧怪幽灵）
    const plate = document.querySelector(".monster-visual .plate .name");
    expect(plate.textContent).toContain("金曼特拉");
    expect(plate.textContent).not.toContain(normalName);
    // ③ Boss 战标识：战斗框 boss 类 + 首领徽章 + 顶部「正在挑战 Boss」标签
    expect(document.querySelector(".monster-visual.boss")).toBeTruthy();
    expect(document.querySelector(".plate .tier")?.textContent).toContain("首领");
    expect(document.querySelector(".fill.foe.boss")).toBeTruthy();
    expect(document.querySelector(".boss-live-tag")?.textContent).toContain("正在挑战 Boss");
    // 入口唯一：挑战中两处「挑战 Boss」按钮都隐藏
    expect(challengeButtons().length).toBe(0);
    app.unmount();
  });

  it("待命挑战：区域卡是唯一入口，点击后直接以 Boss 开战", async () => {
    const { app, state } = await mountApp({
      unlocks: { "tutorial-0-1": true }, // 1-1 的解锁门槛（完成教学）
      bossSpotted: { "mist-fringe": true },
      regionKills: { "mist-fringe": 10 },
    });
    await navTo("远征");
    state.parties = [createParty("eigrem", "mist-fringe")];
    await nextTick();
    // 待命：入口唯一 = 区域卡按钮（顶部运行区未显示）
    expect(challengeButtons().length).toBe(1);
    challengeButtons()[0].click();
    await nextTick();
    expect(state.parties[0].status).toBe("expedition");
    expect(state.parties[0].monster.id).toBe("golden-mantella");
    app.unmount();
  });

  it("发现 Boss → 全局 Toast 提示（挂载时已发现的存量不重播）；点击跳远征厅", async () => {
    // 存量发现：挂载即有 bossSpotted → 不应出现 Toast
    const { app, state } = await mountApp({ bossSpotted: { "mist-fringe": true } });
    await navTo("远征");
    expect(document.querySelector(".boss-toast")).toBeNull();

    // 新发现：diff 出新 key → Toast 显示 Boss 名与区域名
    state.bossSpotted = { ...state.bossSpotted, "gloom-woods": true };
    await nextTick();
    const toast = document.querySelector(".boss-toast");
    expect(toast, "新发现应触发 Toast").toBeTruthy();
    expect(toast.textContent).toContain("已发现 Boss");
    expect(toast.textContent).toContain("狂野塔尔");
    expect(toast.textContent).toContain("幽暗林地");

    // 点击 → 前往远征厅
    toast.click();
    await nextTick();
    expect(document.querySelector(".boss-toast")).toBeNull();
    expect(document.querySelector(".expedition")).toBeTruthy();
    app.unmount();
  });

  it("区域卡：Boss 数据与普通敌人分列（不混入血量/威力汇总），显示发现进度", async () => {
    const { app, state } = await mountApp({ regionKills: { "mist-fringe": 7 } });
    await navTo("远征");
    const card = [...document.querySelectorAll(".region-card")].find((c) =>
      c.textContent.includes("迷雾边缘"),
    );
    const rows = [...card.querySelectorAll(".row")].map((r) => r.textContent);
    // 普通敌人行不含 Boss 名；Boss 单列且带发现进度
    const enemyRow = rows.find((t) => t.includes("敌人"));
    expect(enemyRow).not.toContain("金曼特拉");
    expect(rows.find((t) => t.includes("Boss 血量"))).toBeTruthy();
    expect(rows.find((t) => t.includes("击杀进度 7 / 10"))).toBeTruthy();
    // 发现后：sticky 标签切换
    state.bossSpotted = { "mist-fringe": true };
    await nextTick();
    expect(
      [...card.querySelectorAll(".row")].some((r) => r.textContent.includes("已发现 · 可挑战")),
    ).toBe(true);
    app.unmount();
  });
});
