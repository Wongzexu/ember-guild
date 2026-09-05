import { describe, it, expect, beforeEach } from "vitest";
import { createInitialState } from "./core.js";
import { SAVE_KEY, SAVE_VERSION, createSaveAdapter, migrate } from "./save.js";

function makeLocalStorageMock() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    _store: store,
  };
}

describe("save 往返", () => {
  beforeEach(() => {
    globalThis.localStorage = makeLocalStorageMock();
  });

  it("save → load 往返深比较一致", async () => {
    const adapter = createSaveAdapter();
    const s = createInitialState();
    await adapter.save(s);
    const loaded = await adapter.load();
    expect(loaded).toEqual(s);
    expect(loaded).not.toBe(s);
  });

  it("载入无存档 → 返回 null（首建路径）", async () => {
    const adapter = createSaveAdapter();
    expect(await adapter.load()).toBeNull();
    expect(localStorage.getItem(SAVE_KEY)).toBeNull();
  });

  it("存档 version 不匹配 → 走 migrate 桩（明确报错）", () => {
    const old = { ...createInitialState(), version: "0.0.9" };
    expect(() => migrate(old)).toThrow(/不支持的存档版本 0\.0\.9/);
    const same = { ...createInitialState(), version: SAVE_VERSION };
    expect(migrate(same)).toEqual(same);
  });

  it("同版本旧存档：过期人设文案对齐当前数据定义", () => {
    const stale = {
      ...createInitialState(),
      version: SAVE_VERSION,
      heroes: [
        { ...createInitialState().heroes[0], personality: "温斯顿式守护者 · 责任在心" },
      ],
    };
    const out = migrate(stale);
    expect(out.heroes[0].personality).toBe("守护者 · 责任在心");
  });
});

describe("新手引导存档状态（M2 序章）", () => {
  it("新存档默认：序章未完成，step=prologue", () => {
    const s = createInitialState();
    expect(s.onboarding).toEqual({ step: "prologue", completed: false });
  });

  it("v0.3 旧档迁移：序章视为已完成（M1 老玩家不被拉回序章）", () => {
    const old = createInitialState();
    delete old.onboarding;
    old.version = "0.3.0";
    const out = migrate(old);
    expect(out.onboarding).toEqual({ step: "completed", completed: true });
  });

  it("v0.1/v0.2 链式迁移同样补序章完成态", () => {
    const out = migrate({ version: "0.1.0", org: {}, meta: { rngSeed: 1 } });
    expect(out.onboarding).toEqual({ step: "completed", completed: true });
  });

  it("已完成引导的存档迁移不覆写进度", () => {
    const out = migrate({
      ...createInitialState(),
      onboarding: { step: "prologue:3", completed: false },
    });
    expect(out.onboarding).toEqual({ step: "prologue:3", completed: false });
  });

  it("清档（无存档）→ 走首建路径，序章从头播放", async () => {
    const adapter = createSaveAdapter();
    expect(await adapter.load()).toBeNull();
    expect(createInitialState().onboarding.completed).toBe(false);
  });
});

describe("存档迁移 v0.2→v0.3（蓝图 #01：weaponId 铸实例）", () => {
  // 构造一份 M1 真实形态的 v0.2 档：hero 带 weaponId、无 equipment、meta 无 nextItemId
  function makeV02() {
    const s = createInitialState();
    const { equipment, ...heroWithoutEquipment } = s.heroes[0];
    void equipment;
    return {
      ...s,
      version: "0.2.0",
      heroes: [{ ...heroWithoutEquipment, weaponId: "copper-hammer" }],
      meta: { ...s.meta, nextItemId: undefined },
    };
  }

  it("weaponId 铸成白装实例入 mainhand 并删字段；meta.nextItemId=2", () => {
    const out = migrate(makeV02());
    expect(out.version).toBe(SAVE_VERSION);
    const h = out.heroes[0];
    expect(h.weaponId).toBeUndefined();
    expect(h.equipment.mainhand).toEqual({
      id: 1,
      baseId: "copper-hammer",
      rarity: "white",
      affixes: [],
    });
    expect(Object.keys(h.equipment).length).toBe(8);
    expect(out.meta.nextItemId).toBe(2);
  });

  it("背包已有实例时不冲突：nextItemId = 已用最大 id + 1", () => {
    const v02 = makeV02();
    v02.inventory.items = [{ id: 7, baseId: "wood-shield", rarity: "white", affixes: [] }];
    const out = migrate(v02);
    expect(out.heroes[0].equipment.mainhand.id).toBe(8);
    expect(out.meta.nextItemId).toBe(9);
    expect(out.inventory.items).toEqual([
      { id: 7, baseId: "wood-shield", rarity: "white", affixes: [] },
    ]);
  });

  it("v0.1→v0.3 链式：补英雄（含起始实例）+ rngState 接续", () => {
    const out = migrate({ version: "0.1.0", org: {}, meta: { rngSeed: 777 } });
    expect(out.version).toBe(SAVE_VERSION);
    expect(out.heroes[0].equipment.mainhand.baseId).toBe("copper-hammer");
    expect(out.heroes[0].equipment.mainhand.id).toBe(1);
    expect(out.meta.nextItemId).toBe(2);
    expect(out.meta.rngState).toBe(777);
    expect(out.heroes[0].weaponId).toBeUndefined(); // 新建档不再产生 weaponId
  });
});

