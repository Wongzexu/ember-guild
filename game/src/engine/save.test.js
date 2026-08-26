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
    expect(migrate({ ...createInitialState(), version: SAVE_VERSION })).toEqual(
      createInitialState()
    );
  });
});