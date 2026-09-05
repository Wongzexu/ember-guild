// M2 装备数据模型 —— prototype（探究数据形态 onshape，非正式代码）
// 问题：#01 装备数据模型。推演 B 层叠形态：实例对象嵌 hero.equipment，背包只存未穿。
// 运行：node equipment-model-proto.mjs
// THROWAWAY：证实/推翻某个数据形态后，决策照录蓝图，本文件不进主分支。

//—— 1. 基底表（items.json 候选形态：M2 只做武器+盾，其余类字段齐备但先不建）
//    字段：id/type/handedness/slot/reqLevel/damage|armor/bps/implicit
//    handedness 只在 weapon 上有意义（one|two）；盾/防具/饰品无此字段。
const BASE_ITEMS = [
  { id: "copper-hammer", type: "weapon", handedness: "one", slot: "mainhand", subtype: "hammer", reqLevel: 1, damage: [1, 3], bps: 1.0, implicit: null },
  { id: "iron-hammer", type: "weapon", handedness: "one", slot: "mainhand", subtype: "hammer", reqLevel: 5, damage: [5, 9], bps: 1.0, implicit: { affix: "attack_speed", value: 3 } },
  { id: "wood-shield", type: "shield", handedness: null, slot: "offhand", subtype: "phys", reqLevel: 1, armor: 8, implicit: null },
];

//—— 2. 8 槽定义（WEAPONS §8）。键 = 槽位。
const SLOTS = ["mainhand", "offhand", "head", "body", "hands", "feet", "ring", "amulet"];

//—— 3. 词缀池（蓝装 roll 用。§5.2/§5.3 节选）。池按部位归：weapon 池 / shield 池 / armor 池。
//    M2 实际只穿武器+盾，故两张池先用；其余部位池留白 M3 填。
const AFFIX_POOLS = {
  weapon: [
    { affix: "flat_str", stat: "str", value: [1, 2] },
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

// 稀有度 → 词缀数（§5.4：白=0 / 蓝=1~2）。M2 只白+蓝。
const AFFIX_COUNT = { white: 0, blue: [1, 2] };

//—— 4. B 层叠形态推演。rng 用简单线性同余示例（真 rng 后面接引擎的 rngState；实例 id 不入 rng）。
let demoSeed = 42;
function nextRng() {
  demoSeed = (demoSeed * 1103515245 + 12345) & 0x7fffffff;
  return demoSeed / 0x7fffffff;
}
let nextId = 1; // 实例 id：单调自增主键，独立于 rng（#01 决策 ②）

// 先 roll 稀有度（§6 品质权重：白 60% / 蓝 32% / 黄 7.5% / 传 0.5%；M2 只落地白+蓝，故"非白即蓝"≈60/40 演示）
function rollRarity() {
  const r = nextRng();
  return r < 0.6 ? "white" : "blue";
}
// 再按稀有度定词缀数（§5.4：蓝=1~2）。注意：稀有度与词缀数是两个概念，勿混成一个 roll（#04 定实落）。
function rollAffixCount(rarity) {
  const range = AFFIX_COUNT[rarity];
  if (range === 0) return 0;
  return Math.floor(nextRng() * (range[1] - range[0] + 1)) + range[0];
}

// 投出实例对象（B 形态：实例是对象，含 id/baseId/rarity/affixes）
function rollItem(base) {
  const rarity = rollRarity();
  const pool = base.type === "shield" ? AFFIX_POOLS.shield : AFFIX_POOLS.weapon; // 按 item 类型选池（盾走 shield 池）
  const affixes = [];
  for (let i = 0; i < rollAffixCount(rarity); i++) {
    const pick = pool[Math.floor(nextRng() * pool.length)];
    affixes.push({ affix: pick.affix, val: Math.floor(nextRng() * (pick.value[1] - pick.value[0] + 1)) + pick.value[0] });
  }
  return { id: nextId++, baseId: base.id, rarity, affixes };
}

//—— 5. 推演 B 层叠：背包存未穿实例对象；穿 = 对象从背包移入 hero.equipment；换 = 旧对象卸下回背包。
function demo() {
  console.log("== M2 装备数据形态 · B 层叠 ==");
  console.log("8 槽:", SLOTS.join(" / "));

  // 英雄起始：B 形态 equipment = 8 槽对象全空；M1 老档的 weaponId 已在迁移时铸成实例塞进 mainhand（#01 必修2）
  const hero = { level: 5, equipment: { mainhand: null, offhand: null, head: null, body: null, hands: null, feet: null, ring: null, amulet: null } };
  const inventory = { items: [] };

  // 迁移铸初始铜锤（起始武器 → 实例 id=1 white 0词缀）
  const starter = { id: nextId++, baseId: "copper-hammer", rarity: "white", affixes: [] };
  hero.equipment.mainhand = starter;
  console.log("\n迁移：起始铜锤铸成实例 id=%d 塞进 mainhand（删除旧 weaponId 字段）", starter.id);
  console.log("  hero 上无 weaponId，主手唯一真源 = equipment.mainhand");

  // 掉落两件：蓝铜锤（迅捷之铜锤：铜锤基底+词缀）+ 白木盾
  const iron = rollItem(BASE_ITEMS[1]);
  const shield = rollItem(BASE_ITEMS[2]);
  inventory.items.push(iron, shield);
  console.log("\n掉落入背包：", inventory.items.map((i) => `${i.baseId}#${i.id}(${i.rarity})`));

  // 穿铁锤：对象从背包移入 mainhand（== 对象身份移动，不该还剩一份）
  inventory.items = inventory.items.filter((i) => i !== iron);
  const oldMain = hero.equipment.mainhand;
  hero.equipment.mainhand = iron;
  inventory.items.push(oldMain); // 卸下的铜锤回背包
  console.log("\n穿铁锤：mainhand = %s#%d，旧铜锤卸下回背包", iron.baseId, iron.id);
  console.log("  背包:", inventory.items.map((i) => `${i.baseId}#${i.id}(${i.rarity})`));
  console.log("  检查主手唯一真源：hero.equipment.mainhand.baseId =", hero.equipment.mainhand.baseId);

  // 穿木盾：对象从背包移入 offhand
  inventory.items = inventory.items.filter((i) => i !== shield);
  hero.equipment.offhand = shield;
  console.log("\n穿木盾：offhand = %s#%d，背包:", shield.baseId, shield.id, inventory.items.map((i) => `${i.baseId}#${i.id}(${i.rarity})`));

  // 读词缀叠加（B 形态：直接从 hero.equipment 聚合，无需查背包）
  const equipped = Object.values(hero.equipment).filter(Boolean);
  const flatStr = equipped.flatMap((e) => e.affixes).filter((a) => a.stat === "str").reduce((s, a) => s + a.val, 0);
  console.log("\n穿装后 Σ词缀(flat_str) =", flatStr, "（B 形态读 hero.equipment 即可，背包不参与）");

  // 双手武器演示：handedness=two → 副手强制空（PoE DisableOffhandSlot 同构）。规则层，非双引用。
  const twoHand = { ...BASE_ITEMS[0], id: "great-hammer", handedness: "two" };
  console.log("\n[规则演示] 双手武器 %s: handedness=two → offhand 强制为空 + UI 灰态占位", twoHand.id);
  console.log("  (数据层无第二实体、无双槽引用；canEquip/equipResult 纯函数校验)");
}

demo();
