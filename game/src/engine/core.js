export const TICK_MS = 500;

export function createInitialState() {
  const now = Date.now();
  return {
    version: "0.1.0",
    org: { name: "余烬公会", level: 1, legend: 0, gold: 0, materials: {} },
    heroes: [],
    parties: [],
    inventory: { gold: 0, materials: {}, items: [] },
    chronicle: [
      {
        t: 0,
        text: "灰烬纪元·元年：余烬公会于雅尔多拉成立。风起于余烬，传奇待书写。",
        legend: 0,
      },
    ],
    unlocks: {},
    meta: { createdAt: now, lastSavedAt: now, totalPlayMs: 0, rngSeed: 12345 },
  };
}

export function tick(state, dt) {
  if (!Number.isFinite(dt) || dt < 0) {
    throw new Error("tick: dt 必须是非负有限数值");
  }
  if (dt === 0) {
    return state;
  }
  return {
    ...state,
    meta: { ...state.meta, totalPlayMs: state.meta.totalPlayMs + dt },
  };
}