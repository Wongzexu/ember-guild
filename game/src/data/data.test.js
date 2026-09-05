// 数据表一致性守卫（M2 · items.json / affixes.json / regions.json 扩展）
// 数值来源：NUMBERS §5.1（基底阶梯）/§5.2~§5.3（词缀池）/§4.3（区域 iLv 带）/§6（掉率权重）；
// M2 实现期拍板（2026-08-30）：8 基底 / weapon+shield 双池 / 雾林 40% / 幽暗 35%。
import { describe, it, expect } from "vitest";
import itemsData from "./items.json" with { type: "json" };
import affixesData from "./affixes.json" with { type: "json" };
import regionsData from "./regions.json" with { type: "json" };
import monstersData from "./monsters.json" with { type: "json" };

const M2_SLOTS = ["mainhand", "offhand"];
const STATS = new Set(["str", "dex", "vit", "int", "agi"]);
const RARITY_AFFIX_COUNT = { white: 0, blue: [1, 2] }; // §5.4（M2 只白+蓝）

describe("items.json 基底目录（#01 数据模型）", () => {
  const items = itemsData.items;

  it("M2 首批 8 基底：id 唯一、类型字段齐备", () => {
    expect(items.length).toBe(8);
    const ids = items.map((i) => i.id);
    expect(new Set(ids).size).toBe(items.length);
    for (const it of items) {
      expect(it.id).toBeTruthy();
      expect(["weapon", "shield"]).toContain(it.type);
      expect(M2_SLOTS).toContain(it.slot);
      expect(Number.isInteger(it.reqLevel)).toBe(true);
      expect(it.reqLevel).toBeGreaterThanOrEqual(1);
      expect(it.name).toBeTruthy();
    }
  });

  it("武器基底：damage 区间合法、bps>0、handedness one|two、implicit 为合法词缀或 null", () => {
    const affixKeys = new Set(Object.values(affixesData.pools).flat().map((a) => a.affix));
    for (const it of items.filter((i) => i.type === "weapon")) {
      expect(it.damage.length).toBe(2);
      expect(it.damage[0]).toBeLessThanOrEqual(it.damage[1]);
      expect(it.bps).toBeGreaterThan(0);
      expect(["one", "two"]).toContain(it.handedness);
      if (it.implicit) {
        expect(affixKeys.has(it.implicit.affix)).toBe(true);
        expect(it.implicit.value).toBeGreaterThan(0);
      }
    }
  });

  it("盾基底：armor ≥ 0、无 damage/bps/handedness（#01：盾无此字段）", () => {
    for (const it of items.filter((i) => i.type === "shield")) {
      expect(it.slot).toBe("offhand");
      expect(it.armor).toBeGreaterThanOrEqual(0);
      expect(it.damage).toBeUndefined();
      expect(it.bps).toBeUndefined();
      expect(it.handedness).toBeUndefined();
    }
  });

  it("锤族阶梯镜像 §5.1 剑阶梯：需等级/伤害/隐含攻速（实现期拍板数值）", () => {
    const byId = new Map(items.map((i) => [i.id, i]));
    expect(byId.get("copper-hammer").damage).toEqual([1, 3]);
    expect(byId.get("iron-hammer").reqLevel).toBe(5);
    expect(byId.get("iron-hammer").implicit).toEqual({ affix: "attack_speed_pct", value: 3 });
    expect(byId.get("steel-hammer").damage).toEqual([9, 16]);
    expect(byId.get("adamant-hammer").damage).toEqual([18, 30]);
    // 双手大锤：handedness=two → 禁副手（#01 决策 ①）
    expect(byId.get("great-hammer").handedness).toBe("two");
    expect(byId.get("great-hammer").bps).toBe(0.8);
    // 盾阶梯（实现期拍板：木8/橡22/钢40）
    expect(byId.get("wood-shield").armor).toBe(8);
    expect(byId.get("oak-shield").armor).toBe(22);
    expect(byId.get("steel-shield").armor).toBe(40);
  });
});

