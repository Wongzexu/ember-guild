// 英雄引擎（M1 · NUMBERS §3.5 口径一致）
// 公式：属性 = 起始 + (等级-1)×(1+核系数+家族轴) + 天赋（§3.2 === 唯一账本）；
// §3.5 投算表由 scripts/gen-hero-stats.mjs 从本文件 heroStats() 打印（文档=打印件）。
// 天赋词条数值随 #3 过审更新；风格：显示取整（向上），底层浮点。

import heroesData from "../data/heroes.json" with { type: "json" };
import { emptyEquipment, baseOf, forgeInstance, equippedItems, allAffixes, equipmentAffixTotal } from "./equipment.js";
import { xpToReach, levelFromXp, xpToNext } from "./xp.js";

const HERO_DEFS = new Map(heroesData.heroes.map((h) => [h.class, h]));

export function classDef(classKey) {
  const def = HERO_DEFS.get(classKey);
  if (!def) throw new Error(`hero: 未知职业 ${classKey}`);
  return def;
}

//—— 静态档位
const BASE_PER_LEVEL = 1;
export const HP_BASE = 100;
export const HP_PER_VIT = 12;
// 抗性转出正式曲线（#3 Q6）：抗性率 = 1 − K_抗/(K_抗+VIT)，K_抗=300（300=50% 转折锚，独立于护甲 K_甲=300）
// 75% = 硬上限（封天赋/词缀百分点叠加）；VIT 无装备膨胀源（防具池后缀只有+敏捷，无+VIT）才能直接入式不螺旋
export const K_RESIST = 300;
export const RESIST_CAP = 75;

function resistRate(vit) {
  return (1 - K_RESIST / (K_RESIST + vit)) * 100;
}

//—— 创建初始英雄（启动档：1 级、无经验）
// 起始武器直接铸成白装实例塞 equipment.mainhand（#01：weaponId 字段废除，
// 主手唯一真源 = equipment.mainhand；starterItemId 从 meta.nextItemId 取）
export function createHero(classKey, starterItemId = 1) {
  const def = classDef(classKey);
  const equipment = emptyEquipment();
  if (def.starterGear?.weapon && starterItemId != null) {
    equipment.mainhand = forgeInstance(def.starterGear.weapon, starterItemId);
  }
  return {
    id: def.id,
    class: def.class,
    name: def.name,
    title: def.title,
    personality: def.personality,
    background: def.background,
    origin: def.origin,
    visual: def.visual,
    quotes: def.quotes,
    level: 1,
    xp: 0,
    equipment,
    hp: null, // 战斗期由 startCombat/stats 初始化；null="满血待命"
  };
}

//—— 已生效天赋（<=level && 条件满足）；条件 schema：{ family: "melee" | "ranged" }（§3.3）
function isMeleeWeapon(item) {
  if (!item || item.type !== "weapon") return false;
  const rangedTypes = new Set(["bow", "crossbow"]);
  const casterTypes = new Set(["staff", "wand", "focus"]);
  if (rangedTypes.has(item.subtype) || casterTypes.has(item.subtype)) return false;
  return true;
}

export function talentActive(hero, talent) {
  if (talent.level > hero.level) return false;
  if (!talent.condition || !talent.condition.family) return true; // 通用词条无条件
  if (talent.condition.family === "melee") return isMeleeWeapon(weaponOf(hero));
  if (talent.condition.family === "ranged") return !isMeleeWeapon(weaponOf(hero));
  return true;
}

function activeTalents(hero) {
  const def = classDef(hero.class);
  return (def.talents ?? []).filter((t) => talentActive(hero, t));
}

