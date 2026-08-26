import { describe, it, expect } from "vitest";
import { TICK_MS, createInitialState, tick } from "./core.js";

describe("core.tick", () => {
  it("tick(state, 0) 状态不变", () => {
    const s = createInitialState();
    const next = tick(s, 0);
    expect(next).toBe(s);
    expect(next.meta.totalPlayMs).toBe(0);
  });

  it("tick(state, 500) → totalPlayMs +500", () => {
    const s = createInitialState();
    const next = tick(s, TICK_MS);
    expect(next.meta.totalPlayMs).toBe(500);
    expect(next).not.toBe(s);
  });

  it("连续多次 tick 时间正确累计", () => {
    let s = createInitialState();
    for (let i = 0; i < 10; i++) {
      s = tick(s, TICK_MS);
    }
    expect(s.meta.totalPlayMs).toBe(5000);
  });
});