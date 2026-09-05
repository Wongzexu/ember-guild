import { classDef, createHero } from "./hero.js";
import { emptyEquipment, forgeInstance } from "./equipment.js";

export const SAVE_KEY = "ardora_save_v1";
export const SAVE_VERSION = "0.7.0";

// 英雄的静态人设（性格/背景/来源/口头禅/称号）由数据定义硬编码，存档只存运行时状态。
// 若旧存档残留过期文案（如"温斯顿式守护者"），加载时一律从当前 def 重新取，保证与数据一致。
function normalizeHeroes(heroes) {
  return (heroes ?? []).map((h) => {
    try {
      const def = classDef(h.class);
      return {
        ...h,
        personality: def.personality,
        background: def.background,
        origin: def.origin,
        visual: def.visual,
      };
    } catch {
      return h;
    }
  });
}

export function createSaveAdapter() {
  return {
    async load() {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw === null) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    },
    async save(snapshot) {
      localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot));
    },
  };
}

// v0.1→v0.2：补初始英雄（艾格雷姆，起始铜锤已铸实例）+ 空队伍 + rng 状态（确定性种子）
function migrate010to020(oldState) {
  return {
    ...oldState,
    version: "0.2.0",
    heroes: [createHero("anvil")],
    parties: [],
    meta: {
      ...oldState.meta,
      rngState: oldState.meta.rngSeed ?? 12345,
    },
  };
}

// v0.2→v0.3（蓝图 #01 存档迁移）：
// ① hero.weaponId 铸成白装实例塞 equipment.mainhand 并删除字段（消灭双真源）；
// ② hero.equipment 8 槽兜底；③ inventory 兜底（老档为空）；
// ④ meta.nextItemId = 已用最大实例 id + 1（首档迁移后 = 2）
function migrateTo030(state) {
  let maxId = 0;
  const scan = (inst) => {
    if (inst && Number.isFinite(inst.id) && inst.id > maxId) maxId = inst.id;
  };

  const inventory = { gold: 0, materials: {}, ...(state.inventory ?? {}) };
  inventory.items = (inventory.items ?? []).map((inst) => {
    scan(inst);
    return inst;
  });

  const heroes = (state.heroes ?? []).map((h) => {
    const equipment = { ...emptyEquipment(), ...(h.equipment ?? {}) };
    Object.values(equipment).forEach(scan);
    let hero = { ...h, equipment };
    if (hero.weaponId) {
      equipment.mainhand = forgeInstance(hero.weaponId, maxId + 1);
      maxId += 1;
      hero = { ...hero };
      delete hero.weaponId;
    }
    return hero;
  });

  return {
    ...state,
    version: "0.3.0",
    heroes,
    inventory,
    meta: { ...state.meta, nextItemId: maxId + 1 },
  };
}

// v0.3→v0.4（序章引导）：旧档一律视为已完成序章（M1 老玩家不被拉回序章重看）；
// 新档由 createInitialState 给出 onboarding.step="prologue"。
function migrateTo040(state) {
  return {
    ...state,
    version: "0.4.0",
    onboarding: state.onboarding ?? { step: "completed", completed: true },
  };
}

// v0.4→v0.5（编年史两层分轨）：
// chronicle 只留史诗里程碑（叙事文案、不带数值）；事实类条目迁入 battleLog 战记流水。
// 旧里程碑文案按新模板重写（去编号/数值化）。
const MILESTONE_REWRITES = [
  {
    match: "提起铜锤走向迷雾",
    text: "雾墙之前，艾格雷姆提起铜锤，迈出了第一步。",
  },
  {
    match: "迷雾深处传来低吼",
    text: "猎犬倒在锤下，余烬未熄。迷雾深处传来低吼——「迷雾边缘」的门扉已被推开。",
  },
];
const FACT_MARKS = ["击败了", "发现了", "负伤撤回", "失去队员"];

function migrateTo050(state) {
  const chronicle = [];
  const battleLog = [...(state.battleLog ?? [])];
  for (const c of state.chronicle ?? []) {
    const rewrite = MILESTONE_REWRITES.find((r) => c.text.includes(r.match));
    if (rewrite) {
      chronicle.push({ ...c, text: rewrite.text });
    } else if (FACT_MARKS.some((m) => c.text.includes(m))) {
      battleLog.push({ t: c.t, text: c.text });
    } else {
      chronicle.push(c);
    }
  }
  return { ...state, version: "0.5.0", chronicle, battleLog };
}

// v0.5→v0.6（#16 区域阶梯首批 + Boss 解锁链）：补 bossKills 字段（老档视为尚未击败任何小 Boss）。
function migrateTo060(state) {
  return { ...state, version: "0.6.0", bossKills: state.bossKills ?? {} };
}

// v0.6→v0.7（#16 二批 Boss 出场重构）：补各区击杀累计 + Boss 已发现集合（老档视为空 = 尚未发现）。
function migrateTo070(state) {
  return {
    ...state,
    version: SAVE_VERSION,
    regionKills: state.regionKills ?? {},
    bossSpotted: state.bossSpotted ?? {},
  };
}

export function migrate(oldState) {
  if (
    !["0.1.0", "0.2.0", "0.3.0", "0.4.0", "0.5.0", "0.6.0", SAVE_VERSION].includes(oldState.version)
  ) {
    throw new Error(`migrate: 不支持的存档版本 ${oldState.version}（当前 ${SAVE_VERSION}）`);
  }
  let next = oldState;
  if (next.version === "0.1.0") next = migrate010to020(next);
  if (next.version !== SAVE_VERSION) next = migrateTo030(next);
  if (next.version !== SAVE_VERSION) next = migrateTo040(next);
  if (next.version !== SAVE_VERSION) next = migrateTo050(next);
  if (next.version !== SAVE_VERSION) next = migrateTo060(next);
  if (next.version !== SAVE_VERSION) next = migrateTo070(next);
  // 同版本也走一次：将过期的人设文案对齐当前数据定义（见 normalizeHeroes）。
  return { ...next, heroes: normalizeHeroes(next.heroes) };
}
