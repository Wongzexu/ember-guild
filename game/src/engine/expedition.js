// 出征/战斗引擎（M2 · NUMBERS §4.1/§4.3 + 蓝图 #03 攻速调度 / #04 掉落管线）
// Arknights 式独立节奏：每个单位带 attackCountdown(ms) 相对倒计时——每步 -=dt、
// 归零开火、+=interval（while 打满 + 余量，可 burst，无粒度天花板）；
// 固定轮转序 = party.heroIds[] → monster 最后；死亡取消未出手；换怪不重置英雄时钟。
// 击杀结算 rng 次序（#04 ⑤）：gold → 掉落判定 →（品质 → 基底 → 词缀）→ spawn 新怪；
// 每次出手内 #12 契约不破：命中 roll → 伤害 roll。全程共用 meta.rngState 单流（可复现）。

import regionsData from "../data/regions.json" with { type: "json" };
import monstersData from "../data/monsters.json" with { type: "json" };
import { rngInt, rngStep } from "./prng.js";
import {
  heroStats,
  heroHitValue,
  heroAttackRange,
  heroAttackSpeed,
  armorReduction,
  ensureCombatHp,
  applyDamage,
  grantXp,
  healAfterKill,
  bringHome,
} from "./hero.js";
import { rollDrop, instanceName } from "./equipment.js";

const REGIONS = new Map(regionsData.regions.map((r) => [r.key, r]));
// 敌人数据表：regions.json 只声明敌人 ID；名称/数值/视觉 ID 全在这里（S6 素材分离原则）
const MONSTERS = new Map(Object.values(monstersData.monsters).map((m) => [m.id, m]));

export function monsterDef(id) {
  const m = MONSTERS.get(id);
  if (!m) throw new Error(`expedition: 未知敌人 ${id}`);
  return m;
}

//—— 敌闪避分档（#3 Q5 定稿 · NUMBERS §4.1 / PENDING #12 ①）
//    分档系数 ×1/×3/×8/×15；敌闪避值 = 分档系数 × 同级标准攻击值 ÷ 19
//    （÷19 = 白怪同级命中 95% 锚点的数学形式：命中 95% ⇔ 闪避值:攻击值 = 1:19）
const DODGE_MULT = { white: 1, elite: 3, boss: 8, legend: 15 };
export const HIT_FLOOR = 0.05;
export const HIT_CAP = 1;

// 同级标准攻击值 = 纯敏基准 DEX×10（§3.5 口径：基础 12 + (等级−1)×1.4；Lv1≈120/Lv50≈806/Lv90≈1366）
export function standardAttackValue(level) {
  return (12 + (level - 1) * 1.4) * 10;
}

export function enemyDodgeValue(mult, level) {
  return (mult * standardAttackValue(level)) / 19;
}

// 命中率契约（封底不封顶）：min(100%, max(5%, 攻击值/(攻击值+敌方闪避值)))
// 封顶=100% 顺滑（碾压低级图 0 落空——#3 Q5）；浮点噪声（0.999999…）视为 100%
const EPS = 1e-9;
export function hitChance(attackValue, dodgeValue) {
  if (dodgeValue <= 0) return 1;
  const raw = attackValue / (attackValue + dodgeValue);
  if (raw >= 1 - EPS) return 1;
  return Math.min(HIT_CAP, Math.max(HIT_FLOOR, raw));
}

export function regionDef(key) {
  const r = REGIONS.get(key);
  if (!r) throw new Error(`expedition: 未知区域 ${key}`);
  return r;
}

export function createParty(heroId, regionKey) {
  return {
    id: `p-${Date.now()}`,
    heroIds: [heroId],
    regionKey,
    status: "idle", // idle | expedition
    killCount: 0,
    goldEarned: 0,
    monster: null,
  };
}

export function startExpedition(party) {
  if (party.status === "expedition") return party;
  return { ...party, status: "expedition", monster: null };
}

export function stopExpedition(party) {
  return { ...party, status: "idle", monster: null };
}

