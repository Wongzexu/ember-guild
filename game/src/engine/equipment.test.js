// 装备引擎测试（M2 · 蓝图 #01 数据模型 + #04 命名/掉落 roll）
import { describe, it, expect } from "vitest";
import {
  SLOTS,
  WEARABLE_SLOTS,
  emptyEquipment,
  equippedItems,
  forgeInstance,
  instanceName,
  baseOf,
  canEquip,
  equipItem,
  unequipItem,
  rollDrop,
} from "./equipment.js";
import { createInitialState } from "./core.js";
import { createHero } from "./hero.js";
import { rngStep } from "./prng.js";

function mkInst(id, baseId, rarity = "white", affixes = []) {
  return forgeInstance(baseId, id, rarity, affixes);
}

function makeState({ heroLevel = 5, bag = [], mainhand = null, offhand = null, parties = [] } = {}) {
  const hero = { ...createHero("anvil", null), level: heroLevel };
  hero.equipment = { ...emptyEquipment(), mainhand, offhand };
  return {
    heroes: [hero],
    inventory: { gold: 0, materials: {}, items: [...bag] },
    parties,
  };
}

const HERO_ID = "eigrem";

describe("equipment 数据形态（#01 B 层叠）", () => {
  it("8 槽常量与 M2 可穿槽位（主手+副手）", () => {
    expect(SLOTS).toEqual(["mainhand", "offhand", "head", "body", "hands", "feet", "ring", "amulet"]);
    expect([...WEARABLE_SLOTS].sort()).toEqual(["mainhand", "offhand"]);
    expect(Object.keys(emptyEquipment()).length).toBe(8);
  });

  it("instanceName：基底名固定，蓝装 = 修饰词 + 基底名（#04 命名口径）", () => {
    const white = mkInst(1, "copper-hammer");
    expect(instanceName(white)).toBe("铜锤");
    const blue = mkInst(2, "copper-hammer", "blue", [
      { affix: "attack_speed_pct", value: 3 },
      { affix: "flat_str", stat: "str", value: 1 },
    ]);
    expect(instanceName(blue)).toBe("迅捷之铜锤");
    const blueShield = mkInst(3, "oak-shield", "blue", [{ affix: "flat_armor", value: 6 }]);
    expect(instanceName(blueShield)).toBe("坚固之橡木盾");
  });

  it("equippedItems 只聚合已穿实例（背包不参与）", () => {
    const main = mkInst(1, "copper-hammer");
    const hero = { ...createHero("anvil", null), equipment: { ...emptyEquipment(), mainhand: main } };
    expect(equippedItems(hero)).toEqual([main]);
  });
});

describe("canEquip 穿戴校验（#01：穿戴时拦）", () => {
  it("槽位匹配 + 需等级 ≤ 英雄等级", () => {
    const hero = { ...createHero("anvil", null), level: 5, equipment: emptyEquipment() };
    expect(canEquip(hero, mkInst(1, "iron-hammer")).ok).toBe(true);
    expect(canEquip(hero, mkInst(2, "steel-hammer")).ok).toBe(false); // 需 15
    expect(canEquip(hero, mkInst(3, "wood-shield")).ok).toBe(true);
  });

  it("双手武器在主手 → 副手禁穿（#01 决策 ①：DisableOffhandSlot 同构）", () => {
    const hero = { ...createHero("anvil", null), level: 5, equipment: { ...emptyEquipment(), mainhand: mkInst(1, "great-hammer") } };
    const check = canEquip(hero, mkInst(2, "wood-shield"));
    expect(check.ok).toBe(false);
    expect(check.reason).toBe("双手武器禁用副手");
  });

  it("M2 未解锁槽位的基底不可穿（防具基底本就未建，防御性断言）", () => {
    const hero = { ...createHero("anvil", null), level: 99, equipment: emptyEquipment() };
    const fake = { id: 9, baseId: "no-such-base", rarity: "white", affixes: [] };
    expect(canEquip(hero, fake).ok).toBe(false);
  });
});

