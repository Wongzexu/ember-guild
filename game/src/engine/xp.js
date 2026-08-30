// 经验曲线（NUMBERS §2.1 RS 累积表，离散锚点 → 线性插值）
// 锚点：Lv1=0 Lv5=388 Lv10=1154 Lv15=3626 Lv20=6730 Lv25=12360 Lv30=18000（#3 Q7 定稿：
// 原 13363 使 25→30 只 +1003、留下全表唯一每级成本下降段；18000 = 单调整档，
// 每级 1128→1291→2554（×1.14/×1.98）
// Lv30 = 冰冠山口解锁门（heroLevel:30）：异常曾使门槛形同虚设（22 杀），修正后 ≈125 杀摩擦恢复）
// Lv35=24455 Lv40=37224 Lv45=61256 Lv50=101333 Lv60=273742 Lv70=737627
// Lv75=1210421 Lv80=1986068 Lv85=2951373 Lv90=5346332 Lv95=8991064 Lv99=13034431

const ANCHOR_XP = [
  [1, 0],
  [5, 388],
  [10, 1154],
  [15, 3626],
  [20, 6730],
  [25, 12360],
  [30, 18000],
  [35, 24455],
  [40, 37224],
  [45, 61256],
  [50, 101333],
  [60, 273742],
  [70, 737627],
  [75, 1210421],
  [80, 1986068],
  [85, 2951373],
  [90, 5346332],
  [95, 8991064],
  [99, 13034431],
];

export const LEVEL_MAX = 99;

// 到达 level 所需的累积经验（线性插值，锚点精确）
export function xpToReach(level) {
  if (level <= 1) return 0;
  if (level >= LEVEL_MAX) return ANCHOR_XP[ANCHOR_XP.length - 1][1];
  const [l0, x0] = ANCHOR_XP[0];
  const [lN, xN] = ANCHOR_XP[ANCHOR_XP.length - 1];
  let l = l0;
  let x = x0;
  for (let i = 1; i < ANCHOR_XP.length; i++) {
    const [l1, x1] = ANCHOR_XP[i];
    if (level <= l1) {
      const ratio = (level - l) / (l1 - l);
      return x + ratio * (x1 - x);
    }
    l = l1;
    x = x1;
  }
  return xN;
}

// 升到某级还需多少经验（当前累积 xp → 下一级缺口）
export function xpToNext(xp, level) {
  return Math.max(0, xpToReach(level + 1) - xp);
}

// 累积 xp → 等级（1..99，锚点插值反算）
export function levelFromXp(xp) {
  if (xp <= 0) return 1;
  for (let lv = 1; lv < LEVEL_MAX; lv++) {
    if (xpToReach(lv + 1) > xp) return lv;
  }
  return LEVEL_MAX;
}
