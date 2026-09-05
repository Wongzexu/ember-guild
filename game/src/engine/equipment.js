// 装备引擎（M2 · 蓝图 #01/#02/#04 决策落地，公式口径 NUMBERS §4.1/§5/§6）
// 数据形态（#01 B 层叠）：实例对象 = { id, baseId, rarity, affixes }，嵌 hero.equipment[槽位]；
// inventory.items 存未穿实例；穿走即移（一处单份）。实例 id = 单调自增主键，不占 rng。
// 词缀实例条目 = { affix, stat?, value }（带 stat 的折进 heroStats，见 hero.js #02 接线）。

import itemsData from "../data/items.json" with { type: "json" };
import affixesData from "../data/affixes.json" with { type: "json" };
import { rngInt, rngStep } from "./prng.js";

export const SLOTS = ["mainhand", "offhand", "head", "body", "hands", "feet", "ring", "amulet"];
export const SLOT_LABEL = {
  mainhand: "主手",
  offhand: "副手",
  head: "头",
  body: "身",
  hands: "手",
  feet: "脚",
  ring: "戒",
  amulet: "链",
};
// M2 实际可穿 = 主手 + 副手（铁砧=锤+盾）；其余 6 槽结构/存档就位、禁穿占位
export const WEARABLE_SLOTS = new Set(["mainhand", "offhand"]);
// 稀有度 → 词缀数（§5.4：白 0 / 蓝 1~2；黄/传 M3）
export const RARITY_AFFIX_COUNT = { white: 0, blue: [1, 2] };

const BASES = new Map(itemsData.items.map((b) => [b.id, b]));
const AFFIX_DEFS = new Map(
  Object.values(affixesData.pools)
    .flat()
    .map((a) => [a.affix, a])
);
// 品质权重（NUMBERS §6：白 60 / 蓝 32 / 黄 7.5 / 传 0.5——M2 只落地白+蓝，按 60:32 归一化；
// M3 加黄/传档位只需扩阈值，不改公式）
// #16 分域：region.blueChance 覆盖蓝装概率（1-1 = 0 纯白 / 1-2 = 0.12 小概率稀有）；
// 未填区域回落旧归一化口径（蓝 = 32/92 ≈ 34.8%），rng 消耗不变（品质 roll 照常步进，契约稳定）。
const QUALITY_WHITE = 60 / 92;

export function baseOf(baseId) {
  const b = BASES.get(baseId);
  if (!b) throw new Error(`equipment: 未知基底 ${baseId}`);
  return b;
}

export function affixDefOf(affixKey) {
  const def = AFFIX_DEFS.get(affixKey);
  if (!def) throw new Error(`equipment: 未知词缀 ${affixKey}`);
  return def;
}

export function emptyEquipment() {
  return Object.fromEntries(SLOTS.map((s) => [s, null]));
}

// 已穿实例数组（B 层叠：直接聚合 hero.equipment，背包不参与）
export function equippedItems(hero) {
  return SLOTS.map((s) => hero.equipment?.[s]).filter(Boolean);
}

// 实例词缀 + 基底隐含词缀的统一视图（#02：implicit 与 roll 词缀同桶吃）
export function allAffixes(hero) {
  const out = [];
  for (const inst of equippedItems(hero)) {
    for (const a of inst.affixes ?? []) out.push(a);
    const imp = baseOf(inst.baseId).implicit;
    if (imp) out.push(imp);
  }
  return out;
}

// 某词缀键的 Σvalue（含基底 implicit）
export function equipmentAffixTotal(hero, affixKey) {
  return allAffixes(hero).reduce((sum, a) => (a.affix === affixKey ? sum + a.value : sum), 0);
}

// 铸实例（#01 决策 ②：id 由调用方从 meta.nextItemId 取，纯自增不占 rng）
export function forgeInstance(baseId, id, rarity = "white", affixes = []) {
  return { id, baseId, rarity, affixes };
}

// 实例名 = 修饰词 + 基底名（#04：基底名固定，稀有度只加修饰词，"迅捷之铜锤"）
export function instanceName(inst) {
  const base = baseOf(inst.baseId);
  const first = inst.affixes?.[0];
  if (inst.rarity === "blue" && first) return affixDefOf(first.affix).mod + base.name;
  return base.name;
}

//—— 穿戴校验（#01：穿戴时拦——槽位匹配 + 需等级 + handedness 禁副手）
export function canEquip(hero, inst) {
  if (!inst) return { ok: false, reason: "无此装备" };
  const base = BASES.has(inst.baseId) ? BASES.get(inst.baseId) : null;
  if (!base) return { ok: false, reason: "未知基底" };
  if (!WEARABLE_SLOTS.has(base.slot)) return { ok: false, reason: "该槽位未解锁" };
  if (hero.level < base.reqLevel) return { ok: false, reason: `需等级 ${base.reqLevel}` };
  if (base.slot === "offhand") {
    const main = hero.equipment?.mainhand;
    if (main && baseOf(main.baseId).handedness === "two") {
      return { ok: false, reason: "双手武器禁用副手" };
    }
  }
  return { ok: true, reason: null };
}

