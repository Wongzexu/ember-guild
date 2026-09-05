import { describe, it, expect } from "vitest";
import {
  createHero,
  heroStats,
  heroAttackRange,
  heroAttackSpeed,
  heroArmor,
  armorReduction,
  heroDamageModifiers,
  heroHitValue,
  heroCoreHitRules,
  grantXp,
  ensureCombatHp,
  applyDamage,
  healAfterKill,
  bringHome,
  weaponOf,
} from "./hero.js";

describe("hero 引擎（NUMBERS §3.5 占位）", () => {
  it("创建初始英雄：Lv1 五维与占位表一致", () => {
    const h = createHero("anvil");
    const s = heroStats(h);
    expect(s.str).toBe(12);
    expect(s.dex).toBe(8);
    expect(s.vit).toBe(12);
    expect(s.int).toBe(5);
    expect(s.agi).toBe(7);
    expect(h.origin).toMatchObject({ prototype: "Sworn Defender", connection: "oath-echo" });
    expect(h.background).toContain("远古护卫");
    expect(s.maxHp).toBe(100 + 12 * 12);
    // VIT12 → 1−300/312 = 3.846%
    expect(s.physRes).toBeCloseTo(3.846, 3);
    expect(s.magRes).toBeCloseTo(3.846, 3);
    // 起始武器 = 铸成白装实例入 mainhand（#01：weaponId 字段废除）
    expect(h.equipment.mainhand).toEqual({
      id: 1,
      baseId: "copper-hammer",
      rarity: "white",
      affixes: [],
    });
    expect(Object.keys(h.equipment).length).toBe(8);
    expect(h.weaponId).toBeUndefined();
  });

  it("升级增益：Lv5 STR=12+4×1.4+5(天赋)=22.6、VIT=18", () => {
    const h = { ...createHero("anvil"), level: 5, xp: 388 };
    const s = heroStats(h);
    expect(s.str).toBeCloseTo(22.6, 5);
    expect(s.vit).toBeCloseTo(18, 5);
    expect(s.maxHp).toBe(100 + 18 * 12);
    // VIT18 → 1−300/318 = 5.660%
    expect(s.physRes).toBeCloseTo(5.660, 3);
  });

  it("Lv10 天赋双抗+5%", () => {
    const h = { ...createHero("anvil"), level: 10, xp: 1154 };
    const s = heroStats(h);
    // VIT=12+9×1.5=25.5 → 1−300/325.5 = 7.834% + 天赋 5%
    expect(s.physRes).toBeCloseTo(12.834, 3);
  });

  it("武器基底（铜锤 1–3）；攻击区间 = 锤伤×(1+STR/100)", () => {
    const h = createHero("anvil");
    expect(weaponOf(h).damage).toEqual([1, 3]);
    const [min, max] = heroAttackRange(h);
    expect(min).toBe(Math.floor(1 * 1.12));
    expect(max).toBe(Math.floor(3 * 1.12));
  });

  it("升级经验回压 HP 差额，且不超过新上限", () => {
    const h = ensureCombatHp({ ...createHero("anvil"), xp: 0 });
    const before = heroStats(h);
    const maxHpBefore = before.maxHp;
    const next = grantXp(h, 388); // 1 → 5
    expect(next.level).toBe(5);
    expect(next.hp).toBeCloseTo(maxHpBefore + (heroStats(next).maxHp - maxHpBefore), 5);
    const damaged = applyDamage(ensureCombatHp(h), 50);
    expect(damaged.hp).toBeCloseTo(maxHpBefore - 50, 5);
  });

  it("Lv20 天赋：生命+50 & STR+3/VIT+4/DEX+2/AGI+1（多而小·无 INT）", () => {
    const h = { ...createHero("anvil"), level: 20, xp: 6730 };
    const s = heroStats(h);
    // STR 12+19×1.4=38.6 +5+3 = 46.6；VIT 12+19×1.5=40.5 +10+4 = 54.5；DEX 8+19+2=29；AGI 7+19+1=27；INT 5+19=24
    expect(s.str).toBeCloseTo(46.6, 5);
    expect(s.vit).toBeCloseTo(54.5, 5);
    expect(s.dex).toBeCloseTo(29, 5);
    expect(s.agi).toBeCloseTo(27, 5);
    expect(s.int).toBeCloseTo(24, 5);
    expect(s.maxHp).toBeCloseTo(100 + 54.5 * 12 + 50, 5);
  });

  it("Lv25 攻速+10%（乘区读值；M1 战斗不接线）", () => {
    const h = { ...createHero("anvil"), level: 25, xp: 12360 };
    const mods = heroDamageModifiers(h);
    expect(mods.attackSpeedPct).toBe(10);
  });

  it("Lv30 近战伤害+15%：持近战武器乘区生效；无武器条件不生效", () => {
    const h = { ...createHero("anvil"), level: 30, xp: 17600 };
    const mods = heroDamageModifiers(h);
    expect(mods.meleePct).toBe(15);
    const [min, max] = heroAttackRange(h);
    // Lv30 STR = 12+29×1.4+5+3 = 60.6 → (1+0.606) × 1.15
    expect(min).toBe(Math.floor(1 * 1.606 * 1.15));
    expect(max).toBe(Math.floor(3 * 1.606 * 1.15));
    // 条件词条：主手无武器（空手）则不生效
    const bare = { ...h, equipment: { ...h.equipment, mainhand: null } };
    expect(heroDamageModifiers(bare).meleePct).toBe(0);
  });

  it("击杀回血 50% 上限封顶、战败撤回回满", () => {
    const h = ensureCombatHp(createHero("anvil"));
    const maxHp = heroStats(h).maxHp;
    const hurt = applyDamage(h, 100);
    expect(hurt.hp).toBeCloseTo(maxHp - 100, 5);
    const healed = healAfterKill(hurt);
    // 144 + 122 > maxHp → 封顶 maxHp
    expect(healed.hp).toBe(maxHp);
    const full = healAfterKill({ ...h, hp: maxHp });
    expect(full.hp).toBe(maxHp);
    const home = bringHome(hurt);
    expect(home.hp).toBe(null);
  });
});

