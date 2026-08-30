import { describe, it, expect } from "vitest";
import {
  createParty,
  startExpedition,
  stopExpedition,
  stepExpeditions,
  regionDef,
  standardAttackValue,
  enemyDodgeValue,
  hitChance,
} from "./expedition.js";
import { tick, createInitialState } from "./core.js";
import { heroStats, heroHitValue, heroCoreHitRules, createHero } from "./hero.js";

function makeRun(iterations) {
  let s = createInitialState();
  s = { ...s, parties: [startExpedition(createParty("eigrem", "mist-fringe"))] };
  for (let i = 0; i < iterations; i++) {
    s = tick(s, 500);
  }
  return s;
}

describe("expedition（M1 窄战斗）", () => {
  it("区域表：迷雾边缘首区解锁（Lv1/组织1）", () => {
    const r = regionDef("mist-fringe");
    expect(r.unlock.orgLevel).toBe(1);
    expect(r.unlock.heroLevel).toBe(1);
    expect(r.xp).toBe(20);
  });

  it("出征后持续击杀：金币与经验增长", () => {
    let s = createInitialState();
    s = {
      ...s,
      parties: [startExpedition(createParty("eigrem", "mist-fringe"))],
    };
    // 999 次 tick ≈ 8 分钟挂机
    const t0 = Date.now();
    for (let i = 0; i < 999; i++) s = tick(s, 500);
    const party = s.parties[0];
    expect(party.killCount).toBeGreaterThan(0);
    expect(party.goldEarned).toBeGreaterThan(0);
    expect(s.org.gold).toBeGreaterThan(0);
    expect(s.heroes[0].xp).toBeGreaterThan(0);
    expect(s.heroes[0].level).toBeGreaterThan(1);
    void t0;
  });

  it("停战：状态回 idle 不再推进", () => {
    let s = createInitialState();
    let p = startExpedition(createParty("eigrem", "mist-fringe"));
    s = { ...s, parties: [p] };
    s = tick(s, 500);
    s = { ...s, parties: [stopExpedition(s.parties[0])] };
    const kills = s.parties[0].killCount;
    const xp = s.heroes[0].xp;
    for (let i = 0; i < 10; i++) s = tick(s, 500);
    expect(s.parties[0].killCount).toBe(kills);
    expect(s.heroes[0].xp).toBe(xp);
    expect(s.parties[0].status).toBe("idle");
  });

  it("战败撤回：HP 归零触发事件并回组织", () => {
    // 构造必败：伪造区（怪 1 伤 hp 巨大靠 hero 不能撑）——简化：直接压英雄 HP 至 1
    let s = createInitialState();
    const hero = { ...s.heroes[0], hp: 1 };
    s = { ...s, heroes: [hero], parties: [startExpedition(createParty("eigrem", "mist-fringe"))] };
    // 多次 tick（怪必反击命中一次即死）
    let hurt = false;
    for (let i = 0; i < 200 && !hurt; i++) {
      s = tick(s, 500);
      if (s.parties[0].status === "idle" && s.parties[0].monster === null) hurt = true;
    }
    expect(hurt).toBe(true);
    expect(s.parties[0].status).toBe("idle");
    expect(s.heroes[0].hp).toBe(null); // 回满待命
    expect(s.chronicle.length).toBeGreaterThan(1);
    expect(s.chronicle[s.chronicle.length - 1].text).toContain("负伤撤回");
  });

  it("tick(0) 原样返回、非法 dt 抛错", () => {
    const s = createInitialState();
    expect(tick(s, 0)).toBe(s);
    expect(() => tick(s, -1)).toThrow();
    expect(() => tick(s, NaN)).toThrow();
  });

  it("确定性：相同种子 → 相同结果", () => {
    const runs = [makeRun(50), makeRun(50)];
    expect(runs[0].parties[0].killCount).toBe(runs[1].parties[0].killCount);
    expect(runs[0].org.gold).toBe(runs[1].org.gold);
    expect(runs[0].heroes[0].xp).toBe(runs[1].heroes[0].xp);
  });

  it("英雄等级提升后最大 HP 增长且 HP 跟随", () => {
    const s = makeRun(999);
    const st = heroStats(s.heroes[0]);
    expect(st.maxHp).toBeGreaterThan(100 + 12 * 12);
  });
});

