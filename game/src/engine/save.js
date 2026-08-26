export const SAVE_KEY = "ardora_save_v1";
export const SAVE_VERSION = "0.1.0";

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
  throw new Error(`migrate: 不支持的存档版本 ${oldState.version}（当前 ${SAVE_VERSION}）`);
}