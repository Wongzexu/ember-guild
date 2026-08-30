import { stepExpeditions } from "./expedition.js";
import { createHero } from "./hero.js";

export const TICK_MS = 500;

export function createInitialState() {
  const now = Date.now();
  return {
    version: "0.2.0",
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
    unlocks: {},
    meta: {
      createdAt: now,
      lastSavedAt: now,
      totalPlayMs: 0,
      rngSeed: 12345,
      rngState: 12345,
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
  const exp = stepExpeditions(state);
  const next = {
    ...state,
    meta: {
      ...state.meta,
      totalPlayMs: state.meta.totalPlayMs + dt,
      rngState: exp.rngState,
    },
    heroes: exp.heroes,
    parties: exp.parties,
    org: exp.org,
  };
  if (exp.events.length > 0) {
    next.chronicle = [
      ...state.chronicle,
      ...exp.events.map((e) => ({ t: Date.now(), text: e.text, legend: 0 })),
    ];
  }
  return next;
}