// 敌人出场选择：region.enemies 声明 ID 池（rng 抽取）；fixedEnemy = 教学固定单只（不掷骰，确定性）
// region.boss = { id, every }：每逢击杀数 every-1 的下一只换成小 Boss（10 杀一轮回）
function spawnMonster(region, rngState, opts = {}) {
  const level = region.levelRange[0];

  if (region.enemies?.length) {
    let m;
    if (opts.fixed) {
      m = monsterDef(region.enemies[0]); // 教学固定单只，不消耗 rng
    } else {
      const pick = rngInt(rngState, 0, region.enemies.length - 1);
      rngState = pick.state;
      m = monsterDef(region.enemies[pick.value]);
    }

    let hp;
    if (opts.fixed) {
      hp = m.hp[1]; // 固定值（取上限），不消耗 rng
    } else {
      const roll = rngInt(rngState, m.hp[0], m.hp[1]);
      rngState = roll.state;
      hp = roll.value;
    }
    const mult = DODGE_MULT[m.tier] ?? 1;
    return {
      monster: {
        id: m.id,
        name: m.name,
        visual: m.visual,
        hp,
        maxHp: hp,
        level,
        tier: m.tier,
        dodge: enemyDodgeValue(mult, level),
        dmg: m.dmg,
        // 入场满间隔 lead-in（#03 ④⑦：每怪个体时钟；spawn tick 不反击 = M1 parity；
        // 新怪计时重新初始化，英雄时钟不重置）
        attackCountdown: region.monster?.attackInterval ?? 1000,
      },
      rngState,
    };
  }

  const [lo, hi] = region.monster.hp;
  const roll = rngInt(rngState, lo, hi);
  // 怪物等级：取区域推荐等级带下限（同级基准的锚）；分档：区域数据首档（白怪；精英/头目/传奇后续按区域支持扩展）
  const tier = region.monster.dodgeTiers?.[0] ?? "white";
  const mult = DODGE_MULT[tier] ?? 1;
  return {
    monster: {
      id: region.key,
      hp: roll.value,
      maxHp: roll.value,
      level,
      tier,
      dodge: enemyDodgeValue(mult, level),
      // 入场满间隔 lead-in（#03 ④⑦：每怪个体时钟；spawn tick 不反击 = M1 parity；
      // 新怪计时重新初始化，英雄时钟不重置）
      attackCountdown: region.monster.attackInterval ?? 1000,
    },
    rngState: roll.state,
  };
}

//—— 敌人出场选择：region.enemies 声明 ID 池（rng 抽取）；fixedEnemy = 教学固定单只（不掷骰，确定性）
// Boss 出场（#16 二批重做）：不再随击杀数自动轮换——打满 boss.every 只小怪才"发现"，
// 玩家点「挑战 Boss」才入场（spawnNextMonster 永远只刷普通怪，杜绝挂机撞 Boss 暴毙）。
function spawnNextMonster(region, rngState) {
  return spawnMonster(region, rngState, { fixed: region.fixedEnemy });
}

//—— Boss 挑战：发现后随时直达（sticky，首杀与否均可反复挑战）。
//    出征中 = 当前怪立即替换为 Boss（进度丢弃）；待命 = 直接以 Boss 开战（开拔同一区）。
//    不消耗 rng（fixed spawn 取 HP 上限）；英雄状态按点击时刻结算（不回血不重置）。
//    表现契约（ADR-002 通道外置一条）：替换目标 ≠ 击杀——UI 据此清血条显示缓存、
//    跳过旧怪死亡动画（否则挑战会被误演成普通怪死亡 + Boss 血条沿用旧怪残血）。
export function challengeBoss(state, regionKey) {
  const region = regionDef(regionKey);
  if (!region.boss) throw new Error(`challengeBoss: 区域 ${regionKey} 无小 Boss`);
  if (!state.bossSpotted?.[regionKey]) {
    throw new Error(`challengeBoss: ${region.name} 尚未发现 Boss`);
  }
  const party = state.parties[0]; // M2 单队
  if (!party) throw new Error("challengeBoss: 无队伍");
  if (party.status === "expedition" && party.regionKey !== regionKey) {
    throw new Error(`challengeBoss: 队伍正在其他区域远征（${party.regionKey}）`);
  }
  const boss = spawnMonster(
    { ...region, enemies: [region.boss.id] },
    state.meta.rngState,
    { fixed: true },
  ).monster;
  const next =
    party.status === "expedition"
      ? { ...party, monster: boss }
      : { ...startExpedition({ ...party, regionKey }), monster: boss };
  const seq = (state.meta.combatEventSeq ?? 0) + 1;
  return {
    ...state,
    meta: { ...state.meta, combatEventSeq: seq },
    combatEvents: [
      ...(state.combatEvents ?? []),
      {
        id: seq,
        partyId: party.id,
        type: "boss-challenge",
        t: state.meta.totalPlayMs ?? 0,
        regionKey,
        monster: {
          id: boss.id,
          name: boss.name ?? null,
          visual: boss.visual ?? null,
          hp: boss.hp,
          maxHp: boss.maxHp,
        },
      },
    ],
    parties: state.parties.map((x) => (x.id === party.id ? next : x)),
  };
}

