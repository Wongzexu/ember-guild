import { describe, it, expect } from "vitest";
import monstersData from "../data/monsters.json" with { type: "json" };
import {
  createParty,
  startExpedition,
  stopExpedition,
  stepExpeditions,
  regionDef,
  monsterDef,
  standardAttackValue,
  enemyDodgeValue,
  hitChance,
  challengeBoss,
} from "./expedition.js";
import { tick, createInitialState } from "./core.js";
import { heroStats, heroHitValue, heroCoreHitRules, createHero, heroArmor } from "./hero.js";
import { equipItem, baseOf, emptyEquipment } from "./equipment.js";

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
    expect(s.battleLog.length).toBeGreaterThan(0);
    expect(s.battleLog[s.battleLog.length - 1].text).toContain("负伤撤回");
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
    // 敌人池区（S6）：分档随敌人定义走
    for (const id of regionDef("mist-fringe").enemies) {
      expect(monstersData.monsters[id].tier).toBe("white");
    }
    expect(monstersData.monsters[regionDef("mist-fringe").boss.id].tier).toBe("elite");
    // 1-2 敌人池区（#16 首批）：白怪×3 + 精英小 Boss
    for (const id of regionDef("gloom-woods").enemies) {
      expect(monstersData.monsters[id].tier).toBe("white");
    }
    expect(monstersData.monsters[regionDef("gloom-woods").boss.id].tier).toBe("elite");
    // 传统区域（1-3+ 未设定）：保留 monster 分档块
    for (const key of ["frost-pass", "ember-ruins", "battlefield", "lightless-abyss", "final-throne"]) {
      const r = regionDef(key);
      expect(r.monster.dodgeTiers.length).toBeGreaterThan(0);
    }
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

function freshRun() {
  let s = createInitialState();
  s = { ...s, parties: [startExpedition(createParty("eigrem", "mist-fringe"))] };
  return s;
}

describe("#03 攻速调度（Arknights 式独立节奏）", () => {
  it("战斗事件包含出手者、目标与结果，未命中也不丢动作", () => {
    let s = freshRun();
    s = tick(s, 500);
    const heroEvent = s.combatEvents.find((event) => event.actorId === "eigrem");
    expect(heroEvent).toMatchObject({
      type: "attack",
    });
    expect(heroEvent.targetIds).toEqual([s.parties[0].monster.id]);
    expect(["hit", "miss"]).toContain(heroEvent.result);

    s = tick(s, 500);
    expect(s.combatEvents.some((event) => event.actorId !== "eigrem" && event.targetIds.includes("eigrem"))).toBe(true);
  });

  it("首击即发：英雄时钟吃满余量；怪入场满间隔（spawn tick 不反击）", () => {
    let s = freshRun();
    s = tick(s, 500);
    // Lv1 攻速 = 1.0×(1+DEX8/100) = 1.08（引擎唯一账本；蓝图 #03 示例 1.12 系 DEX12 误记）
    // interval ≈ 925.93；首击后余量 = -500 + interval
    expect(s.heroes[0].attackCountdown).toBeCloseTo(-500 + 1000 / 1.08, 3);
    // 怪 attackCountdown 1000 → 本 tick 末 500（未出手）
    expect(s.parties[0].monster.attackCountdown).toBe(500);
    expect(s.heroes[0].hp).toBe(heroStats(s.heroes[0]).maxHp); // 怪未攻击
  });

  it("怪按 attackInterval 独立出手：第二 tick 落地首击", () => {
    let s = freshRun();
    s = tick(s, 500);
    s = tick(s, 500);
    expect(s.heroes[0].hp).toBeLessThan(heroStats(s.heroes[0]).maxHp);
  });

  it("burst：大 dt 一次打满多击（无粒度天花板，余量保留）", () => {
    let s = freshRun();
    s = tick(s, 3000);
    // 3000ms / 925.93ms → 4 次出手，余量 = -3000 + 4×interval ≈ 703.7
    expect(s.heroes[0].attackCountdown).toBeCloseTo(-3000 + 4 * (1000 / 1.08), 1);
  });

  it("确定性：攻速调度后同种子结果仍可复现（rng 消耗 = dt/攻速的确定函数）", () => {
    const a = (() => {
      let s = freshRun();
      for (let i = 0; i < 120; i++) s = tick(s, 500);
      return s;
    })();
    const b = (() => {
      let s = freshRun();
      for (let i = 0; i < 120; i++) s = tick(s, 500);
      return s;
    })();
    expect(a.parties[0].killCount).toBe(b.parties[0].killCount);
    expect(a.heroes[0].attackCountdown).toBe(b.heroes[0].attackCountdown);
    expect(a.parties[0].monster.attackCountdown).toBe(b.parties[0].monster.attackCountdown);
  });
});

