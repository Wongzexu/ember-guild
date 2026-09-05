export const HERO_VISUALS = {
  eigrem: {
    portrait: "/assets-runtime/duelyst/units/eigrem/preview.png",
    animations: {
      idle: "/assets-runtime/duelyst/units/eigrem/idle.webm",
      run: "/assets-runtime/duelyst/units/eigrem/run.webm",
      attack: "/assets-runtime/duelyst/units/eigrem/attack.webm",
      hit: "/assets-runtime/duelyst/units/eigrem/hit.webm",
      death: "/assets-runtime/duelyst/units/eigrem/death.webm",
    },
    timing: { attackDurationMs: 1200, attackHitMs: 680 },
    // 受击点（归一化 0~1，画框左上原点）：被命中时特效落点，按单位画幅估算、精调后回写
    anchor: { hit: { x: 0.5, y: 0.56 } },
    // 攻击命中特效按单位像素风格绑定（换武器只改属性与近战/远程，不改外观）。
    // impact = { sprite, dx, dy } 或数组（叠放多层）：sprite = 共享 fx 库键；dx/dy = 落点偏移（px，右/上为正，缺省贴地居中）
    // 艾格雷姆专属 = 原版 Sworn Defender UnitAttackedFX（fx.js:8422）：蓝火花 + 白色冲击（fxImpactWhiteMedium）同帧叠放
    fx: { impact: [{ sprite: "fx_collisionblue" }, { sprite: "fx_impact2" }] },
  },
};