//—— 五维点算（float；显示层 ceil）
export function heroStats(hero) {
  const def = classDef(hero.class);
  const lv = hero.level;
  const growth = def.growth ?? {};
  const stat = (key) => {
    const base = def.base?.[key] ?? 0;
    const extra = growth[key] ?? 0;
    return base + (lv - 1) * (BASE_PER_LEVEL + extra);
  };

  const stats = {
    str: stat("str"),
    dex: stat("dex"),
    vit: stat("vit"),
    int: stat("int"),
    agi: stat("agi"),
  };

  // 天赋：flat / resist / multi
  let flatHp = 0;
  let resist = 0;
  for (const t of activeTalents(hero)) {
    if (t.type === "flat") {
      stats[t.stat] = (stats[t.stat] ?? 0) + t.value;
    } else if (t.type === "resist") {
      resist += t.value;
    } else if (t.type === "multi") {
      for (const [k, v] of Object.entries(t.stats ?? {})) {
        stats[k] = (stats[k] ?? 0) + v;
      }
      flatHp += t.flatHp ?? 0;
    }
  }

  // 装备词缀（#02 接线点 A）：+属性折进五维、+生命上限折进 flatHp ——
  // 自动流进 maxHp / heroHitValue / 攻速（DEX），换装即联动面板
  for (const a of allAffixes(hero)) {
    if (a.stat) stats[a.stat] = (stats[a.stat] ?? 0) + a.value;
    else if (a.affix === "flat_hp") flatHp += a.value;
  }

  const maxHp = HP_BASE + stats.vit * HP_PER_VIT + flatHp;
  const baseRes = resistRate(stats.vit);
  return {
    ...stats,
    maxHp,
    physRes: Math.min(RESIST_CAP, baseRes + resist),
    magRes: Math.min(RESIST_CAP, baseRes + resist),
  };
}

//—— 武器（已穿主手实例的基底；战斗数值接线见 heroAttackRange / heroAttackSpeed）
export function weaponOf(hero) {
  const inst = hero.equipment?.mainhand;
  return inst ? baseOf(inst.baseId) : null;
}

//—— 伤害/攻速增幅（非五维天赋；M1 只接线近战增伤——攻速乘区 M2 计时钟接入，
//    "攻速接线"首个乘区测试用例 = Lv.25 词条，见 NUMBERS §4.1 之 #3 Q3）
export function heroDamageModifiers(hero) {
  let meleePct = 0;
  let attackSpeedPct = 0;
  for (const t of activeTalents(hero)) {
    if (t.type === "melee_damage_pct") meleePct += t.value;
    else if (t.type === "attack_speed") attackSpeedPct += t.value;
  }
  return { meleePct, attackSpeedPct };
}

//—— 命中攻击值桶（#3 Q5 定稿 · NUMBERS §4.1 / SYSTEMS §2.1 · #12 接线）
//    物理攻击值 = DEX×10 + 主属性×5（力量侧职；智慧侧职此桶只有 DEX×10）；
//    法术攻击值 = DEX×10 + 主属性×5（智慧侧职；力量侧职只有 DEX×10）；纯敏两桶只 DEX×10。
//    桥位折扣 0.7（#12 同批定比值：主属性×5 → ×3.5，与闪避 70/30 成对）：
const BRIDGE_HIT_DISCOUNT = 0.7;
const HIT_CONFIG = {
  str: { phys: { stat: "str", mult: 5 }, mag: null }, // 纯力（力量侧）
  dex: { phys: null, mag: null }, // 纯敏（轴·两桶只 DEX×10，DEX 自身最高）
  int: { phys: null, mag: { stat: "int", mult: 5 } }, // 纯智（智慧侧）
  strdex: { phys: { stat: "str", mult: 5 * BRIDGE_HIT_DISCOUNT }, mag: null }, // 桥位（力敏·物理为主）
  dexint: { phys: null, mag: { stat: "int", mult: 5 * BRIDGE_HIT_DISCOUNT } }, // 桥位（敏智·法术为主）
  strint: { phys: { stat: "str", mult: 5 * BRIDGE_HIT_DISCOUNT }, mag: { stat: "int", mult: 5 * BRIDGE_HIT_DISCOUNT } }, // 桥位（力智·双给）
};

export function heroCoreHitRules(core) {
  const cfg = HIT_CONFIG[core];
  if (!cfg) throw new Error(`hero: 未知核位 ${core}`);
  return cfg;
}

export function heroHitValue(hero) {
  const s = heroStats(hero);
  const cfg = heroCoreHitRules(classDef(hero.class).core);
  const dexBase = s.dex * 10;
  const bucket = (rule) => (rule ? dexBase + s[rule.stat] * rule.mult : dexBase);
  return { phys: bucket(cfg.phys), mag: bucket(cfg.mag) };
}