describe("#20 ADR-002 事件契约（t 时间戳 / spawn / heal / element / lead-in 修复）", () => {
  it("combatEvent 携带 t 模拟时间戳：首击 t=0、英雄二击 ≈interval、怪首击 = 1000", () => {
    let s = freshRun();
    s = tick(s, 500);
    const heroFirst = s.combatEvents.find((e) => e.actorId === "eigrem");
    expect(heroFirst.t).toBe(0);
    s = tick(s, 500);
    const heroSecond = s.combatEvents.find((e) => e.actorId === "eigrem");
    expect(heroSecond.t).toBeCloseTo(1000 / 1.08, 3); // 500(步起点) + 425.93(余量)
    const monsterHit = s.combatEvents.find((e) => e.actorId !== "eigrem" && e.type === "attack");
    expect(monsterHit.t).toBe(1000); // 存量 500 + 步起点 500
  });

  it("事件 t 单调不减（含 burst 回补多击）", () => {
    let s = freshRun();
    const all = [];
    for (let i = 0; i < 40; i++) {
      s = tick(s, i === 20 ? 5000 : 500); // 中途一次大 dt 制造 burst
      all.push(...s.combatEvents.filter((e) => e.t !== undefined).map((e) => e.t));
    }
    expect(all.length).toBeGreaterThan(10);
    // 引擎按"英雄段 → 怪物段"发射（同 tick 内跨单位发射序 ≠ t 序）；契约 = 消费方按 t 排序
    all.sort((a, b) => a - b);
    for (let i = 1; i < all.length; i++) expect(all[i]).toBeGreaterThanOrEqual(all[i - 1]);
  });

  it("击杀产生 heal 与 spawn 事件：spawn 携带新怪信息且 t = 击杀攻击 t", () => {
    let s = freshRun();
    for (let i = 0; i < 100 && !(s.combatEvents ?? []).some((e) => e.type === "spawn"); i++) {
      s = tick(s, 500);
    }
    const events = s.combatEvents;
    const kill = events.find((e) => e.type === "attack" && e.killed);
    expect(kill).toBeTruthy();
    const heal = events.find((e) => e.type === "heal" && e.t === kill.t);
    const spawn = events.find((e) => e.type === "spawn" && e.t === kill.t);
    expect(heal).toBeTruthy();
    expect(heal.hp).toBeGreaterThan(0);
    expect(spawn).toBeTruthy();
    expect(spawn.monster.id).toBeTruthy();
    expect(spawn.monster.hp).toBe(spawn.monster.maxHp); // 新怪满血入场
    expect(["blaze-hound", "blue-sting-scorpion", "golden-mantella"]).toContain(spawn.monster.id);
  });

  it("攻击事件携带攻击方 element（首区全 none）", () => {
    let s = freshRun();
    s = tick(s, 1000);
    for (const e of s.combatEvents.filter((e) => e.type === "attack")) {
      expect(e.element).toBe("none");
    }
  });

  it("命中事件带 targetHpAfter：英雄与怪双向均可重放血量", () => {
    let s = freshRun();
    s = tick(s, 500);
    const heroHit = s.combatEvents.find((e) => e.actorId === "eigrem" && e.result === "hit");
    if (heroHit) expect(heroHit.targetHpAfter).toBeLessThan(s.parties[0].monster.maxHp);
    s = tick(s, 500);
    const monsterHit = s.combatEvents.find((e) => e.actorId !== "eigrem" && e.type === "attack" && e.result === "hit");
    expect(monsterHit).toBeTruthy();
    expect(monsterHit.targetHpAfter).toBe(s.heroes[0].hp);
    expect(monsterHit.targetHpAfter).toBeLessThan(heroStats(s.heroes[0]).maxHp);
  });

  it("lead-in 修复：burst 击杀换怪后，新怪 lead-in 从出场偏移起算（不再双扣 dt）", () => {
    // 构造：英雄时钟余量 900 → tick1 后存 400；tick2 在步内偏移 400 出手秒杀（怪 hp=1）
    let s = freshRun();
    const party = {
      ...startExpedition(createParty("eigrem", "mist-fringe")),
      monster: {
        id: "blaze-hound",
        name: "余烬猎犬",
        visual: "blaze-hound",
        hp: 1,
        maxHp: 1,
        level: 1,
        tier: "white",
        dodge: 0, // 必中（dodgeValue ≤ 0 → hitChance = 1）
        dmg: [1, 2],
        attackCountdown: 10000,
      },
    };
    s = { ...s, heroes: [{ ...s.heroes[0], attackCountdown: 900 }], parties: [party] };
    s = tick(s, 500); // 英雄不出手（余量 100）
    expect(s.combatEvents.some((e) => e.type === "attack")).toBe(false);
    s = tick(s, 500); // 偏移 400 开火击杀 → 换怪（spawnedAt=400）
    // 新怪攻击时刻 = 900(绝对) + 1000 = 1900；步末存量 = 1900 − 1000 = 900
    // 旧实现双扣 dt 会得 500（lead-in 被吃掉 400ms）
    expect(s.parties[0].monster.attackCountdown).toBe(900);
    expect(s.parties[0].monster.hp).toBe(s.parties[0].monster.maxHp); // 新怪满血
  });

  it("单步事件上限：COMBAT_EVENT_CAP 截断不影响数值结算", () => {
    let a = freshRun();
    let b = freshRun();
    a = tick(a, 60000);
    // b 与 a 同 dt：rng/结果必须一致（截断只影响 events 数组）
    b = tick(b, 60000);
    expect(a.parties[0].killCount).toBe(b.parties[0].killCount);
    expect(a.org.gold).toBe(b.org.gold);
    expect(a.combatEvents.length).toBeLessThanOrEqual(200);
  });
});