describe("存档迁移 v0.4→v0.5（编年史两层分轨）", () => {
  function makeV04() {
    const s = createInitialState();
    return {
      ...s,
      version: "0.4.0",
      chronicle: [
        { t: 0, text: "灰烬纪元·元年：余烬公会于雅尔多拉成立。风起于余烬，传奇待书写。", legend: 0 },
        { t: 1, text: "艾格雷姆提起铜锤走向迷雾：第一战，就在 0-1「初始」。", legend: 0 },
        { t: 2, text: "艾格雷姆 击败了 余烬猎犬：第一次挥锤干净利落。迷雾深处传来低吼——「迷雾边缘」已解锁。", legend: 0 },
        { t: 3, text: "艾格雷姆 在 迷雾边缘 发现了 白焰短杖。", legend: 0 },
        { t: 4, text: "艾格雷姆 在 迷雾边缘 负伤撤回余烬公会。铜锤上又添一道痕。", legend: 0 },
      ],
    };
  }

  it("事实条目迁入 battleLog；里程碑留在 chronicle 并重写为新文案", () => {
    const out = migrate(makeV04());
    expect(out.version).toBe(SAVE_VERSION);
    // 事实条目 → 战记
    expect(out.battleLog.map((b) => b.text)).toEqual([
      "艾格雷姆 在 迷雾边缘 发现了 白焰短杖。",
      "艾格雷姆 在 迷雾边缘 负伤撤回余烬公会。铜锤上又添一道痕。",
    ]);
    // 里程碑 → 史诗层，旧文案去数值化
    expect(out.chronicle.map((c) => c.text)).toEqual([
      "灰烬纪元·元年：余烬公会于雅尔多拉成立。风起于余烬，传奇待书写。",
      "雾墙之前，艾格雷姆提起铜锤，迈出了第一步。",
      "猎犬倒在锤下，余烬未熄。迷雾深处传来低吼——「迷雾边缘」的门扉已被推开。",
    ]);
  });

  it("新档：battleLog 为空数组，首条史诗不受影响", () => {
    const out = migrate({ ...createInitialState(), version: SAVE_VERSION });
    expect(out.battleLog).toEqual([]);
    expect(out.chronicle.length).toBe(1);
  });
});

describe("存档迁移 v0.5→v0.6（#16 Boss 解锁链）", () => {
  it("旧档补 bossKills 空表（视为尚未击败任何小 Boss）", () => {
    const s = { ...createInitialState(), version: "0.5.0" };
    delete s.bossKills;
    const out = migrate(s);
    expect(out.version).toBe(SAVE_VERSION);
    expect(out.bossKills).toEqual({});
  });

  it("已有 bossKills 的存档原样保留；新档结构自带 bossKills", () => {
    const kept = migrate({
      ...createInitialState(),
      version: "0.5.0",
      bossKills: { "mist-fringe": true },
    });
    expect(kept.bossKills).toEqual({ "mist-fringe": true });

    const fresh = createInitialState();
    expect(fresh.bossKills).toEqual({});
    expect(fresh.version).toBe(SAVE_VERSION);
  });
});

describe("存档迁移 v0.6→v0.7（#16 二批 Boss 出场重构）", () => {
  it("旧档补 regionKills/bossSpotted 空表（视为尚未发现任何 Boss）", () => {
    const s = { ...createInitialState(), version: "0.6.0" };
    delete s.regionKills;
    delete s.bossSpotted;
    const out = migrate(s);
    expect(out.version).toBe(SAVE_VERSION);
    expect(out.regionKills).toEqual({});
    expect(out.bossSpotted).toEqual({});
  });

  it("已有发现状态的存档原样保留；新档结构自带两表", () => {
    const kept = migrate({
      ...createInitialState(),
      version: "0.6.0",
      regionKills: { "mist-fringe": 12 },
      bossSpotted: { "mist-fringe": true },
    });
    expect(kept.regionKills).toEqual({ "mist-fringe": 12 });
    expect(kept.bossSpotted).toEqual({ "mist-fringe": true });

    const fresh = createInitialState();
    expect(fresh.regionKills).toEqual({});
    expect(fresh.bossSpotted).toEqual({});
    expect(fresh.version).toBe(SAVE_VERSION);
  });
});