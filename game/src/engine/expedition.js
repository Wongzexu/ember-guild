// 出征/战斗引擎（M1 窄实现 · NUMBERS §4.1/§4.3）
// 每 tick(500ms) = 1 回合：英雄先手 → 怪存活则反击 → 击杀结算（金币/经验/回血）→ 战败撤回。
// M1 断言：只跑物理极（首区怪纯物理近战）；命中率=1（敌方闪避 0，§4.1 截断后续补）；
// 装备掉落 M2（§4.3 "白装/线索"产出仅记录 gold/xp）。

import regionsData from "../data/regions.json" with { type: "json" };
import { rngInt, rngStep } from "./prng.js";
import {
  heroStats,
  heroHitValue,
  heroAttackRange,
  ensureCombatHp,
  applyDamage,
  grantXp,
  healAfterKill,
  bringHome,
} from "./hero.js";

const REGIONS = new Map(regionsData.regions.map((r) => [r.key, r]));

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

function spawnMonster(region, rngState) {
  const [lo, hi] = region.monster.hp;
  const roll = rngInt(rngState, lo, hi);
  // 怪物等级：取区域推荐等级带下限（同级基准的锚）；分档：区域数据首档（白怪；精英/头目/传奇后续按区域支持扩展）
  const level = region.levelRange[0];
  const tier = region.monster.dodgeTiers?.[0] ?? "white";
  const mult = DODGE_MULT[tier] ?? 1;
  return {
    hp: roll.value,
    maxHp: roll.value,
    level,
    tier,
    dodge: enemyDodgeValue(mult, level),
    rngState: roll.state,
  };
}

//—— 处理全部在途队伍的纯函数 reducer：返回 { heroes, parties, org, rngState, events }
export function stepExpeditions(state) {
  const events = [];
  let heroes = state.heroes;
  let org = state.org;
  let rngState = state.meta.rngState;

  const parties = state.parties.map((party) => {
    if (party.status !== "expedition") return party;
    let p = party;
    let h = heroes.find((hh) => hh.id === p.heroIds[0]);
    if (!h) {
      events.push({ text: `编队 ${p.id} 失去队员，撤回组织。` });
      p = stopExpedition(p);
      return p;
    }
    h = ensureCombatHp(h);
    const region = regionDef(p.regionKey);

    // 生成怪物
    if (!p.monster) {
      const s = spawnMonster(region, rngState);
      rngState = s.rngState;
      p = { ...p, monster: { hp: s.hp, maxHp: s.maxHp, level: s.level, tier: s.tier, dodge: s.dodge } };
    }

    // 1) 英雄攻击：命中判定（#3 Q4 契约：命中 → (暴击) → 伤害掷骰；M2 无暴击词缀，命中后即掷骰）
    //    命中率 = min(100%, max(5%, 攻击值/(攻击值+敌方闪避值)))（物理桶；法术桶 M2 元素线同构）
    const hv = heroHitValue(h);
    const hit = hitChance(hv.phys, p.monster.dodge);
    const hitRoll = rngStep(rngState);
    rngState = hitRoll.state;

    let mhp = p.monster.hp;
    let didHit = hitRoll.value < hit;
    if (didHit) {
      const [dmin, dmax] = heroAttackRange(h);
      const roll = rngInt(rngState, dmin, dmax);
      rngState = roll.state;
      mhp = p.monster.hp - roll.value;
    }

    // 2) 击杀结算
    if (mhp <= 0) {
      const gold = rngInt(rngState, region.gold[0], region.gold[1]);
      rngState = gold.state;
      h = grantXp(healAfterKill(h), region.xp);
      const s = spawnMonster(region, rngState);
      rngState = s.rngState;
      p = {
        ...p,
        monster: { hp: s.hp, maxHp: s.maxHp, level: s.level, tier: s.tier, dodge: s.dodge },
        killCount: p.killCount + 1,
        goldEarned: p.goldEarned + gold.value,
      };
      org = { ...org, gold: org.gold + gold.value };
    } else {
      // 3) 怪物反击（物理；减伤 = 属性端物抗）
      const s = heroStats(h);
      const atk = rngInt(rngState, region.monster.dmg[0], region.monster.dmg[1]);
      rngState = atk.state;
      const taken = Math.floor(atk.value * (1 - s.physRes / 100));
      h = applyDamage(h, taken);
      p = { ...p, monster: { ...p.monster, hp: mhp } };

      // 4) 战败撤回
      if (h.hp <= 0) {
        const home = bringHome(h);
        events.push({
          text: `${h.name} 在 ${region.name} 负伤撤回余烬公会。铜锤上又添一道痕。`,
        });
        heroes = heroes.map((hh) => (hh.id === h.id ? home : hh));
        return stopExpedition(p);
      }
    }

    heroes = heroes.map((hh) => (hh.id === h.id ? h : hh));
    return p;
  });

  return { heroes, parties, org, rngState, events };
}