describe("#04 掉落管线（击杀 roll → 背包 → 可穿戴）", () => {
  it("挂机产生掉落：实例入背包、id 自增去重、meta.nextItemId 收口", () => {
    const s = makeRun(999);
    expect(s.inventory.items.length).toBeGreaterThan(0);
    const ids = s.inventory.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Math.min(...ids)).toBeGreaterThanOrEqual(2); // 起始铜锤占 id 1
    expect(s.meta.nextItemId).toBe(Math.max(...ids) + 1);
    const POOL = [
      "copper-hammer",
      "iron-hammer",
      "great-hammer",
      "wood-shield",
      "oak-shield",
    ];
    for (const item of s.inventory.items) {
      expect(POOL).toContain(item.baseId);
      expect(item.rarity).toBe("white"); // 1-1 纯白装（#16：blueChance 0）
      expect(item.affixes).toEqual([]);
    }
  });

  it("掉落写战记（#04 ⑥：生成实例 + 入背包 + 提示 → 具体事件层）", () => {
    const s = makeRun(999);
    expect(s.inventory.items.length).toBeGreaterThan(0);
    expect(s.battleLog.some((c) => c.text.includes("发现了"))).toBe(true);
  });

  it("掉落可穿上：B 层叠迁移，护甲/主手随实例联动", () => {
    const s = makeRun(999);
    // 首件可穿（需等级 ≤ 英雄等级）
    const item = s.inventory.items.find((i) => baseOf(i.baseId).reqLevel <= s.heroes[0].level);
    expect(item).toBeTruthy();
    const stopped = { ...s, parties: [stopExpedition(s.parties[0])] };
    const s2 = equipItem(stopped, "eigrem", item.id);
    const slot = baseOf(item.baseId).slot;
    expect(s2.heroes[0].equipment[slot].id).toBe(item.id);
    expect(s2.inventory.items.some((i) => i.id === item.id)).toBe(false);
    if (slot === "offhand") {
      expect(heroArmor(s2.heroes[0])).toBeGreaterThan(0);
    } else {
      expect(s2.heroes[0].equipment.mainhand.baseId).toBe(item.baseId);
    }
  });
});