// 敌人视觉映射表：存档/战斗逻辑只持有视觉 ID（monster.visual），路径仅在此处。
// 未收录的视觉 ID 返回 null → 表现层显示文字占位（素材由 scripts/convert-duelyst-unit.mjs 转换入库）。
export const MONSTER_VISUALS = {
  "golden-mantella": {
    portrait: "/assets-runtime/duelyst/units/golden-mantella/preview.png",
    animations: {
      idle: "/assets-runtime/duelyst/units/golden-mantella/idle.webm",
      run: "/assets-runtime/duelyst/units/golden-mantella/run.webm",
      attack: "/assets-runtime/duelyst/units/golden-mantella/attack.webm",
      hit: "/assets-runtime/duelyst/units/golden-mantella/hit.webm",
      death: "/assets-runtime/duelyst/units/golden-mantella/death.webm",
    },
    // 舌击：官方 attackDelay 1.2s / 官方时长 2.08s ≈ 58% 处命中 → 26 帧转 22fps（1.18s）→ 精调 680ms
    timing: { attackDurationMs: 1180, attackHitMs: 680 },
    // 蛙类贴地，受击点与猎犬同级偏低
    anchor: { hit: { x: 0.5, y: 0.68 } },
    // 咬击类无专属特效（同猎犬逻辑：攻击演出自带，再叠冲击反而糊）
    fx: {},
  },
  "blaze-hound": {
    portrait: "/assets-runtime/duelyst/units/blaze-hound/preview.png",
    animations: {
      idle: "/assets-runtime/duelyst/units/blaze-hound/idle.webm",
      run: "/assets-runtime/duelyst/units/blaze-hound/run.webm",
      attack: "/assets-runtime/duelyst/units/blaze-hound/attack.webm",
      hit: "/assets-runtime/duelyst/units/blaze-hound/hit.webm",
      death: "/assets-runtime/duelyst/units/blaze-hound/death.webm",
    },
    // 猎犬扑击起手快、前爪落地才咬合，命中反馈定在 240ms。
    timing: { attackDurationMs: 1300, attackHitMs: 240 },
    // 猎犬体矮，受击点显著低于人形单位
    anchor: { hit: { x: 0.5, y: 0.67 } },
    // 无专属命中特效：扑咬攻击动画自带爆炸吼叫演出，再叠冲击反而糊（2026-09-03 定）。
    fx: {},
  },
  "blue-sting-scorpion": {
    portrait: "/assets-runtime/duelyst/units/blue-sting-scorpion/preview.png",
    animations: {
      idle: "/assets-runtime/duelyst/units/blue-sting-scorpion/idle.webm",
      run: "/assets-runtime/duelyst/units/blue-sting-scorpion/run.webm",
      attack: "/assets-runtime/duelyst/units/blue-sting-scorpion/attack.webm",
      hit: "/assets-runtime/duelyst/units/blue-sting-scorpion/hit.webm",
      death: "/assets-runtime/duelyst/units/blue-sting-scorpion/death.webm",
    },
    // 蝎子尾刺：官方 attackDelay 0.4s / 官方时长 0.96s ≈ 41% 处命中 → 映射到 1.2s webm，精调 500ms
    timing: { attackDurationMs: 1200, attackHitMs: 500 },
    anchor: { hit: { x: 0.5, y: 0.64 } },
    // 尾攻击 = 一道偏移爪痕：劈落在受击方上半身（原版同素材 fx_clawslash，2026-09-03 定）
    fx: { impact: { sprite: "fx_clawslash", dx: 14, dy: 52 } },
  },
  "ash-mephyt": {
    portrait: "/assets-runtime/duelyst/units/ash-mephyt/preview.png",
    animations: {
      idle: "/assets-runtime/duelyst/units/ash-mephyt/idle.webm",
      run: "/assets-runtime/duelyst/units/ash-mephyt/run.webm",
      attack: "/assets-runtime/duelyst/units/ash-mephyt/attack.webm",
      hit: "/assets-runtime/duelyst/units/ash-mephyt/hit.webm",
      death: "/assets-runtime/duelyst/units/ash-mephyt/death.webm",
    },
    // 灰烬喷吐：官方 attackDelay 1.3s / 官方时长 2.4s ≈ 54% 处命中 → 30 帧转 25fps（1.2s）→ 精调 650ms
    timing: { attackDurationMs: 1200, attackHitMs: 650 },
    // 矮小魔精，受击点略低于人形
    anchor: { hit: { x: 0.5, y: 0.62 } },
    // 烬雾喷吐落点 = 通用冲击（紫灰烟团，攻击动画自带，冲击只补落点反馈；素材库暂无紫色系 fx）
    fx: { impact: { sprite: "fx_collision" } },
  },
  "piercing-mantis": {
    portrait: "/assets-runtime/duelyst/units/piercing-mantis/preview.png",
    animations: {
      idle: "/assets-runtime/duelyst/units/piercing-mantis/idle.webm",
      run: "/assets-runtime/duelyst/units/piercing-mantis/run.webm",
      attack: "/assets-runtime/duelyst/units/piercing-mantis/attack.webm",
      hit: "/assets-runtime/duelyst/units/piercing-mantis/hit.webm",
      death: "/assets-runtime/duelyst/units/piercing-mantis/death.webm",
    },
    // 镰刀横斩：官方 attackDelay 0.5s / 官方时长 0.96s ≈ 52% 处命中 → 12 帧转 10fps（1.2s）→ 精调 620ms
    timing: { attackDurationMs: 1200, attackHitMs: 620 },
    // 高瘦螳螂，受击点接近画幅中位
    anchor: { hit: { x: 0.5, y: 0.5 } },
    // 双镰横斩 = 居中爪痕（同素材族 fx_clawslash，比蝎尾居中略低）
    fx: { impact: { sprite: "fx_clawslash", dx: 0, dy: 36 } },
  },
  "wild-tahr": {
    portrait: "/assets-runtime/duelyst/units/wild-tahr/preview.png",
    animations: {
      idle: "/assets-runtime/duelyst/units/wild-tahr/idle.webm",
      run: "/assets-runtime/duelyst/units/wild-tahr/run.webm",
      attack: "/assets-runtime/duelyst/units/wild-tahr/attack.webm",
      hit: "/assets-runtime/duelyst/units/wild-tahr/hit.webm",
      death: "/assets-runtime/duelyst/units/wild-tahr/death.webm",
    },
    // 顶角冲锋：官方无 attackDelay（原版 0 递延=接触即中）→ 冲锋类取早命中 ≈21%（猎犬扑击同款手感），33 帧转 27fps（1.22s）→ 260ms
    timing: { attackDurationMs: 1220, attackHitMs: 260 },
    // 巨兽四足，受击点中低位
    anchor: { hit: { x: 0.5, y: 0.6 } },
    // 顶角冲锋类无专属特效（原版同款：卡牌配置无 fx，冲锋动画自带撞击演出，2026-09-05 定）
    fx: {},
  },
};

export function visualOf(hero) {
  const visual = hero?.visual;
  if (!visual) return null;
  return HERO_VISUALS[visual.portrait] ?? null;
}

export function monsterVisualOf(monster) {
  if (!monster?.visual) return null;
  return MONSTER_VISUALS[monster.visual] ?? null;
}

// 按单位读取攻击时序：英雄存 visual 对象（portrait 键），敌人存 visual 字符串 id。
// 未收录的 visual（如尚未配素材的蓝刺蝎）返回默认值，不阻塞战斗表现。
export function actionTiming(unit, action) {
  const v = unit?.visual;
  const visual = typeof v === "string" ? MONSTER_VISUALS[v] : v ? HERO_VISUALS[v.portrait] : null;
  if (action === "attack") return visual?.timing ?? { attackDurationMs: 1000, attackHitMs: 500 };
  return { attackDurationMs: 300, attackHitMs: 0 };
}