describe("affixes.json 词缀池（#01 决策 ④：按部位分池）", () => {
  const pools = affixesData.pools;

  it("M2 只开 weapon + shield 两池（防具/饰品池 M3 填）", () => {
    expect(Object.keys(pools).sort()).toEqual(["shield", "weapon"]);
  });

  it("每条词缀：affix/name/mod/tier/value 齐备、区间合法、stat 属五维", () => {
    const seen = new Set();
    for (const [pool, list] of Object.entries(pools)) {
      expect(list.length).toBeGreaterThan(0);
      for (const a of list) {
        expect(a.affix).toBeTruthy();
        expect(seen.has(a.affix)).toBe(false); // 词缀键全局唯一（防重复取最优按键合并）
        seen.add(a.affix);
        expect(a.name).toBeTruthy();
        expect(a.mod).toBeTruthy();
        expect(a.tier).toBe(3); // M2 iLv≤30 只解锁 Tier III（§5.5）
        expect(a.value.length).toBe(2);
        expect(a.value[0]).toBeLessThanOrEqual(a.value[1]);
        if (a.stat) expect(STATS.has(a.stat)).toBe(true);
      }
    }
  });

  it("方案 A 区间拍板：weapon=§5.2 Tier III 原值；shield 新定（无 armor_pct/+VIT/掉宝率）", () => {
    const weapon = Object.fromEntries(pools.weapon.map((a) => [a.affix, a]));
    expect(weapon.phys_damage_pct.value).toEqual([7, 12]);
    expect(weapon.flat_phys.value).toEqual([1, 2]);
    expect(weapon.attack_speed_pct.value).toEqual([2, 3]);
    expect(weapon.flat_str.value).toEqual([1, 2]);
    // M2 未接线词缀不进池（暴击/元素/格挡/掉宝率），盾池无 +VIT（§5.3 安全注）
    const shieldKeys = pools.shield.map((a) => a.affix);
    expect(shieldKeys.sort()).toEqual(["flat_armor", "flat_dex", "flat_hp"].sort());
    for (const a of pools.shield) expect(a.stat).not.toBe("vit");
  });

  it("稀有度→词缀数：白 0 / 蓝 1~2（§5.4）", () => {
    expect(RARITY_AFFIX_COUNT.white).toBe(0);
    expect(RARITY_AFFIX_COUNT.blue).toEqual([1, 2]);
  });
});