describe("0-1 教学区（新手引导首战）", () => {
  function makeTutorialRun(maxTicks = 400) {
    let s = createInitialState();
    s = { ...s, parties: [startExpedition(createParty("eigrem", "tutorial-0-1"))] };
    let seen = [];
    for (let i = 0; i < maxTicks; i++) {
      s = tick(s, 500);
      if (s.parties[0].monster) seen.push(s.parties[0].monster);
      if (s.parties[0].status !== "expedition") break;
    }
    return { s, seen };
  }

  it("只出一只固定余烬猎犬（hp 固定、不掷骰），不出现蓝刺蝎或 Boss", () => {
    const { s, seen } = makeTutorialRun();
    expect(seen.length).toBeGreaterThanOrEqual(1);
    expect(new Set(seen.map((m) => m.id)).size).toBe(1); // 全程只出现一种敌人
    const m = seen[0];
    expect(m.id).toBe("blaze-hound");
    expect(m.name).toBe("余烬猎犬");
    expect(m.visual).toBe("blaze-hound");
    expect(m.hp).toBe(18); // monsters.json blaze-hound.hp 上限，固定值
    expect(s.parties[0].status).toBe("idle"); // 首杀后停止
    expect(s.parties[0].killCount).toBe(1);
  });

  it("教学首杀：极低经验/金币、不掉装备、不刷下一只", () => {
    const { s } = makeTutorialRun();
    expect(s.heroes[0].level).toBe(1);
    expect(s.heroes[0].xp).toBe(2); // regions.json tutorial xp
    expect(s.org.gold).toBe(1);
    expect(s.inventory.items.length).toBe(0);
    expect(s.battleLog.some((c) => c.text.includes("击败了 余烬猎犬"))).toBe(true);
  });

  it("教学里程碑走编年史史诗层：叙事文案不带数值，unlock 同步登记", () => {
    const { s } = makeTutorialRun();
    expect(
      s.chronicle.some((c) => c.text.includes("迷雾深处传来低吼") && c.text.includes("迷雾边缘")),
    ).toBe(true);
    expect(s.chronicle.some((c) => /[0-9]/.test(c.text))).toBe(false); // 史诗层不出现数字
  });

  it("首杀完成 → 解锁 1-1 迷雾边缘（unlocks 登记）", () => {
    const { s } = makeTutorialRun();
    expect(s.unlocks["tutorial-0-1"]).toBe(true);
  });

  it("visual id 随怪物流转（表现层按 visuals.js 收录与否自行降级占位）", () => {
    // 引擎侧只带 visual id 字符串，不关心素材收录；照常掉血结算
    expect(monsterDef("blue-sting-scorpion").visual).toBe("blue-sting-scorpion");
    let s = createInitialState();
    s = {
      ...s,
      parties: [{ ...startExpedition(createParty("eigrem", "mist-fringe")), monster: null }],
    };
    s = tick(s, 500);
    const m = s.parties[0].monster;
    expect(m).toBeTruthy();
    expect(["blaze-hound", "blue-sting-scorpion"]).toContain(m.id);
    expect(m.maxHp).toBeGreaterThan(0);
  });

  it("10 杀发现 Boss：regionKills 累计 + bossSpotted 登记 + 战记 fact；challengeBoss 未发现抛错", () => {
    let s = createInitialState();
    s = { ...s, parties: [startExpedition(createParty("eigrem", "mist-fringe"))] };
    let guard = 0;
    while (guard++ < 800 && !s.bossSpotted["mist-fringe"]) s = tick(s, 500);
    expect(s.bossSpotted["mist-fringe"]).toBe(true);
    expect(s.regionKills["mist-fringe"]).toBeGreaterThanOrEqual(10);
    expect(s.battleLog.some((c) => c.text.includes("金曼特拉 的踪迹"))).toBe(true);
    // sticky：发现即永久，发现前不可挑战
    expect(() => challengeBoss({ ...s, bossSpotted: {} }, "mist-fringe")).toThrow(/尚未发现/);
  });

  it("challengeBoss：待命直达 = 以 Boss 开战；出征中 = 替换当前怪", () => {
    let s = createInitialState();
    s = {
      ...s,
      bossSpotted: { "mist-fringe": true },
      regionKills: { "mist-fringe": 10 },
      parties: [createParty("eigrem", "mist-fringe")], // 待命队
    };
    // 待命直达：idle → 直接以金曼特拉开战（满血上限、精英档）
    s = challengeBoss(s, "mist-fringe");
    expect(s.parties[0].status).toBe("expedition");
    expect(s.parties[0].regionKey).toBe("mist-fringe");
    expect(s.parties[0].monster.id).toBe("golden-mantella");
    expect(s.parties[0].monster.hp).toBe(60); // fixed = HP 上限
    expect(s.parties[0].monster.tier).toBe("elite");
    // 出征中替换：换普通怪后点挑战 → 立即换成 Boss
    let s2 = createInitialState();
    s2 = { ...s2, bossSpotted: { "gloom-woods": true }, regionKills: { "gloom-woods": 10 } };
    s2 = { ...s2, parties: [startExpedition(createParty("eigrem", "gloom-woods"))] };
    s2 = tick(s2, 500); // 刷出普通怪
    expect(s2.parties[0].monster.id).not.toBe("wild-tahr");
    s2 = challengeBoss(s2, "gloom-woods");
    expect(s2.parties[0].monster.id).toBe("wild-tahr");
    // 其他区域远征中不可跨区挑战
    s2 = { ...s2, bossSpotted: { ...s2.bossSpotted, "mist-fringe": true } };
    expect(() => challengeBoss(s2, "mist-fringe")).toThrow(/其他区域/);
  });

  it("challengeBoss 发 boss-challenge 表现事件：满血快照 + seq 递增；出征中/待命两路径都有", () => {
    // 出征中替换路径：普通怪 → Boss，事件带 Boss 满血快照（UI 清血条缓存的依据）
    let s = createInitialState();
    s = { ...s, bossSpotted: { "mist-fringe": true }, regionKills: { "mist-fringe": 10 } };
    s = { ...s, parties: [startExpedition(createParty("eigrem", "mist-fringe"))] };
    s = tick(s, 500); // 刷普通怪
    const beforeSeq = s.meta.combatEventSeq;
    expect(s.combatEvents.some((e) => e.type === "boss-challenge")).toBe(false);
    s = challengeBoss(s, "mist-fringe");
    const ev = s.combatEvents.find((e) => e.type === "boss-challenge");
    expect(ev).toBeTruthy();
    expect(ev.monster.id).toBe("golden-mantella");
    expect(ev.monster.hp).toBe(ev.monster.maxHp); // fixed spawn = HP 上限
    expect(ev.monster.maxHp).toBe(60);
    expect(ev.regionKey).toBe("mist-fringe");
    expect(ev.t).toBe(s.meta.totalPlayMs); // 模拟时钟戳（ADR-002 事件契约）
    expect(s.meta.combatEventSeq).toBe(beforeSeq + 1); // 不与后续 tick 事件撞 id
    expect(s.parties[0].monster.id).toBe("golden-mantella");
    // 待命直达路径：同样发事件（UI 起点渲染即 Boss，不播任何死亡动画）；seq 接力不撞车
    let s2 = createInitialState();
    s2 = { ...s2, bossSpotted: { "mist-fringe": true }, parties: [createParty("eigrem", "mist-fringe")] };
    s2 = challengeBoss(s2, "mist-fringe");
    const challengeId = s2.combatEvents.find((e) => e.type === "boss-challenge").id;
    expect(challengeId).toBe(1); // 新档 seq 从 0 起算
    s2 = tick(s2, 500); // Boss 站场继续战斗 → 后续事件 id 只增不回退
    for (const e of s2.combatEvents) expect(e.id).toBeGreaterThan(challengeId);
    expect(s2.meta.combatEventSeq).toBeGreaterThan(challengeId);
  });

  it("Boss 出场重构：不再自动轮换——killCount 跨过 10 杀后刷的仍是普通怪", () => {
    let s = createInitialState();
    s = { ...s, parties: [startExpedition(createParty("eigrem", "mist-fringe"))] };
    s = tick(s, 500);
    const first = s.parties[0].monster.id;
    // 挂到 killCount > 10：出场池永远不含 Boss（Boss 只走 challengeBoss）
    let guard = 0;
    while (guard++ < 800 && s.parties[0].killCount <= 10) s = tick(s, 500);
    expect(s.parties[0].killCount).toBeGreaterThan(10);
    expect(["blaze-hound", "blue-sting-scorpion"]).toContain(first);
  });

  it("1-2 Boss 首杀 → boss-cleared 登记（bossKills + 编年史诗层）；已登记区域不重复上报；胜利后可再战", () => {
    const lv8Gear = () => ({
      ...createHero("anvil"),
      level: 8,
      xp: 848,
      equipment: { ...emptyEquipment(), mainhand: { id: 99, baseId: "iron-hammer", rarity: "white", affixes: [] } },
    });
    const farmToSpot = (state, regionKey) => {
      let s = state;
      let guard = 0;
      while (guard++ < 800 && !s.bossSpotted[regionKey]) s = tick(s, 500);
      return s;
    };
    const bossFight = (state, regionKey) => {
      let s = challengeBoss(state, regionKey);
      let guard = 0;
      // 死亡撤回时 monster 置 null → 循环自然退出
      while (guard++ < 800 && s.parties[0].monster?.id === regionDef(regionKey).boss.id) {
        s = tick(s, 500);
      }
      return s;
    };
    // Lv8 铁锤铁砧：10 杀发现 → 挑战 → 击杀塔尔羊（100 HP / DPS≈10 ≈ 10s）
    let s = createInitialState();
    s = {
      ...s,
      heroes: [lv8Gear()],
      parties: [startExpedition(createParty("eigrem", "gloom-woods"))],
    };
    s = farmToSpot(s, "gloom-woods");
    expect(s.bossSpotted["gloom-woods"]).toBe(true);
    s = bossFight(s, "gloom-woods");
    expect(s.bossKills["gloom-woods"]).toBe(true);
    const bossLines = s.chronicle.filter((c) => c.text.includes("倒下了"));
    expect(bossLines.length).toBe(1);
    expect(bossLines[0].text).toContain("狂野塔尔");
    expect(bossLines[0].text).toContain("幽暗林地");
    // 胜利后回到普通怪继续挂机
    expect(s.parties[0].status).toBe("expedition");
    expect(s.parties[0].monster.id).not.toBe("wild-tahr");
    // sticky：发现状态保留，可立即再战；二杀不再上报里程碑
    const before = s.chronicle.length;
    s = bossFight(s, "gloom-woods");
    expect(s.bossSpotted["gloom-woods"]).toBe(true);
    expect(s.chronicle.filter((c) => c.text.includes("倒下了")).length).toBe(1);
    expect(s.chronicle.length).toBe(before);
    // 英雄死于 Boss 战也不收回发现状态（撤回后随时再战）
    let s2 = createInitialState();
    s2 = {
      ...s2,
      bossSpotted: { "gloom-woods": true },
      heroes: [{ ...createHero("anvil"), level: 1, hp: 1, equipment: { ...emptyEquipment() } }],
      parties: [startExpedition(createParty("eigrem", "gloom-woods"))],
    };
    s2 = bossFight(s2, "gloom-woods");
    expect(s2.parties[0].status).toBe("idle"); // 撤回
    expect(s2.bossSpotted["gloom-woods"]).toBe(true);
  });
});
