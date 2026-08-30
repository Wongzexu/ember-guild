import { describe, it, expect } from "vitest";
import { rngStep, rngInt } from "./prng.js";

describe("prng（纯函数步进）", () => {
  it("固定状态 → 确定序列", () => {
    const a = rngStep(12345).value;
    const b = rngStep(12345).value;
    expect(a).toBe(b);
    let s1 = 12345;
    let s2 = 12345;
    for (let i = 0; i < 5; i++) {
      expect(rngStep(s1).value).toBe(rngStep(s2).value);
      s1 = rngStep(s1).state;
      s2 = rngStep(s2).state;
    }
  });

  it("状态推进可复现（step 返回 next state）", () => {
    const { value, state } = rngStep(12345);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
    expect(Number.isInteger(state)).toBe(true);
    expect(state).toBeGreaterThanOrEqual(0);
    expect(state).toBeLessThanOrEqual(0xffffffff);
  });

  it("rngInt 落在闭区间且推进状态", () => {
    let s = 999;
    for (let i = 0; i < 200; i++) {
      const r = rngInt(s, 1, 3);
      expect(Number.isInteger(r.value)).toBe(true);
      expect(r.value).toBeGreaterThanOrEqual(1);
      expect(r.value).toBeLessThanOrEqual(3);
      expect(r.state).not.toBe(s);
      s = r.state;
    }
  });

  it("rngInt 单点区间返回该值且状态不变", () => {
    const s = 777;
    const r = rngInt(s, 5, 5);
    expect(r.value).toBe(5);
    expect(r.state).toBe(s);
  });

  it("非法区间抛错", () => {
    expect(() => rngInt(1, 10, 1)).toThrow();
    expect(() => rngInt(1, 5, -1)).toThrow();
  });
});