//—— 攻击力（#02 接线点 B / §4.1）：区间 = (基底伤害+Σflat_phys) × (1+STR/100) × (1+Σ增伤%)；
//    Σ增伤% 桶内加算（#3 Q3）= 天赋近战伤% + 装备物理伤%；
//    命中修正已接入 expedition.js 战斗管线（#12），伤害掷骰前由命中率闸门决定
export function heroAttackRange(hero) {
  const main = hero.equipment?.mainhand;
  const base = main ? baseOf(main.baseId) : null;
  const dmg = base?.damage;
  if (!dmg) return [0, 0];
  const s = heroStats(hero);
  const flatPhys = equipmentAffixTotal(hero, "flat_phys");
  const dmgPct = heroDamageModifiers(hero).meleePct + equipmentAffixTotal(hero, "phys_damage_pct");
  const mult = (1 + s.str / 100) * (1 + dmgPct / 100);
  return [Math.floor((dmg[0] + flatPhys) * mult), Math.floor((dmg[1] + flatPhys) * mult)];
}

//—— 攻速（#02 接线点 ③ / §4.1）：武器 BPS × (1 + DEX/100 + Σ攻速%)；
//    Σ攻速% = 天赋攻速% + 装备攻速词缀% + 基底隐含攻速%（allAffixes 一并计入）
//    供 expedition.js nextAttackAt 时钟换算 interval = 1000 / attackSpeed
export function heroAttackSpeed(hero) {
  const main = hero.equipment?.mainhand;
  const base = main ? baseOf(main.baseId) : null;
  const bps = base?.bps ?? 1.0;
  const dexPct = heroStats(hero).dex / 100;
  const pct = heroDamageModifiers(hero).attackSpeedPct + equipmentAffixTotal(hero, "attack_speed_pct");
  return bps * (1 + dexPct + pct / 100);
}

//—— 护甲（#02 接线点 ④ / §4.1 K_甲=300）：总护甲 = Σ(基底护甲 + flat 护甲词缀)；
//    armor_pct 乘区推迟 M3（#02 Q3）；减伤与属性端抗性分层乘法，结算在 expedition.js
export const ARMOR_K = 300;

export function heroArmor(hero) {
  let armor = 0;
  for (const inst of equippedItems(hero)) {
    armor += baseOf(inst.baseId).armor ?? 0;
  }
  return armor + equipmentAffixTotal(hero, "flat_armor");
}

export function armorReduction(hero) {
  return (1 - ARMOR_K / (ARMOR_K + heroArmor(hero))) * 100;
}

export function xpGainHooks(hero) {
  return { current: hero.xp, next: xpToNext(hero.xp, hero.level), reach: xpToReach(hero.level + 1) };
}

export function levelOf(hero) {
  return levelFromXp(hero.xp);
}

//—— 经验入账 → 新英雄对象（升级回压 HP 差额）
export function grantXp(hero, amount) {
  const before = heroStats(hero);
  const oldLevel = hero.level;
  const xp = hero.xp + amount;
  const level = levelFromXp(xp);
  const next = { ...hero, xp, level };
  const after = heroStats(next);
  if (level > oldLevel) {
    const delta = after.maxHp - before.maxHp;
    next.hp = next.hp === null ? after.maxHp : Math.min(after.maxHp, next.hp + delta);
  } else {
    next.hp = next.hp === null ? null : Math.min(after.maxHp, next.hp);
  }
  return next;
}

//—— 战斗 HP 初始化 / 结算
export function ensureCombatHp(hero) {
  if (hero.hp !== null) return hero;
  return { ...hero, hp: heroStats(hero).maxHp };
}

export function applyDamage(hero, dmg) {
  const s = heroStats(hero);
  const hp = (hero.hp ?? s.maxHp) - dmg;
  return { ...hero, hp };
}

export function healAfterKill(hero) {
  // 占位：每击杀回复 50% 最大 HP（M1 首区保护性回血——怪伤均值 ~5、一杀≈17 回合，
  // 50% 回血可稳挂；真食物/药水系统 M2 §4.2 替换，回血量随系统落地微调）
  const s = heroStats(hero);
  const hp = Math.min(s.maxHp, (hero.hp ?? s.maxHp) + s.maxHp * 0.5);
  return { ...hero, hp };
}

export function bringHome(hero) {
  // 战败撤回：回满 + 面板恢复
  return { ...hero, hp: null, xp: hero.xp };
}

export { classDef as getHeroClassDef };
