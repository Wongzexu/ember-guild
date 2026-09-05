// M2 装备→战力接线 —— prototype（探究接线公式 onshape，非正式代码）
// 问题：#02 装备→战力接线。推演装备数值如何进 heroStats/heroAttackRange/heroHitValue/applyDamage，
//      让「穿上变强可见」落地。B 层叠数据形态（#01 已定）：实例嵌 hero.equipment，背包只存未穿。
// 运行：node power-wiring-proto.mjs
// THROWAWAY：证实/推翻某条接线后，决策照录蓝图，本文件不进主分支。
//（逻辑模块保持纯函数、可lift入 hero.js；页面/演示层是throwaway。）

//=======================================================================
// 纯函数模块 —— 可直接 lift 进 game/src/engine/hero.js 的接线候选
//=======================================================================

//—— 基底表（items.json 候选：M2 只做武器+盾。字段对齐 #01 原型）
//    handedness 只在 weapon 上有意义；盾有 armor 无 damage/bps。implicit = 基底隐性词缀（§5.1）。
//    基底 = 固定名 + 固有值；铁锤/大锤是并列的不同基底类型，非「铜锤升级」。
const BASE_ITEMS = [
  { id: "copper-hammer", type: "weapon", handedness: "one", slot: "mainhand", subtype: "hammer", reqLevel: 1, damage: [1, 3], bps: 1.0, implicit: null },
  { id: "iron-hammer", type: "weapon", handedness: "one", slot: "mainhand", subtype: "hammer", reqLevel: 5, damage: [5, 9], bps: 1.0, implicit: { affix: "attack_speed_pct", value: 3 } },
  { id: "great-hammer", type: "weapon", handedness: "two", slot: "mainhand", subtype: "hammer", reqLevel: 5, damage: [10, 16], bps: 0.8, implicit: null },
  { id: "wood-shield", type: "shield", handedness: null, slot: "offhand", subtype: "phys", reqLevel: 1, armor: 8, implicit: null },
  { id: "oak-shield", type: "shield", handedness: null, slot: "offhand", subtype: "phys", reqLevel: 5, armor: 22, implicit: null },
];
const BASE_MAP = new Map(BASE_ITEMS.map((b) => [b.id, b]));

//—— 词缀池（蓝装 roll。§5.2/§5.3 节选；M2 只穿武器+盾，故两池）
//    字段：affix 键名 / stat（加分到 heroStats 用）/ value（区间）
const AFFIX_POOLS = {
  weapon: [
    { affix: "flat_str", stat: "str", value: [1, 2] },
    { affix: "flat_dex", stat: "dex", value: [1, 2] },
    { affix: "attack_speed_pct", value: [2, 3] },
    { affix: "phys_damage_pct", value: [7, 12] },
    { affix: "flat_phys", value: [1, 2] },
  ],
  shield: [
    { affix: "flat_vit", stat: "vit", value: [2, 4] },
    { affix: "armor_pct", value: [5, 10] },
    { affix: "block_pct", value: [2, 3] },
  ],
};

//—— 8 槽（WEAPONS §8）。M2 可穿 = mainhand + offhand，其余禁穿占位（#01）。
const SLOTS = ["mainhand", "offhand", "head", "body", "hands", "feet", "ring", "amulet"];

//—— hero.equipment 初始化（8 槽全空）／迁移后（mainhand 有实例）。
export function emptyEquipment() {
  return Object.fromEntries(SLOTS.map((s) => [s, null]));
}

//—— B 层叠：从 hero.equipment 取「已穿实例数组」（过滤空槽）。
export function equipped(hero) {
  return Object.values(hero.equipment ?? {}).filter(Boolean);
}

//—— 基底查询
export function baseOf(baseId) {
  const b = BASE_MAP.get(baseId);
  if (!b) throw new Error(`proto: 未知基底 ${baseId}`);
  return b;
}

//—— 总和器：某类词缀（equipped 的 affixes + 基底的 implicit）的 value 求和。
//    type: "flat_stat"（加分到 stats）| "percent"（增伤/攻速桶）
function affixSum(hero, filter) {
  let sum = 0;
  for (const item of equipped(hero)) {
    const affixes = [...(item.affixes ?? [])];
    if (item.implicit) affixes.push(item.implicit); // 基底隐性词缀也吃
    for (const a of affixes) if (filter(a)) sum += a.value;
  }
  return sum;
}

//—— 装备端总护甲（M2 = 副手盾的 base.armor + shield 池 armor_pct%）。
//    口径：base.armor 为基底固定护甲；armor_pct 加算到总护甲（% of base.armor? flat? —— #02 待议，先演示 flat add）。
export function heroArmor(hero) {
  let armor = 0;
  for (const item of equipped(hero)) {
    const base = baseOf(item.baseId);
    if (base.armor) armor += base.armor;
  }
  armor += affixSum(hero, (a) => a.affix === "armor_pct");
  return armor;
}

//—— 护甲减伤率（装备端 K_甲=300，§4.1）
export function armorReduction(hero) {
  const armor = heroArmor(hero);
  return (1 - 300 / (300 + armor)) * 100;
}