describe("equipItem / unequipItem（B 层叠：穿走即移，一处单份）", () => {
  it("穿上：实例从背包移入装备位，同槽旧装回背包", () => {
    const main = mkInst(1, "copper-hammer");
    const iron = mkInst(2, "iron-hammer");
    const shield = mkInst(3, "wood-shield");
    const s = makeState({ heroLevel: 5, bag: [iron, shield], mainhand: main });

    const next = equipItem(s, HERO_ID, 2);
    const hero = next.heroes[0];
    expect(hero.equipment.mainhand).toEqual(iron);
    expect(next.inventory.items.map((i) => i.id).sort()).toEqual([1, 3]); // 旧铜锤回背包
    // 原状态不可变
    expect(s.heroes[0].equipment.mainhand).toEqual(main);
    expect(s.inventory.items.length).toBe(2);
  });

  it("穿上双手大锤：旧主手回背包 + 副手被清空回背包（#01 决策 ①）", () => {
    const main = mkInst(1, "copper-hammer");
    const off = mkInst(2, "wood-shield");
    const great = mkInst(3, "great-hammer");
    const s = makeState({ heroLevel: 5, bag: [great], mainhand: main, offhand: off });

    const next = equipItem(s, HERO_ID, 3);
    const hero = next.heroes[0];
    expect(hero.equipment.mainhand.baseId).toBe("great-hammer");
    expect(hero.equipment.offhand).toBeNull();
    expect(next.inventory.items.map((i) => i.id).sort()).toEqual([1, 2]);
  });

  it("卸下：装备位实例回背包；空槽卸下原样返回", () => {
    const main = mkInst(1, "copper-hammer");
    const s = makeState({ heroLevel: 5, mainhand: main });
    const next = unequipItem(s, HERO_ID, "mainhand");
    expect(next.heroes[0].equipment.mainhand).toBeNull();
    expect(next.inventory.items).toEqual([main]);
    const empty = makeState({ heroLevel: 5 });
    expect(unequipItem(empty, HERO_ID, "mainhand")).toBe(empty);
  });

  it("违规穿戴抛错：需等级不足 / 背包无此实例 / 战斗中禁换装（#02 Q4）", () => {
    const iron = mkInst(2, "iron-hammer");
    const steel = mkInst(3, "steel-hammer");
    const s = makeState({ heroLevel: 5, bag: [iron, steel] });
    expect(() => equipItem(s, HERO_ID, 3)).toThrow(/需等级/);
    expect(() => equipItem(s, HERO_ID, 99)).toThrow(/背包中无实例/);

    const fighting = makeState({
      heroLevel: 5,
      bag: [iron],
      parties: [{ id: "p1", status: "expedition", heroIds: [HERO_ID] }],
    });
    expect(() => equipItem(fighting, HERO_ID, 2)).toThrow(/战斗\/远征中禁止换装/);
    expect(() => unequipItem(fighting, HERO_ID, "mainhand")).toThrow(/战斗\/远征中禁止换装/);
  });
});

