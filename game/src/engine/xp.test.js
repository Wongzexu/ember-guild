import { describe, it, expect } from "vitest";
import { xpToReach, xpToNext, levelFromXp, LEVEL_MAX } from "./xp.js";

describe("xp 曲线（NUMBERS §2.1）", () => {
  it("锚点值精确", () => {
    expect(xpToReach(1)).toBe(0);
    expect(xpToReach(5)).toBe(388);
    expect(xpToReach(10)).toBe(1154);
    expect(xpToReach(30)).toBe(18000);
    expect(xpToReach(50)).toBe(101333);
    expect(xpToReach(99)).toBe(13034431);
  });

  it("每级成本无下降段（RS 单调 · #3 Q7 契约）", () => {
    for (let lv = 1; lv <= LEVEL_MAX - 2; lv++) {
      const c1 = xpToReach(lv + 1) - xpToReach(lv);
      const c2 = xpToReach(lv + 2) - xpToReach(lv + 1);
      expect(c2).toBeGreaterThanOrEqual(c1 - 1e-6); // 浮点容差
    }
  });

  it("插值单调递增且 Lv2 门槛 ≈ (5级增量)/4", () => {
    const d1 = xpToReach(5) - xpToReach(1);
    expect(xpToReach(2)).toBeGreaterThan(0);
    expect(xpToReach(2)).toBeCloseTo(xpToReach(1) + d1 / 4, 6);
    for (let lv = 1; lv < LEVEL_MAX; lv++) {
      expect(xpToReach(lv)).toBeLessThan(xpToReach(lv + 1));
    }
  });

  it("xpToNext：0 经验在 Lv1 需 ~97 升至 Lv2", () => {
    expect(xpToNext(0, 1)).toBeCloseTo(xpToReach(2), 6);
  });

  it("levelFromXp 反算正确", () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(388)).toBe(5);
    expect(levelFromXp(387)).toBe(4);
    expect(levelFromXp(1154)).toBe(10);
    expect(levelFromXp(13034431)).toBe(99);
    expect(levelFromXp(1e12)).toBe(99);
  });
});
