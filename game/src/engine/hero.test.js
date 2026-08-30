import { describe, it, expect } from "vitest";
import {
  createHero,
  heroStats,
  heroAttackRange,
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
    expect(s.maxHp).toBe(100 + 12 * 12);
    // VIT12 → 1−300/312 = 3.846%
    expect(s.physRes).toBeCloseTo(3.846, 3);
    expect(s.magRes).toBeCloseTo(3.846, 3);
    expect(h.weaponId).toBe("copper-hammer");
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
    // 条件词条：武器被换成法杖则失效
    const caster = { ...h, weaponId: "not-found" };
    expect(heroDamageModifiers(caster).meleePct).toBe(0);
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