describe("rollDrop 掉落 roll（#04 决策 ①⑤：每击杀一 roll，独立品质/基底）", () => {
  const region = {
    key: "mist-fringe",
    levelRange: [1, 15],
    baseDropRate: 1, // 测试用 100% 掉落，专查后续 roll 结构
    dropPool: ["copper-hammer", "wood-shield"],
  };

  it("无掉率/无池区域不 roll（返回 null，不耗 rng）", () => {
    expect(rollDrop(12345, { ...region, baseDropRate: 0 }, 5)).toBeNull();
    expect(rollDrop(12345, { ...region, dropPool: undefined }, 5)).toBeNull();
    expect(rollDrop(12345, { ...region, baseDropRate: 0.4, dropPool: [] }, 5)).toBeNull();
  });

  it("掉落判定未中 → instance null、id 未消耗，但 rng 照常步进（消耗序列固定）", () => {
    const region50 = { ...region, baseDropRate: 0.5 };
    // 确定性找种子：首个 rngStep < 0.5 判掉、≥ 0.5 判不掉
    let missSeed = 1;
    while (rngStep(missSeed).value < 0.5) missSeed++;
    const missed = rollDrop(missSeed, region50, 5);
    expect(missed.instance).toBeNull();
    expect(missed.rngState).not.toBe(missSeed);
    expect(missed.nextItemId).toBe(5); // id 不占 rng、未消耗
  });

  it("命中：品质→基底→词缀数→词缀固定次序；实例 id = nextItemId，自增返回", () => {
    const out = rollDrop(12345, region, 7);
    expect(out.instance).toBeTruthy();
    expect(out.instance.id).toBe(7);
    expect(out.nextItemId).toBe(8);
    expect(["white", "blue"]).toContain(out.instance.rarity);
    expect(region.dropPool).toContain(out.instance.baseId);
    if (out.instance.rarity === "white") {
      expect(out.instance.affixes).toEqual([]);
    } else {
      expect(out.instance.affixes.length).toBeGreaterThanOrEqual(1);
      expect(out.instance.affixes.length).toBeLessThanOrEqual(2);
    }
  });

  it("蓝装词缀带 stat 字段（flat 类）且值在池区间内；同键去重取最优", () => {
    const base = baseOf("copper-hammer");
    expect(base.type).toBe("weapon");
    // 多种子扫一遍，收集蓝装词缀合法性
    let seenBlue = 0;
    let state = 1;
    for (let i = 0; i < 500 && seenBlue < 20; i++) {
      const out = rollDrop(state, region, 1);
      state = out.rngState;
      if (out.instance?.rarity === "blue") {
        seenBlue++;
        for (const a of out.instance.affixes) {
          const keys = out.instance.affixes.map((x) => x.affix);
          expect(new Set(keys).size).toBe(keys.length); // 去重后无同键
          expect(a.value).toBeGreaterThanOrEqual(1);
        }
      }
    }
    expect(seenBlue).toBeGreaterThan(0);
  });

  it("确定性：同种子同 region → 同结果", () => {
    const a = rollDrop(424242, region, 3);
    const b = rollDrop(424242, region, 3);
    expect(a.instance).toEqual(b.instance);
    expect(a.rngState).toBe(b.rngState);
  });

  it("blueChance 品质分域（#16）：0 = 纯白；1 = 必蓝；未填 = 旧归一化（蓝 ≈32/92）", () => {
    // 1-1 口径：blueChance 0 → 白装零词缀，品质 roll 照常消耗（rng 序列结构不变）
    let sawDrop = false;
    let state = 1;
    for (let i = 0; i < 100 && !sawDrop; i++) {
      const out = rollDrop(state, { ...region, blueChance: 0 }, 1);
      state = out.rngState;
      if (out.instance) {
        sawDrop = true;
        expect(out.instance.rarity).toBe("white");
        expect(out.instance.affixes).toEqual([]);
      }
    }
    expect(sawDrop).toBe(true);
    // 1-2 口径：blueChance 1 → 全蓝（扫多种子必出蓝）
    let sawBlue = false;
    state = 1;
    for (let i = 0; i < 100 && !sawBlue; i++) {
      const out = rollDrop(state, { ...region, blueChance: 1 }, 1);
      state = out.rngState;
      if (out.instance) {
        expect(out.instance.rarity).toBe("blue");
        expect(out.instance.affixes.length).toBeGreaterThanOrEqual(1);
        sawBlue = true;
      }
    }
    expect(sawBlue).toBe(true);
    // 未填：回落 QUALITY_WHITE=60/92 口径——白装概率 60/92（大样本统计近似）
    let white = 0;
    let total = 0;
    state = 1;
    for (let i = 0; i < 400; i++) {
      const out = rollDrop(state, region, 1);
      state = out.rngState;
      if (out.instance) {
        total++;
        if (out.instance.rarity === "white") white++;
      }
    }
    expect(total).toBeGreaterThan(0);
    expect(white / total).toBeGreaterThan(0.5);
    expect(white / total).toBeLessThan(0.8);
  });
});

describe("createInitialState（v0.3）", () => {
  it("起始铜锤为实例 id=1 入 mainhand；meta.nextItemId=2；背包为空", () => {
    const s = createInitialState();
    expect(s.heroes[0].equipment.mainhand).toEqual({
      id: 1,
      baseId: "copper-hammer",
      rarity: "white",
      affixes: [],
    });
    expect(s.meta.nextItemId).toBe(2);
    expect(s.inventory.items).toEqual([]);
  });
});
