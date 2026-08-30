import { createHero } from "./hero.js";

export const SAVE_KEY = "ardora_save_v1";
export const SAVE_VERSION = "0.2.0";

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

export function migrate(oldState) {
  if (oldState.version === SAVE_VERSION) {
    return oldState;
  }
  if (oldState.version === "0.1.0") {
    // M1：补初始英雄（艾格雷姆）+ 空队伍 + rng 状态（确定性种子）
    return {
      ...oldState,
      version: SAVE_VERSION,
      heroes: [createHero("anvil")],
      parties: [],
      meta: {
        ...oldState.meta,
        rngState: oldState.meta.rngSeed ?? 12345,
      },
    };
  }
  throw new Error(`migrate: 不支持的存档版本 ${oldState.version}（当前 ${SAVE_VERSION}）`);
}
