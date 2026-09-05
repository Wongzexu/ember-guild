import { describe, expect, it } from "vitest";
import fs from "node:fs";
import heroesData from "./heroes.json" with { type: "json" };
import monstersData from "./monsters.json" with { type: "json" };
import { HERO_VISUALS, MONSTER_VISUALS, actionTiming, monsterVisualOf, visualOf } from "./visuals.js";
import { FX_SHEETS } from "./fx-sheets.js";
import { migrate } from "../engine/save.js";

describe("英雄视觉资源映射", () => {
  it("艾格雷姆只引用资源 ID，并具备五种动画", () => {
    const hero = heroesData.heroes.find((h) => h.id === "eigrem");
    expect(hero.visual).toEqual({ portrait: "eigrem", animationSet: "eigrem" });
    expect(HERO_VISUALS.eigrem.portrait).toBe("/assets-runtime/duelyst/units/eigrem/preview.png");
    expect(HERO_VISUALS.eigrem.animations).toEqual({
      idle: "/assets-runtime/duelyst/units/eigrem/idle.webm",
      run: "/assets-runtime/duelyst/units/eigrem/run.webm",
      attack: "/assets-runtime/duelyst/units/eigrem/attack.webm",
      hit: "/assets-runtime/duelyst/units/eigrem/hit.webm",
      death: "/assets-runtime/duelyst/units/eigrem/death.webm",
    });
  });

  it("艾格雷姆专属命中特效 = 原版 Sworn Defender 组合（蓝火花+白冲击），层素材齐备", () => {
    const impact = HERO_VISUALS.eigrem.fx.impact;
    expect(impact.map((l) => l.sprite)).toEqual(["fx_collisionblue", "fx_impact2"]);
    for (const layer of impact) {
      const sheet = FX_SHEETS[layer.sprite];
      expect(sheet.frames.length).toBeGreaterThan(0);
      const file = sheet.file ?? `${layer.sprite}.png`;
      expect(fs.existsSync(new URL(`../../public/assets-runtime/duelyst/fx/${file}`, import.meta.url))).toBe(true);
    }
  });

  it("旧存档加载时补回视觉资源 ID", () => {
    const state = migrate({
      version: "0.3.0",
      heroes: [{ id: "eigrem", class: "anvil", personality: "旧文案" }],
    });
    expect(state.heroes[0].visual).toEqual({ portrait: "eigrem", animationSet: "eigrem" });
  });
});

describe("敌人视觉资源映射（S6 素材分离）", () => {
  it("余烬猎犬按视觉 ID 映射，五件套齐备", () => {
    const hound = monstersData.monsters["blaze-hound"];
    expect(hound.name).toBe("余烬猎犬");
    expect(hound.visual).toBe("blaze-hound");
    expect(MONSTER_VISUALS["blaze-hound"].portrait).toBe(
      "/assets-runtime/duelyst/units/blaze-hound/preview.png",
    );
    expect(Object.keys(MONSTER_VISUALS["blaze-hound"].animations).sort()).toEqual(
      ["attack", "death", "hit", "idle", "run"].sort(),
    );
  });

  it("金曼特拉五件套齐备（#16 首批补齐 1-1 小 Boss 素材）", () => {
    const mantella = MONSTER_VISUALS["golden-mantella"];
    expect(mantella.portrait).toBe("/assets-runtime/duelyst/units/golden-mantella/preview.png");
    expect(Object.keys(mantella.animations).sort()).toEqual(
      ["attack", "death", "hit", "idle", "run"].sort(),
    );
    expect(mantella.timing).toEqual({ attackDurationMs: 1180, attackHitMs: 680 });
  });

  it("1-2 阵容素材收录（#16）：烬雾魔精/穿刺刀螳/狂野塔尔五件套齐备", () => {
    for (const id of ["ash-mephyt", "piercing-mantis", "wild-tahr"]) {
      const v = MONSTER_VISUALS[id];
      expect(v, `${id} 缺视觉映射`).toBeTruthy();
      expect(Object.keys(v.animations).sort()).toEqual(
        ["attack", "death", "hit", "idle", "run"].sort(),
      );
      expect(v.timing.attackDurationMs).toBeGreaterThan(0);
      expect(v.timing.attackHitMs).toBeGreaterThan(0);
      expect(v.timing.attackHitMs).toBeLessThan(v.timing.attackDurationMs);
    }
  });

  it("未收录视觉 ID → null，表现层走文字占位", () => {
    expect(monsterVisualOf({ visual: "no-such-monster" })).toBeNull();
    expect(monsterVisualOf(null)).toBeNull();
    expect(monsterVisualOf({})).toBeNull();
  });

  it("蓝刺蝎五件套齐备（2026-09-02 拉取 onyx scorpion 转出）", () => {
    const scorpion = MONSTER_VISUALS["blue-sting-scorpion"];
    expect(scorpion.portrait).toBe("/assets-runtime/duelyst/units/blue-sting-scorpion/preview.png");
    expect(Object.keys(scorpion.animations).sort()).toEqual(
      ["attack", "death", "hit", "idle", "run"].sort(),
    );
    expect(scorpion.timing).toEqual({ attackDurationMs: 1200, attackHitMs: 500 });
  });
});

describe("攻击时序按单位读取（actionTiming）", () => {
  it("英雄走 visual.portrait 键，敌人走 visual 字符串 id，各自读自己的 timing", () => {
    expect(actionTiming({ visual: { portrait: "eigrem" } }, "attack")).toEqual({
      attackDurationMs: 1200,
      attackHitMs: 680,
    });
    expect(actionTiming({ visual: "blaze-hound" }, "attack")).toEqual({
      attackDurationMs: 1300,
      attackHitMs: 240,
    });
  });

  it("非攻击动作与未收录单位走默认值，不阻塞战斗表现", () => {
    expect(actionTiming({ visual: { portrait: "eigrem" } }, "hit")).toEqual({
      attackDurationMs: 300,
      attackHitMs: 0,
    });
    expect(actionTiming({ visual: "no-such-monster" }, "attack")).toEqual({
      attackDurationMs: 1000,
      attackHitMs: 500,
    });
    expect(actionTiming(null, "attack")).toEqual({ attackDurationMs: 1000, attackHitMs: 500 });
  });
});