describe("hero 命中攻击值桶（#12 · NUMBERS §4.1 六核口径）", () => {
  it("HIT_CONFIG：纯力/纯智主属性×5；纯敏两桶无加值；桥位 ×3.5（0.7 折扣）", () => {
    const str = heroCoreHitRules("str");
    expect(str.phys).toEqual({ stat: "str", mult: 5 });
    expect(str.mag).toBeNull();
    const dex = heroCoreHitRules("dex");
    expect(dex.phys).toBeNull();
    expect(dex.mag).toBeNull();
    const intt = heroCoreHitRules("int");
    expect(intt.phys).toBeNull();
    expect(intt.mag).toEqual({ stat: "int", mult: 5 });
    for (const core of ["strdex", "dexint", "strint"]) {
      const rules = heroCoreHitRules(core);
      for (const side of ["phys", "mag"]) {
        const rule = rules[side];
        if (rule) expect(rule.mult).toBeCloseTo(3.5, 5);
      }
    }
    const strint = heroCoreHitRules("strint");
    expect(strint.phys.stat).toBe("str");
    expect(strint.mag.stat).toBe("int");
  });
});

describe("#02 装备→战力接线（NUMBERS §4.1 / 蓝图 #02）", () => {
  const withMain = (hero, inst) => ({ ...hero, equipment: { ...hero.equipment, mainhand: inst } });
  const withOff = (hero, inst) => ({ ...hero, equipment: { ...hero.equipment, offhand: inst } });
  const mk = (id, baseId, rarity, affixes) => ({ id, baseId, rarity, affixes });

  it("+STR 词缀折进 heroStats → 自动流进命中攻击值桶", () => {
    const h = withMain({ ...createHero("anvil"), level: 5, xp: 388 }, mk(2, "copper-hammer", "blue", [
      { affix: "flat_str", stat: "str", value: 2 },
    ]));
    expect(heroStats(h).str).toBeCloseTo(22.6 + 2, 5);
    expect(heroHitValue(h).phys).toBeCloseTo(12 * 10 + 24.6 * 5, 5);
  });

  it("伤害区间 = (基底+Σflat_phys) × (1+STR/100) × (1+Σ增伤%)，增伤桶内加算", () => {
    const h = withMain(createHero("anvil"), mk(2, "copper-hammer", "blue", [
      { affix: "flat_phys", value: 2 },
      { affix: "phys_damage_pct", value: 10 },
    ]));
    // Lv1 STR12 → (1+2)×1.12×1.10 = 4.0458 / (3+2)×1.232 = 6.7433
    const [min, max] = heroAttackRange(h);
    expect(min).toBe(Math.floor(3 * 1.12 * 1.1));
    expect(max).toBe(Math.floor(5 * 1.12 * 1.1));
  });

  it("攻速 = BPS × (1 + DEX/100 + 天赋% + 词缀% + 基底隐含%)", () => {
    // 铁锤隐含 +3%：Lv1 DEX8 → 1.0×(1+0.08+0.03) = 1.11
    const lv1 = withMain(createHero("anvil"), mk(2, "iron-hammer", "white", []));
    expect(heroAttackSpeed(lv1)).toBeCloseTo(1.11, 5);
    // Lv25（含 Lv20 天赋 DEX+2 → 34）天赋攻速+10%：1.0×(1+0.34+0.03+0.10) = 1.47
    const lv25 = withMain({ ...createHero("anvil"), level: 25, xp: 12360 }, mk(2, "iron-hammer", "white", []));
    expect(heroAttackSpeed(lv25)).toBeCloseTo(1.47, 5);
  });

  it("护甲 = Σ(基底+flat 词缀)；减伤 = 1−300/(300+护甲)（K_甲=300）", () => {
    const oak = mk(2, "oak-shield", "white", []);
    expect(heroArmor(withOff(createHero("anvil"), oak))).toBe(22);
    expect(armorReduction(withOff(createHero("anvil"), oak))).toBeCloseTo(
      (1 - 300 / 322) * 100,
      5
    );
    const reinforced = mk(3, "oak-shield", "blue", [{ affix: "flat_armor", value: 6 }]);
    expect(heroArmor(withOff(createHero("anvil"), reinforced))).toBe(28);
    expect(armorReduction(withOff(createHero("anvil"), reinforced))).toBeCloseTo(
      (1 - 300 / 328) * 100,
      5
    );
  });

  it("+生命上限词缀折进 flatHp 桶（maxHp 联动）", () => {
    const h = withOff(createHero("anvil"), mk(2, "wood-shield", "blue", [
      { affix: "flat_hp", value: 15 },
    ]));
    expect(heroStats(h).maxHp).toBe(100 + 12 * 12 + 15);
  });

  it("空手：区间 [0,0]、护甲 0、攻速回落 BPS=1 基线", () => {
    const bare = { ...createHero("anvil"), equipment: { ...createHero("anvil").equipment, mainhand: null } };
    expect(heroAttackRange(bare)).toEqual([0, 0]);
    expect(heroArmor(bare)).toBe(0);
    expect(armorReduction(bare)).toBe(0);
    expect(heroAttackSpeed(bare)).toBeCloseTo(1.08, 5);
  });

  it("双手大锤：伤害区间/攻速随基底（bps 0.8），词缀接线一致", () => {
    const h = withMain(createHero("anvil"), mk(2, "great-hammer", "white", []));
    const [min, max] = heroAttackRange(h);
    expect(min).toBe(Math.floor(10 * 1.12));
    expect(max).toBe(Math.floor(16 * 1.12));
    expect(heroAttackSpeed(h)).toBeCloseTo(0.8 * 1.08, 5);
  });
});
