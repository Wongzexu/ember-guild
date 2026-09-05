import { stepExpeditions } from "./expedition.js";
import { createHero } from "./hero.js";
import { SAVE_VERSION } from "./save.js";

export const TICK_MS = 500;

// 战记（具体事件层）滚动上限：只保留最近 300 条，防存档膨胀（史诗层 chronicle 不设限）
const BATTLE_LOG_CAP = 300;

export function createInitialState() {
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    org: { name: "余烬公会", level: 1, legend: 0, gold: 0, materials: {} },
    heroes: [createHero("anvil")],
    parties: [],
    inventory: { gold: 0, materials: {}, items: [] },
    chronicle: [
      {
        t: 0,
        text: "灰烬纪元·元年：余烬公会于雅尔多拉成立。风起于余烬，传奇待书写。",
        legend: 0,
      },
    ],
    // 战记：具体事件层（出手/击败/掉落/撤回的事实流水），BATTLE_LOG_CAP 滚动截断
    battleLog: [],
    unlocks: {},
    // 小 Boss 首杀记录（#16 解锁链）：{ [regionKey]: true }——1-2 起需要"上一区 Boss 已通过"
    bossKills: {},
    // Boss 发现（#16 二批）：各区小怪击杀累计 + 已发现集合（sticky，发现后随时可挑战）
    regionKills: {},
    bossSpotted: {},
    onboarding: {
      step: "prologue",
      completed: false,
    },
    meta: {
      createdAt: now,
      lastSavedAt: now,
      totalPlayMs: 0,
      rngSeed: 12345,
      rngState: 12345,
      combatEventSeq: 0,
      // 掉落实例 id 主键（#01：单调自增、不占 rng；起始铜锤占 1 → 下一个 = 2）
      nextItemId: 2,
    },
  };
}

export function tick(state, dt) {
  if (!Number.isFinite(dt) || dt < 0) {
    throw new Error("tick: dt 必须是非负有限数值");
  }
  if (dt === 0) {
    return state;
  }
  const exp = stepExpeditions(state, dt);
  const next = {
    ...state,
    meta: {
      ...state.meta,
      totalPlayMs: state.meta.totalPlayMs + dt,
      rngState: exp.rngState,
      nextItemId: exp.nextItemId,
      combatEventSeq: exp.combatEventSeq,
    },
    heroes: exp.heroes,
    parties: exp.parties,
    org: exp.org,
    inventory: exp.inventory,
    combatEvents: exp.combatEvents,
    regionKills: exp.regionKills,
    bossSpotted: exp.bossSpotted,
  };
  // 两层分轨：里程碑（type 缺省/明确）→ 编年史史诗层；事实（type="fact"）→ 战记具体事件层。
  // 战记顺序 = 时间序：先出手流水（combatEvent.log），后步内结算事实（掉落/撤回）。
  let battleLog = [...(state.battleLog ?? [])];
  for (const c of exp.combatEvents) {
    if (c.log) battleLog.push({ t: Date.now(), text: c.log });
  }
  if (exp.events.length > 0) {
    const milestones = exp.events.filter((e) => e.type !== "fact");
    const facts = exp.events.filter((e) => e.type === "fact");
    if (milestones.length > 0) {
      next.chronicle = [
        ...state.chronicle,
        ...milestones.map((e) => ({ t: Date.now(), text: e.text, legend: 0 })),
      ];
      // 引擎事件 → 解锁登记（0-1 首杀解锁 1-1；unlocks 为幂等集合）
      // Boss 首杀（#16）：bossKills 按 regionKey 登记——下一区 unlock.bossKey 的门槛事实
      for (const e of milestones) {
        if (e.type === "tutorial-complete") {
          next.unlocks = { ...state.unlocks, [e.regionKey]: true };
        }
        if (e.type === "boss-cleared") {
          next.bossKills = { ...(state.bossKills ?? {}), [e.regionKey]: true };
        }
      }
    }
    for (const e of facts) battleLog.push({ t: Date.now(), text: e.text });
  }
  next.battleLog =
    battleLog.length > BATTLE_LOG_CAP
      ? battleLog.slice(battleLog.length - BATTLE_LOG_CAP)
      : battleLog;
  return next;
}