describe("#12 命中/闪避通电（NUMBERS §4.1 契约）", () => {
  it("同级标准攻击值：纯敏基准 DEX×10（Lv1≈120/Lv50≈806/Lv90≈1366）", () => {
    expect(standardAttackValue(1)).toBeCloseTo(120, 5);
    expect(standardAttackValue(50)).toBeCloseTo(806, 5);
    expect(standardAttackValue(90)).toBeCloseTo(1366, 5);
  });

  it("分档锚点：同级别 ×1/×3/×8/×15 → 95/86/70/56% 与等级无关", () => {
    // ÷19 数学形式：同级白怪 = 攻击值/(攻击值+攻击值/19) = 95%
    for (const level of [1, 50, 90]) {
      const atk = standardAttackValue(level);
      expect(hitChance(atk, enemyDodgeValue(1, level))).toBeCloseTo(0.95, 5);
      expect(hitChance(atk, enemyDodgeValue(3, level))).toBeCloseTo(0.864, 2);
      expect(hitChance(atk, enemyDodgeValue(8, level))).toBeCloseTo(0.704, 2);
      expect(hitChance(atk, enemyDodgeValue(15, level))).toBeCloseTo(0.559, 2);
    }
  });

  it("封底不封顶：5% 地板 + 碾压 100% 顺滑（无 95% 天花板）", () => {
    expect(hitChance(1, 1e9)).toBe(0.05); // 地板
    expect(hitChance(1e9, 1)).toBe(1); // 无特例碾压
    expect(hitChance(100, 0)).toBe(1); // D=0 → 100%
  });

  it("越级体感：Lv1 打 Lv90 白怪 ≈62% 温和（miss 是第二阻力载体）", () => {
    const atk = standardAttackValue(1);
    const dodge = enemyDodgeValue(1, 90);
    expect(hitChance(atk, dodge)).toBeCloseTo(0.625, 3);
  });

  it("region 分档数据：区域阶梯 §4.3 口径齐全", () => {
    for (const key of ["mist-fringe", "gloom-woods", "frost-pass", "ember-ruins", "battlefield", "lightless-abyss", "final-throne"]) {
      const r = regionDef(key);
      expect(r.monster.dodgeTiers.length).toBeGreaterThan(0);
    }
    expect(regionDef("mist-fringe").monster.dodgeTiers).toEqual(["white"]);
    expect(regionDef("final-throne").monster.dodgeTiers).toEqual(["boss", "legend"]);
  });
});

describe("#12 攻击值桶（heroHitValue）", () => {
  it("纯力（铁砧）：物理 = DEX×10 + STR×5；法术 = DEX×10", () => {
    const h = createHero("anvil");
    const hv = heroHitValue(h);
    expect(hv.phys).toBe(8 * 10 + 12 * 5); // Lv1
    expect(hv.mag).toBe(8 * 10);
  });

  it("Lv5 含天赋：STR+5 计入物理桶", () => {
    const h = { ...createHero("anvil"), level: 5, xp: 388 };
    const hv = heroHitValue(h);
    expect(hv.phys).toBeCloseTo(12 * 10 + 22.6 * 5, 5);
    expect(hv.mag).toBeCloseTo(12 * 10, 5);
  });

  it("桥位折扣 0.7：主属性×5 → ×3.5（与闪避 70/30 成对）", () => {
    const strdx = heroCoreHitRules("strdex");
    expect(strdx.phys).toEqual({ stat: "str", mult: 3.5 });
    expect(strdx.mag).toBeNull();
    const dxint = heroCoreHitRules("dexint");
    expect(dxint.phys).toBeNull();
    expect(dxint.mag).toEqual({ stat: "int", mult: 3.5 });
    const strint = heroCoreHitRules("strint");
    expect(strint.phys.stat).toBe("str");
    expect(strint.mag.stat).toBe("int");
  });
});