//—— 处理全部在途队伍的纯函数 reducer：返回 { heroes, parties, org, inventory, nextItemId, rngState, events }
//    M2 单英雄对单怪；循环结构已按 party.heroIds[] 留多英雄口子（M5+ 铺开）
//    事件契约（ADR-002）：每条 combatEvent 附 t = 出手/结算瞬间的模拟时间（ms，基于 meta.totalPlayMs
//    的单调钟，burst 内多击可分辨）；spawn/heal 事件承载表现层换模与回血重放；element 为攻击方元素。
const COMBAT_EVENT_CAP = 200; // 单步事件上限（events 是表现数据可截断；rng/数值不受影响）

export function stepExpeditions(state, dt) {
  const events = [];
  const combatEvents = [];
  let combatEventSeq = state.meta.combatEventSeq ?? 0;
  const stepStart = state.meta.totalPlayMs ?? 0;
  let heroes = state.heroes;
  let org = state.org;
  let rngState = state.meta.rngState;
  let inventory = state.inventory;
  let nextItemId = state.meta.nextItemId ?? 1;
  // Boss 发现状态（#16 二批）：regionKills = 各区累计小怪击杀（发现门槛）；bossSpotted = 已发现集合（sticky，
  // 发现一次永久可挑战，失败不收回——首杀门槛 bossKills 与发现相互独立）
  let regionKills = state.regionKills ?? {};
  let bossSpotted = state.bossSpotted ?? {};

  // 击杀入账（区累计）+ 首次跨过发现门槛 → 战记 fact + 解锁「挑战 Boss」
  function registerKills(region, delta) {
    if (delta <= 0) return;
    const total = (regionKills[region.key] ?? 0) + delta;
    regionKills = { ...regionKills, [region.key]: total };
    if (region.boss && !bossSpotted[region.key] && total >= region.boss.every) {
      bossSpotted = { ...bossSpotted, [region.key]: true };
      events.push({
        type: "fact",
        text: `在 ${region.name} 的雾色深处，${monsterDef(region.boss.id).name} 的踪迹显现了——可随时发起 Boss 战。`,
      });
    }
  }

  function emitCombatEvent(event) {
    if (combatEvents.length >= COMBAT_EVENT_CAP) return;
    combatEventSeq += 1;
    combatEvents.push({ id: combatEventSeq, ...event });
  }

  const parties = state.parties.map((party) => {
    if (party.status !== "expedition") return party;
    let p = party;
    let h = heroes.find((hh) => hh.id === p.heroIds[0]);
    if (!h) {
      events.push({ type: "fact", text: `编队 ${p.id} 失去队员，撤回组织。` });
      p = stopExpedition(p);
      return p;
    }
    h = ensureCombatHp(h);
    const region = regionDef(p.regionKey);

    // 生成怪物（教学区固定单只；普通区按敌人池抽取，boss.every 轮换小 Boss）
    if (!p.monster) {
      const s = spawnNextMonster(region, rngState, p.killCount);
      rngState = s.rngState;
      p = { ...p, monster: s.monster };
    }
    let monster = p.monster;
    let kills = 0;
    let goldDelta = 0;
    let spawnedAt = null; // 本步内 burst 击杀换怪的时刻（步内偏移 ms）；null = 无换怪

    // 1) 英雄出手：到点即出手（可 burst 打满+余量；#03 ⑥）
    let heroClock = (h.attackCountdown ?? 0) - dt;
    const heroInterval = 1000 / heroAttackSpeed(h);
    while (heroClock <= 0 && monster.hp > 0) {
      // 开火时刻（ADR-002）：heroClock 为步末剩余口径 → 步内开火偏移 = heroClock + dt
      const fireAt = stepStart + heroClock + dt;
      // 命中判定（#12 契约：命中 roll → 伤害 roll；M2 无暴击词缀，命中后即掷骰）
      const hv = heroHitValue(h);
      const hit = hitChance(hv.phys, monster.dodge);
      const hitRoll = rngStep(rngState);
      rngState = hitRoll.state;
      if (hitRoll.value < hit) {
        const [dmin, dmax] = heroAttackRange(h);
        const roll = rngInt(rngState, dmin, dmax);
        rngState = roll.state;
        monster = { ...monster, hp: monster.hp - roll.value };
        emitCombatEvent({
          partyId: p.id,
          actorId: h.id,
          targetIds: [monster.id],
          type: "attack",
          result: "hit",
          t: fireAt,
          element: "none", // 武器元素 M3 词缀接线；当前全物理 = none
          damage: roll.value,
          targetHpAfter: Math.max(0, monster.hp),
          killed: monster.hp <= 0,
          // 战记流水行（具体事件层，core.tick 落 battleLog）
          log:
            monster.hp <= 0
              ? `${h.name} 击败了 ${monster.name}（造成 ${roll.value} 伤害）`
              : `${h.name} 攻击 ${monster.name}，造成 ${roll.value} 伤害`,
        });
      } else {
        emitCombatEvent({
          partyId: p.id,
          actorId: h.id,
          targetIds: [monster.id],
          type: "attack",
          result: "miss",
          t: fireAt,
          element: "none",
          damage: 0,
          killed: false,
          log: `${h.name} 的攻击被 ${monster.name} 避开了`,
        });
      }
      heroClock += heroInterval;

      // 2) 击杀结算（#04 ⑤ 次序：gold → 掉落判定/品质/基底/词缀 → spawn 新怪）
      if (monster.hp <= 0) {
        const gold = rngInt(rngState, region.gold[0], region.gold[1]);
        rngState = gold.state;
        org = { ...org, gold: org.gold + gold.value };
        goldDelta += gold.value;
        kills += 1;
        h = grantXp(healAfterKill(h), region.xp);
        emitCombatEvent({
          partyId: p.id,
          actorId: h.id,
          type: "heal",
          t: fireAt,
          hp: h.hp, // 回血后 HP 事实（表现层直接对齐，不做算术重放）
        });

        // 小 Boss 首杀（#16）：里程碑事件（史诗层编年史 + bossKills 登记解锁链）。
        // 幂等——bossKills 已登记的区域不再重复上报；后续轮回 Boss 击杀只走普通战记流水。
        if (region.boss && monster.id === region.boss.id && !state.bossKills?.[region.key]) {
          events.push({
            type: "boss-cleared",
            regionKey: region.key,
            text: `${monster.name} 在 ${region.name} 倒下了——雾后更深处的路，露了出来。`,
          });
        }

        // 教学区（0-1）：首杀即毕业——不发掉落、不刷下一只，停在原地交还控制权
        if (region.tutorial) {
          emitCombatEvent({
            partyId: p.id,
            actorId: monster.id,
            targetIds: [],
            type: "death",
            t: fireAt,
          });
          events.push({
            type: "tutorial-complete",
            regionKey: region.key,
            text: `猎犬倒在锤下，余烬未熄。迷雾深处传来低吼——「${regionDef("mist-fringe").name}」的门扉已被推开。`,
          });
          heroes = heroes.map((hh) => (hh.id === h.id ? h : hh));
          registerKills(region, kills);
          return {
            ...stopExpedition({ ...p, monster: null }),
            killCount: p.killCount + kills,
            goldEarned: p.goldEarned + goldDelta,
          };
        }

        const drop = rollDrop(rngState, region, nextItemId);
        if (drop) {
          rngState = drop.rngState;
          nextItemId = drop.nextItemId;
          if (drop.instance) {
            inventory = { ...inventory, items: [...inventory.items, drop.instance] };
            events.push({
              type: "fact",
              text: `${h.name} 在 ${region.name} 发现了 ${instanceName(drop.instance)}。`,
            });
          }
        }

        const s = spawnNextMonster(region, rngState);
        rngState = s.rngState;
        monster = s.monster;
        // 换怪时刻 = 致命一击的开火偏移（新怪 lead-in 从此起算，ADR-002 lead-in 修复）
        spawnedAt = heroClock + dt - heroInterval;
        emitCombatEvent({
          partyId: p.id,
          type: "spawn",
          t: fireAt,
          monster: {
            id: monster.id,
            name: monster.name ?? null,
            visual: monster.visual ?? null,
            hp: monster.hp,
            maxHp: monster.maxHp,
          },
        });
      }
    }
    h = { ...h, attackCountdown: heroClock };

    // 3) 怪物出手：独立时钟，死亡取消未出手；两段分层减伤（§4.1/SYSTEMS §6）：
    //    实收 = atk × (1 − 护甲减伤) × (1 − 属性端物抗)
    //    lead-in（ADR-002 修复）：换怪当步按出场偏移折算流逝时间——
    //    攻击开火偏移序列 = 首火偏移, +interval…；步末存量 = 下一火偏移 − dt
    if (monster.hp > 0) {
      const monsterInterval = region.monster?.attackInterval ?? 1000;
      const monsterElement = MONSTERS.get(monster.id)?.element ?? "none";
      const stats = heroStats(h);
      const armorPct = armorReduction(h);
      let nextFire = spawnedAt == null ? monster.attackCountdown : spawnedAt + monster.attackCountdown;
      let heroDied = false;
      while (nextFire <= dt && !heroDied) {
        const [dlo, dhi] = monster.dmg ?? region.monster.dmg;
        const atk = rngInt(rngState, dlo, dhi);
        rngState = atk.state;
        const taken = Math.floor(
          atk.value * (1 - armorPct / 100) * (1 - stats.physRes / 100)
        );
        h = applyDamage(h, taken);
        heroDied = h.hp <= 0;
        emitCombatEvent({
          partyId: p.id,
          actorId: monster.id,
          targetIds: [h.id],
          type: "attack",
          result: "hit",
          t: stepStart + nextFire,
          element: monsterElement,
          damage: taken,
          targetHpAfter: h.hp,
          killed: heroDied,
          log: `${monster.name ?? "迷雾中的敌人"} 攻击 ${h.name}，造成 ${taken} 伤害`,
        });
        if (heroDied) {
          emitCombatEvent({
            partyId: p.id,
            actorId: h.id,
            targetIds: [],
            type: "death",
            t: stepStart + nextFire,
          });
        }
        nextFire += monsterInterval;
      }
      monster = { ...monster, attackCountdown: nextFire - dt };

      // 4) 战败撤回
      if (h.hp <= 0) {
        const home = bringHome(h);
        events.push({
          type: "fact",
          text: `${h.name} 在 ${region.name} 负伤撤回余烬公会。铜锤上又添一道痕。`,
        });
        heroes = heroes.map((hh) => (hh.id === h.id ? home : hh));
        registerKills(region, kills);
        return {
          ...stopExpedition(p),
          killCount: p.killCount + kills,
          goldEarned: p.goldEarned + goldDelta,
        };
      }
    }

    registerKills(region, kills);
    p = {
      ...p,
      monster,
      killCount: p.killCount + kills,
      goldEarned: p.goldEarned + goldDelta,
    };
    heroes = heroes.map((hh) => (hh.id === h.id ? h : hh));
    return p;
  });

  return {
    heroes,
    parties,
    org,
    inventory,
    nextItemId,
    rngState,
    events,
    combatEvents,
    combatEventSeq,
    regionKills,
    bossSpotted,
  };
}