//—— 攻速（次/秒）：武器 BPS × (1 + DEX/100 + Σ攻速词缀% + 基底implicit攻速%)  (§4.1)
export function heroAttackSpeed(hero) {
  const main = hero.equipment?.mainhand;
  const base = main ? baseOf(main.baseId) : null;
  const bps = base?.bps ?? 1.0;
  const dexPct = heroStats(hero).dex / 100;
  const pctSum = affixSum(hero, (a) => a.affix === "attack_speed_pct") / 100;
  return bps * (1 + dexPct + pctSum);
}

//—— heroStats 扩展：基底 + 天赋（现有）+ 装备 flat_stat 词缀（#02 接线点 A）。
//    装备词缀带 .stat 字段 → 直接加分到五维；随后自然流进 heroHitValue（DEX/STR/INT）。
export function heroStats(hero) {
  const lv = hero.level;
  const growth = hero.growth ?? {};
  const base = hero.base ?? {};
  const stat = (key) => {
    const b = base[key] ?? 0;
    const extra = growth[key] ?? 0;
    return b + (lv - 1) * (1 + extra);
  };

  const stats = {
    str: stat("str"),
    dex: stat("dex"),
    vit: stat("vit"),
    int: stat("int"),
    agi: stat("agi"),
  };

  // 天赋：flat / resist / multi（现有逻辑）
  let flatHp = 0;
  let resist = 0;
  for (const t of activeTalents?.(hero) ?? []) {
    if (t.type === "flat") stats[t.stat] = (stats[t.stat] ?? 0) + t.value;
    else if (t.type === "resist") resist += t.value;
    else if (t.type === "multi") {
      for (const [k, v] of Object.entries(t.stats ?? {})) stats[k] = (stats[k] ?? 0) + v;
      flatHp += t.flatHp ?? 0;
    }
  }

  // 装备 flat_stat 词缀（#02 接线点 A：+力/+敏/+体 直接进 stats）。
  for (const a of affixSum_flatStats(hero)) stats[a.stat] = (stats[a.stat] ?? 0) + a.value;

  const HP_BASE = 100, HP_PER_VIT = 12;
  const K_RESIST = 300, RESIST_CAP = 75;
  const resistRate = (vit) => (1 - K_RESIST / (K_RESIST + vit)) * 100;
  const maxHp = HP_BASE + stats.vit * HP_PER_VIT + flatHp;
  const baseRes = resistRate(stats.vit);
  return {
    ...stats,
    maxHp,
    physRes: Math.min(RESIST_CAP, baseRes + resist),
    magRes: Math.min(RESIST_CAP, baseRes + resist),
  };
}

// 装备里带 .stat 的词缀（返回 [{stat,value}]）
function affixSum_flatStats(hero) {
  const out = [];
  for (const item of equipped(hero)) {
    for (const a of item.affixes ?? []) if (a.stat) out.push({ stat: a.stat, value: a.value });
  }
  return out;
}
const activeTalents = null; // 原型里不跑真实天赋表（demo 无条件词条），保持函数可 lift 时再接回

//—— 命中攻击值桶（#3 Q5 / #12 接线，已实现）：DEX×10 + 主属性×5（桥位×0.7）。
//    装备 +STR/+DEX 已进 heroStats → 这里自动吃到，无需另接线（#02 关键结论）。
const HIT_CONFIG = {
  str: { phys: { stat: "str", mult: 5 }, mag: null },
  dex: { phys: null, mag: null },
  int: { phys: null, mag: { stat: "int", mult: 5 } },
  strdex: { phys: { stat: "str", mult: 5 * 0.7 }, mag: null },
  dexint: { phys: null, mag: { stat: "int", mult: 5 * 0.7 } },
  strint: { phys: { stat: "str", mult: 5 * 0.7 }, mag: { stat: "int", mult: 5 * 0.7 } },
};
export function heroHitValue(hero) {
  const s = heroStats(hero);
  const cfg = HIT_CONFIG[hero.core] ?? HIT_CONFIG.str;
  const dexBase = s.dex * 10;
  const bucket = (rule) => (rule ? dexBase + s[rule.stat] * rule.mult : dexBase);
  return { phys: bucket(cfg.phys), mag: bucket(cfg.mag) };
}

//—— 伤害区间：装备武器 base.damage × (1+STR/100) × (1+Σ增伤%)。
//    #02 接线点 B：flat_phys 加进区间；phys_damage_pct 进 Σ增伤桶（与近战伤害% 同桶加算，§4.1）。
//    区间不再是写死的起始武器，而是「已穿主手」的 base.damage。
export function heroAttackRange(hero) {
  const main = hero.equipment?.mainhand;
  const base = main ? baseOf(main.baseId) : null;
  const dmg = base?.damage ?? [0, 0];
  const s = heroStats(hero);
  const flatPhys = affixSum(hero, (a) => a.affix === "flat_phys");
  const dmgPct = affixSum(hero, (a) => a.affix === "phys_damage_pct") / 100;
  const mult = (1 + s.str / 100) * (1 + dmgPct);
  return [Math.floor((dmg[0] + flatPhys) * mult), Math.floor((dmg[1] + flatPhys) * mult)];
}