describe("regions.json M2 扩展（#03 攻速 / #04 掉落）", () => {
  const regions = regionsData.regions;

  it("每区出场节奏合法：monster.attackInterval 或敌人池默认 ≥ 200ms（#03：默认 1000 基线）", () => {
    for (const r of regions) {
      const interval = r.monster?.attackInterval ?? 1000; // 敌人池区走引擎默认 1000
      expect(interval).toBeGreaterThanOrEqual(200);
    }
    // 迷雾边缘已改敌人池制（S6）：不再保留 monster 数值块
    expect(regionByKey("mist-fringe").enemies).toContain("blaze-hound");
  });

  it("敌人池引用的敌人 ID 存在于 monsters.json，0-1 教学固定单只余烬猎犬", () => {
    for (const r of regions) {
      for (const id of r.enemies ?? []) {
        expect(monstersData.monsters[id], `${r.key} 引用了未知敌人 ${id}`).toBeTruthy();
      }
      if (r.boss) expect(monstersData.monsters[r.boss.id], `${r.key} 小 Boss 未知`).toBeTruthy();
    }
    const tutorial = regionByKey("tutorial-0-1");
    expect(tutorial.tutorial).toBe(true);
    expect(tutorial.fixedEnemy).toBe(true);
    expect(tutorial.enemies).toEqual(["blaze-hound"]);
    expect(regionByKey("mist-fringe").boss).toEqual({ id: "golden-mantella", every: 10 });
  });

  it("怪物 element 字段必填且取值合法（首区全部 none，元素底座随 PENDING #18 扩展）", () => {
    const ELEMENTS = new Set(["none"]);
    for (const [id, m] of Object.entries(monstersData.monsters)) {
      expect(ELEMENTS.has(m.element), `怪物 ${id} element 非法：${m.element}`).toBe(true);
    }
    expect(monstersData.monsters["blaze-hound"].element).toBe("none");
  });

  it("掉率：雾林 40% / 幽暗 35%，未填区域默认不掉（引擎口径）", () => {
    expect(regionByKey("mist-fringe").baseDropRate).toBe(0.4);
    expect(regionByKey("gloom-woods").baseDropRate).toBe(0.35);
    expect(regionByKey("frost-pass").baseDropRate).toBeUndefined();
  });

  it("品质分域（#16）：1-1 纯白 blueChance=0；1-2 小概率蓝 0.12；未填走引擎旧归一化", () => {
    expect(regionByKey("mist-fringe").blueChance).toBe(0);
    expect(regionByKey("gloom-woods").blueChance).toBe(0.12);
    expect(regionByKey("frost-pass").blueChance).toBeUndefined();
  });

  it("dropPool 引用的基底存在，且需等级落在该区 iLv 带（首掉落区 [lo,hi]，后续 (lo,hi]）", () => {
    regions.forEach((r) => {
      if (!r.dropPool?.length) return; // 教学区/未开掉落区允许空池（引擎默认不掉）
      const firstLootRegion = r.key === "mist-fringe"; // 0-1 不掉落；雾林是首个掉落区
      const lo = firstLootRegion ? r.levelRange[0] : r.levelRange[0] + 1;
      const hi = r.levelRange[1];
      expect(r.dropPool.length).toBeGreaterThan(0);
      for (const id of r.dropPool) {
        const base = itemsData.items.find((i) => i.id === id);
        expect(base, `${r.key} 引用了未知基底 ${id}`).toBeTruthy();
        expect(base.reqLevel).toBeGreaterThanOrEqual(lo);
        expect(base.reqLevel).toBeLessThanOrEqual(hi);
      }
    });
    // 钢锤/钢盾（需 15）随 1-3+ 设计再入池；1-1 白装过渡池 req≤5，1-2 蓝装池 req∈(4,8]
    expect(regionByKey("mist-fringe").dropPool).toEqual([
      "copper-hammer",
      "iron-hammer",
      "great-hammer",
      "wood-shield",
      "oak-shield",
    ]);
    expect(regionByKey("gloom-woods").dropPool).toEqual(["iron-hammer", "oak-shield"]);
  });

  it("1-1/1-2 定稿形态（#16 首批）：等级带、阵容、Boss、解锁链", () => {
    const mist = regionByKey("mist-fringe");
    expect(mist.levelRange).toEqual([1, 5]);
    expect(mist.enemies).toEqual(["blaze-hound", "blue-sting-scorpion"]);
    expect(mist.boss).toEqual({ id: "golden-mantella", every: 10 });
    expect(mist.unlock).toEqual({ orgLevel: 1, heroLevel: 1, regionKey: "tutorial-0-1" });

    const gloom = regionByKey("gloom-woods");
    expect(gloom.levelRange).toEqual([4, 8]);
    expect(gloom.enemies).toEqual(["ash-mephyt", "blaze-hound", "piercing-mantis"]);
    expect(gloom.boss).toEqual({ id: "wild-tahr", every: 10 });
    // 解锁链：等级达标 + 上一个区域 Boss 已通过（bossKills 首杀登记）
    expect(gloom.unlock).toEqual({
      orgLevel: 2,
      heroLevel: 4,
      regionKey: "mist-fringe",
      bossKey: "mist-fringe",
    });
  });
});

function regionByKey(key) {
  return regionsData.regions.find((r) => r.key === key);
}