function assertNotInCombat(state, heroId) {
  const fighting = (state.parties ?? []).some(
    (p) => p.status === "expedition" && (p.heroIds ?? []).includes(heroId)
  );
  if (fighting) throw new Error("equipment: 战斗/远征中禁止换装（#02 Q4）");
}

//—— 穿上：背包实例 → 装备位（同槽旧装卸下回背包；双手武器清空副手回背包）
export function equipItem(state, heroId, instanceId) {
  assertNotInCombat(state, heroId);
  const hero = state.heroes.find((h) => h.id === heroId);
  if (!hero) throw new Error(`equipment: 未知英雄 ${heroId}`);
  const idx = state.inventory.items.findIndex((i) => i.id === instanceId);
  if (idx < 0) throw new Error(`equipment: 背包中无实例 ${instanceId}`);
  const inst = state.inventory.items[idx];

  const check = canEquip(hero, inst);
  if (!check.ok) throw new Error(`equipment: 无法穿上——${check.reason}`);

  const bag = state.inventory.items.filter((i) => i.id !== instanceId);
  const equipment = { ...hero.equipment };
  const slot = slotOfInstance(inst);
  const old = equipment[slot];
  if (old) bag.push(old);
  equipment[slot] = inst;
  // 主手换上双手武器：副手强制为空（#01 决策 ①：PoE DisableOffhandSlot 同构）
  if (slot === "mainhand" && baseOf(inst.baseId).handedness === "two" && equipment.offhand) {
    bag.push(equipment.offhand);
    equipment.offhand = null;
  }
  return commit(state, heroId, hero, equipment, bag);
}

//—— 卸下：装备位实例 → 背包
export function unequipItem(state, heroId, slot) {
  assertNotInCombat(state, heroId);
  const hero = state.heroes.find((h) => h.id === heroId);
  if (!hero) throw new Error(`equipment: 未知英雄 ${heroId}`);
  if (!WEARABLE_SLOTS.has(slot)) throw new Error(`equipment: 槽位 ${slot} 未解锁`);
  const inst = hero.equipment?.[slot];
  if (!inst) return state;
  const equipment = { ...hero.equipment, [slot]: null };
  return commit(state, heroId, hero, equipment, [...state.inventory.items, inst]);
}

function slotOfInstance(inst) {
  return baseOf(inst.baseId).slot;
}

function commit(state, heroId, hero, equipment, bag) {
  return {
    ...state,
    heroes: state.heroes.map((h) => (h.id === heroId ? { ...hero, equipment } : h)),
    inventory: { ...state.inventory, items: bag },
  };
}

//—— 掉落 roll（#04 决策 ⑤ 击杀内 rng 次序：掉落判定 → 品质 → 基底 → 词缀数 → [词缀 pick → 数值]；
//    全程共用 meta.rngState 单流；实例 id 走 nextItemId 不占 rng；同键词缀去重取最优）
//    返回 { instance | null, nextItemId, rngState }；无掉率/无池的区域直接 null（不耗 rng）。
export function rollDrop(rngState, region, nextItemId) {
  if (!region.baseDropRate || !region.dropPool?.length) return null;
  const dropRoll = rngStep(rngState);
  if (dropRoll.value >= region.baseDropRate) {
    return { instance: null, nextItemId, rngState: dropRoll.state };
  }
  const qualityRoll = rngStep(dropRoll.state);
  const blueChance = region.blueChance ?? 1 - QUALITY_WHITE;
  const rarity = qualityRoll.value < 1 - blueChance ? "white" : "blue";

  const baseRoll = rngInt(qualityRoll.state, 0, region.dropPool.length - 1);
  const baseId = region.dropPool[baseRoll.value];
  let state = baseRoll.state;

  // 稀有度 → 词缀数（§5.4：白 0 / 蓝 1~2）；统一成 [lo,hi] 区间后 roll
  const countDef = RARITY_AFFIX_COUNT[rarity] ?? 0;
  const countRange = typeof countDef === "number" ? [countDef, countDef] : countDef;
  const affixes = [];
  if (countRange[1] > 0) {
    const countRoll = rngInt(state, countRange[0], countRange[1]);
    state = countRoll.state;
    const pool = affixesData.pools[baseOf(baseId).type];
    for (let i = 0; i < countRoll.value; i++) {
      const pickRoll = rngInt(state, 0, pool.length - 1);
      state = pickRoll.state;
      const def = pool[pickRoll.value];
      const valueRoll = rngInt(state, def.value[0], def.value[1]);
      state = valueRoll.state;
      affixes.push(def.stat ? { affix: def.affix, stat: def.stat, value: valueRoll.value } : { affix: def.affix, value: valueRoll.value });
    }
  }

  return {
    instance: forgeInstance(baseId, nextItemId, rarity, dedupeBest(affixes)),
    nextItemId: nextItemId + 1,
    rngState: state,
  };
}

// 同 affix 键重复 → 留数值更大的一条（#04 决策 ④；roll 照常消耗，去重在收集后做）
function dedupeBest(affixes) {
  const best = new Map();
  for (const a of affixes) {
    const cur = best.get(a.affix);
    if (!cur || a.value > cur.value) best.set(a.affix, a);
  }
  return [...best.values()];
}