//—— 敌方伤害走两段分层乘法（§4.1 / SYSTEMS §6）：装备端护甲减伤 × 属性端抗性率。
//    #02 接线点 C：applyDamage 只负责扣血（纯减法）；减伤两段在 stepExpeditions 算好后再传。
export function incomingDamageTaken({ enemyAtk, hero }) {
  const s = heroStats(hero);
  const armorDR = armorReduction(hero) / 100;
  const resistDR = s.physRes / 100;
  return Math.floor(enemyAtk * (1 - armorDR) * (1 - resistDR));
}

//=======================================================================
// 演示层 —— 非 lift 部分（throwaway）
//=======================================================================

// 艾格雷姆 Lv5（anvil：base str12/vit12/dex8/int5/agi7；growth str+0.4/vit+0.5；core=str）
function makeHero(level = 5) {
  return {
    level,
    core: "str",
    base: { str: 12, dex: 8, vit: 12, int: 5, agi: 7 },
    growth: { str: 0.4, vit: 0.5 },
    equipment: emptyEquipment(),
    // 迁移（#01）：起始铜锤铸成实例塞 mainhand，删除 weaponId 字段
  };
}

// 掉一张「蓝」实例（固定词缀演示，方便复现数字）
function makeInstance(id, baseId, rarity, affixes) {
  return { id, baseId, rarity, affixes };
}

function fmt(n) {
  return typeof n === "number" ? (Number.isInteger(n) ? n : n.toFixed(2)) : n;
}

const hero = makeHero(5);
// 迁移塞起始铜锤
hero.equipment.mainhand = makeInstance(1, "copper-hammer", "white", []);

// 背包两件（未穿）：蓝装 = 修饰词 + 基底（#04 命名口径：基底名固定、稀有度只加修饰词）
const inventory = {
  items: [
    // 蓝铜锤（迅捷之铜锤）：铜锤基底 + 2条词缀。基底类型不动、名字仍是铜锤。
    makeInstance(2, "copper-hammer", "blue", [
      { affix: "flat_str", stat: "str", value: 2 },
      { affix: "phys_damage_pct", value: 10 },
    ]),
    makeInstance(3, "oak-shield", "blue", [
      { affix: "flat_vit", stat: "vit", value: 3 },
    ]),
  ],
};

function report(hero, label) {
  const s = heroStats(hero);
  const [dmin, dmax] = heroAttackRange(hero);
  const hv = heroHitValue(hero);
  const main = hero.equipment?.mainhand;
  const mainName = main ? `${main.baseId}#${main.id}(${main.rarity})` : "（空手）";
  const shield = hero.equipment?.offhand;
  const shieldName = shield ? `${shield.baseId}#${shield.id}` : "（无盾）";
  console.log(`\n—— ${label} ——`);
  console.log(`  主手=${mainName} 副手=${shieldName}`);
  console.log(`  STR=${fmt(s.str)} DEX=${fmt(s.dex)} VIT=${fmt(s.vit)}`);
  console.log(`  攻击值(phys/mag)=${fmt(hv.phys)}/${fmt(hv.mag)}  伤害区间=${dmin}~${dmax}`);
  console.log(`  攻速=${fmt(heroAttackSpeed(hero))}/s  护甲=${fmt(heroArmor(hero))}  减伤=${fmt(armorReduction(hero))}%  物抗=${fmt(s.physRes)}%`);
  console.log(`  敌伤5 实收=${fmt(incomingDamageTaken({ enemyAtk: 5, hero }))}  敌伤20 实收=${fmt(incomingDamageTaken({ enemyAtk: 20, hero }))}`);
}

console.log("== M2 装备→战力接线 原型 ==");
report(hero, "初始（仅铜锤白装）");

const iron = inventory.items.find((i) => i.baseId === "copper-hammer" && i.rarity === "blue");
const oak = inventory.items.find((i) => i.baseId === "oak-shield");

// 穿讯捷之铜锤（蓝装）：对象从背包移入 mainhand（#01 B 层叠：穿走即移），旧铜锤回背包
inventory.items = inventory.items.filter((i) => i !== iron);
const oldMain = hero.equipment.mainhand;
hero.equipment.mainhand = iron;
inventory.items.push(oldMain);
report(hero, "穿蓝铜锤·迅捷之铜锤（+2力 / +10%物伤）");

// 再穿木盾（+3 VIT）
inventory.items = inventory.items.filter((i) => i !== oak);
hero.equipment.offhand = oak;
report(hero, "再穿蓝木盾（+3体 / 护甲22）");

// 双手武器演示（#01：handedness=two → 副手强制空）
console.log("\n[规则演示] 双手大锤 handedness=two → offhand 强制空；主手伤害区间改用大锤 10~16");
const hero2 = makeHero(5);
hero2.equipment.mainhand = makeInstance(9, "great-hammer", "white", []);
report(hero2, "双手大锤（无盾，offhand 禁穿）");
