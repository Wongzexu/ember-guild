// 种子随机数（纯函数步进版）：状态外置 → 存档快照可复现（ARCHITECTURE §4.3）
// mulberry32；rngState 为 uint32 状态，存于 state.meta.rngState（初始 seed 12345）

export function rngStep(state) {
  let a = (state + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: a };
}

// [min,max] 均匀（整数；min<=max）。返回 { value, state }
export function rngInt(state, min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  if (hi < lo) throw new Error(`rngInt: 区间无效 [${min},${max}]`);
  if (lo === hi) return { value: lo, state };
  const step = rngStep(state);
  return { value: lo + Math.floor(step.value * (hi - lo + 1)), state: step.state };
}
