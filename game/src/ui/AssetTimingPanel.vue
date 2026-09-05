<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import { HERO_VISUALS, MONSTER_VISUALS } from "../data/visuals.js";
import { FX_SHEETS } from "../data/fx-sheets.js";
import FxImpactSprite from "./FxImpactSprite.vue";
import monstersData from "../data/monsters.json";

// 单位清单从素材配置推导（S6 素材分离）：新增 MONSTER_VISUALS 条目即自动进入本页，
// 不再维护硬编码单位表（首批四套 1-2/Boss 素材就是漏登记导致面板看不到）。
const units = [
  { key: "hero:eigrem", name: "艾格雷姆", side: "hero", visual: HERO_VISUALS.eigrem },
  ...Object.entries(MONSTER_VISUALS).map(([id, visual]) => ({
    key: `monster:${id}`,
    name: monstersData.monsters[id]?.name ?? id,
    side: "monster",
    visual,
  })),
];
const actions = ["idle", "run", "attack", "hit", "death"];
const actionNames = { idle: "待机", run: "奔跑", attack: "攻击", hit: "受击", death: "死亡" };
// 攻击时长/命中点与素材配置（visuals.js timing）同源，改配置即生效；
// 其余动作素材无 timing 配置，时间轴上界用兜底值（首批单位保留原手工值）。
const fallbackDurations = { idle: 1000, run: 800, hit: 300, death: 900 };
const durationOverrides = {
  "hero:eigrem": { idle: 1100, death: 900 },
  "monster:blue-sting-scorpion": { idle: 1400, death: 1100 },
  "monster:blaze-hound": { death: 800 },
};
const calibration = reactive(
  Object.fromEntries(
    units.flatMap(({ key, visual }) =>
      actions.map((action) => {
        const duration = action === "attack"
          ? visual.timing?.attackDurationMs ?? 1200
          : durationOverrides[key]?.[action] ?? fallbackDurations[action];
        return [`${key}:${action}`, { duration, impact: action === "attack" ? visual.timing?.attackHitMs ?? 500 : 0 }];
      }),
    ),
  ),
);

const unitKey = ref("hero:eigrem");
const action = ref("attack");
const currentMs = ref(0);
const playing = ref(false);
const speed = ref(1);
const video = ref(null);
// 攻击连播两次再停，便于看清收尾；受击素材本身极短（3帧），单次播放即可
const plays = ref(0);
const replayTwice = computed(() => action.value === "attack");

const unit = computed(() => units.find((item) => item.key === unitKey.value));
const profile = computed(() => calibration[`${unitKey.value}:${action.value}`]);
const progress = computed(() => (currentMs.value / profile.value.duration) * 100);
const src = computed(() => unit.value.visual.animations[action.value]);
// 命中反馈 = 跨越式触发：上一采样 < impact ≤ 当前采样即闪光。
// 不用"落在窗口内"判定——2x 时 timeupdate 采样间隔会整个跨过窗口，反馈丢失。
const impactFlash = ref(false);
let impactFlashTimer = null;

function flashImpact() {
  impactFlash.value = true;
  if (impactFlashTimer) clearTimeout(impactFlashTimer);
  impactFlashTimer = setTimeout(() => {
    impactFlash.value = false;
    impactFlashTimer = null;
  }, Math.max(120, Math.round(180 / speed.value)));
  popDamage();
  popImpactFx();
}

// 命中瞬间木桩身上叠冲击 fx，由 FxImpactSprite 按官方 PLIST 帧序播放（与战斗回放同源）。
// 共享 fx 库候选：按攻击类型/元素映射选用（DECISIONS 2026-09-03），此处预览切换；
// 多层组合（如艾格雷姆原版 = 蓝火花+白冲击）以 "+" 连接各层 fx 键。
const impactFxOptions = {
  "none": { label: "无（自带演出）" },
  "fx_impact": { label: "通用冲击" },
  "fx_collision": { label: "碰撞火花" },
  "fx_collisionblue": { label: "碰撞火花·蓝" },
  "fx_impact2": { label: "白色冲击（中）" },
  "fx_collisionsparkred": { label: "碰撞火花·红" },
  "fx_collisionsparkgreen": { label: "碰撞火花·绿" },
  "fx_collisionsparkpurple": { label: "碰撞火花·紫" },
  "fx_clawslash": { label: "爪击斩击（尾击）", offset: { dx: 14, dy: 52 } },
  "fx_animalslash": { label: "兽类抓咬（30 帧·2.4s）", scale: 1.2 },
  "fx_collisionblue+fx_impact2": { label: "艾格雷姆原版（蓝火花+白冲击）" },
};
// 单位切换时的默认命中特效：读 visuals.js fx.impact（字符串/对象/数组），
// 数组按层键以 "+" 组合；面板下拉只作临时预览覆盖；无配置（如猎犬）回落"无"。
function impactFxKeyOf(visual) {
  const impact = visual?.fx?.impact;
  if (!impact) return "none";
  const spriteOf = (l) => (typeof l === "string" ? l : l.sprite);
  return Array.isArray(impact) ? impact.map(spriteOf).join("+") : spriteOf(impact);
}
const unitVisualByKey = Object.fromEntries(units.map((unit) => [unit.key, unit.visual]));
const impactFx = ref(impactFxKeyOf(HERO_VISUALS.eigrem));
watch(unitKey, (key) => {
  impactFx.value = impactFxKeyOf(unitVisualByKey[key]);
}, { immediate: true });
// 每层落点偏移：单位配置中同 fx 的 dx/dy 优先，否则用选项默认值（缺省贴地居中）。
function layerOffset(sprite) {
  const config = unitVisualByKey[unitKey.value]?.fx?.impact;
  const layers = Array.isArray(config) ? config : [config];
  const match = layers.find((l) => l && (typeof l === "string" ? l : l.sprite) === sprite);
  if (match && typeof match === "object" && match.dx != null) return match;
  return impactFxOptions[sprite]?.offset ?? { dx: 0, dy: 0 };
}
const layerScale = (sprite) => impactFxOptions[sprite]?.scale ?? 1.8;
function fxDurationMs(sprite) {
  const s = FX_SHEETS[sprite];
  return s ? s.frames.length * s.delay * 1000 : 500;
}
const impactFxPops = ref([]);
let impactFxSeq = 0;

function popImpactFx() {
  if (impactFx.value === "none") return;
  const layers = impactFx.value.split("+").map((sprite) => ({ sprite }));
  const id = ++impactFxSeq;
  impactFxPops.value = [...impactFxPops.value, { id, layers }];
  setTimeout(() => {
    impactFxPops.value = impactFxPops.value.filter((p) => p.id !== id);
  }, Math.max(...layers.map((l) => fxDurationMs(l.sprite)), 500));
}

// 命中瞬间木桩头顶挑一个伤害数字（精调无真实伤害，固定 -0 占位）
const dmgPops = ref([]);
let dmgPopSeq = 0;

function popDamage() {
  const id = ++dmgPopSeq;
  dmgPops.value = [...dmgPops.value, { id }];
  setTimeout(() => {
    dmgPops.value = dmgPops.value.filter((p) => p.id !== id);
  }, 700);
}

function stop() {
  if (video.value) video.value.pause();
  playing.value = false;
}

function reset() {
  stop();
  currentMs.value = 0;
  plays.value = 0;
  if (video.value) video.value.currentTime = 0;
}

function play() {
  if (playing.value) {
    stop();
    return;
  }
  if (currentMs.value >= profile.value.duration) {
    currentMs.value = 0;
    plays.value = 0;
  }
  syncVideo();
  video.value?.play();
  playing.value = true;
}

function chooseUnit() {
  reset();
}

function chooseAction() {
  reset();
}

function syncVideo() {
  if (!video.value) return;
  video.value.playbackRate = speed.value;
  if (Number.isFinite(video.value.duration) && Math.abs(video.value.currentTime - currentMs.value / 1000) > 0.05) {
    video.value.currentTime = Math.min(currentMs.value / 1000, video.value.duration);
  }
}

watch(currentMs, syncVideo);
watch([speed, src], syncVideo);

function onTimeUpdate() {
  if (!video.value) return;
  const now = video.value.currentTime * 1000;
  const prev = currentMs.value;
  currentMs.value = now;
  // 跨越即触发，不限倍速（4x+ 采样间隔更大但跨越仍被捕获）。
  // 拖进度条不误触：v-model 先改 currentMs，随后的 timeupdate prev==now。
  const impact = profile.value.impact;
  if (action.value === "attack" && impact > 0 && prev < impact && now >= impact) {
    flashImpact();
  }
}

function onEnded() {
  // 兜底：impact 贴近片尾、末次 timeupdate 未及采样时，终点补一次跨越判定
  const impact = profile.value.impact;
  if (action.value === "attack" && impact > 0 && currentMs.value < impact) flashImpact();
  if (replayTwice.value && plays.value < 1) {
    plays.value += 1;
    if (video.value) {
      video.value.currentTime = 0;
      video.value.play();
    }
    return;
  }
  currentMs.value = profile.value.duration;
  playing.value = false;
}

onBeforeUnmount(() => {
  stop();
  if (impactFlashTimer) clearTimeout(impactFlashTimer);
});
</script>

<template>
  <div class="timing-panel">
    <header class="header">
      <div>
        <p class="eyebrow">PROTOTYPE · ASSET CALIBRATION</p>
        <h2>素材精调</h2>
        <p class="intro">一次校准一个动作。木桩只负责显示命中反馈，不参与战斗。</p>
      </div>
      <div class="transport">
        <button type="button" @click="reset">重置</button>
        <button class="primary" type="button" @click="play">{{ playing ? "暂停" : "播放" }}</button>
      </div>
    </header>

    <section class="selectors panel">
      <label>单位<select v-model="unitKey" @change="chooseUnit"><option v-for="item in units" :key="item.key" :value="item.key">{{ item.name }}</option></select></label>
      <label>动作<select v-model="action" @change="chooseAction"><option v-for="item in actions" :key="item" :value="item">{{ actionNames[item] }}</option></select></label>
      <div class="readonly-field"><span>素材时长</span><b>{{ profile.duration }} ms</b></div>
      <div class="readonly-field"><span>命中时间</span><b>{{ action === "attack" ? `${profile.impact} ms` : "无" }}</b></div>
      <label>播放速度<select v-model.number="speed"><option :value="0.5">0.5x 慢放</option><option :value="1">1x 原速</option><option :value="2">2x 快放</option></select></label>
      <label>命中特效<select v-model="impactFx"><option v-for="(opt, key) in impactFxOptions" :key="key" :value="key">{{ opt.label }}</option></select></label>
    </section>

    <section class="stage panel">
      <div class="stage-caption"><span>{{ unit.name }} · {{ actionNames[action] }}</span><b>{{ Math.round(currentMs) }} / {{ profile.duration }} ms</b></div>
      <div class="duel">
        <div class="asset-box" :class="{ impact: impactFlash }">
          <video ref="video" :key="src" :src="src" muted :loop="action === 'idle' || action === 'run'" playsinline @loadedmetadata="syncVideo" @timeupdate="onTimeUpdate" @ended="onEnded"></video>
          <span v-if="action === 'hit' && playing" class="fx-hit"></span>
          <strong>{{ unit.name }}</strong>
          <span>{{ actionNames[action] }}</span>
        </div>
        <div class="impact-line">命中</div>
        <div class="dummy" :class="{ hit: impactFlash }"><template v-if="impactFx !== 'none'"><span v-for="p in impactFxPops" :key="p.id" class="fx-pop-anchor"><FxImpactSprite v-for="l in p.layers" :key="l.sprite" class="fx-pop" :sprite="l.sprite" :scale="layerScale(l.sprite)" :style="{ transform: `translate(calc(-50% + ${layerOffset(l.sprite).dx}px), ${-layerOffset(l.sprite).dy}px)` }" /></span></template><span v-for="p in dmgPops" :key="p.id" class="dmg-pop">-0</span><div class="dummy-head"></div><div class="dummy-body"></div><div class="dummy-base"></div><span>木桩</span></div>
      </div>
      <div class="timeline">
        <div class="ruler"><span>0</span><span>{{ Math.round(profile.duration / 2) }}ms</span><span>{{ profile.duration }}ms</span></div>
        <div class="track"><span class="asset-range" :style="{ width: `${progress}%` }"></span><span v-if="action === 'attack'" class="impact-mark" :style="{ left: `${(profile.impact / profile.duration) * 100}%` }"></span><span class="playhead" :style="{ left: `${progress}%` }"></span></div>
        <input v-model.number="currentMs" class="scrubber" type="range" min="0" :max="profile.duration" step="10" aria-label="动作时间轴" />
        <div class="legend"><span><i class="swatch played"></i>已播放</span><span v-if="action === 'attack'"><i class="swatch impact-swatch"></i>命中点 {{ profile.impact }}ms</span></div>
      </div>
    </section>

    <section class="notes panel">
      <h3>精调说明</h3>
      <p>拖动时间轴确认动作收尾是否完整；命中点只控制木桩反馈，不会截断攻击视频。</p>
      <p>当前参数只在本页面内生效，确认后再写回素材配置。</p>
    </section>
  </div>
</template>

<style scoped>
.timing-panel { width: 100%; max-width: 900px; }.header, .stage-caption { display: flex; justify-content: space-between; align-items: end; gap: 16px; }.header { margin-bottom: 18px; }.eyebrow { color: var(--ember); font-size: 10px; letter-spacing: 3px; margin-bottom: 6px; }h2 { color: var(--gold); font-size: 22px; letter-spacing: 5px; }.intro { color: var(--dim); font-size: 12px; margin-top: 8px; }
button, select, input { border: 1px solid var(--line); background: var(--ash-2); color: var(--text); font: inherit; }button { cursor: pointer; }button:hover, button.primary { border-color: var(--ember); color: var(--ember); }.transport { display: flex; gap: 6px; }.transport button { padding: 8px 12px; font-size: 11px; }
.panel { border: 1px solid var(--line); background: var(--card-bg); box-shadow: var(--card-shadow); }.selectors { display: grid; grid-template-columns: 1.2fr 1fr 0.9fr 0.9fr 1fr 1fr; gap: 10px; padding: 12px; margin-bottom: 14px; }.selectors label, .readonly-field { color: var(--dim); font-size: 11px; }.selectors select { display: block; width: 100%; margin-top: 5px; padding: 7px; }.readonly-field b { display: block; margin-top: 13px; padding: 7px; border: 1px solid var(--line); color: var(--gold); font-weight: normal; }
.stage { padding: 16px; }.stage-caption span { color: var(--paper); font-size: 13px; }.stage-caption b { color: var(--ember); font-size: 11px; }.duel { display: grid; grid-template-columns: 1fr 80px 1fr; align-items: center; gap: 14px; max-width: 650px; margin: 18px auto 24px; }.asset-box { position: relative; display: grid; grid-template-columns: 150px 1fr; grid-template-rows: 1fr 1fr; gap: 6px 12px; align-items: center; }.asset-box video { grid-row: 1 / 3; width: 150px; height: 150px; object-fit: contain; image-rendering: pixelated; background: var(--ash-2); border: 1px solid var(--line); }.fx-hit { position: absolute; top: 47px; left: 3px; z-index: 2; width: 72px; height: 56px; background: url("/assets-runtime/duelyst/fx/fx_impactred.png") no-repeat; image-rendering: pixelated; transform: scale(1.8); transform-origin: 50% 50%; pointer-events: none; animation: fx-hit-play .35s steps(1, end) forwards; }.asset-box strong { color: var(--paper); font-size: 13px; }.asset-box span { color: var(--gold); font-size: 12px; }.asset-box.impact { animation: impact-flash .18s ease-out; }.impact-line { color: var(--ember); text-align: center; font-size: 11px; }.dummy { position: relative; height: 150px; display: grid; justify-items: center; align-content: end; transition: filter .1s, transform .1s; }.dummy.hit { filter: brightness(1.8) sepia(.5); transform: translateX(3px); }.dummy-head { width: 34px; height: 34px; border-radius: 50%; background: #8b6645; border: 2px solid #5d402d; }.dummy-body { width: 58px; height: 78px; border-radius: 8px 8px 4px 4px; background: #926b48; border: 2px solid #5d402d; }.dummy-base { width: 94px; height: 13px; border-radius: 50%; background: #49352a; }.dummy span { color: var(--dim); font-size: 11px; margin-top: 5px; }
.ruler { display: flex; justify-content: space-between; color: var(--dim); font-size: 10px; padding: 0 1px 5px; }.track { position: relative; height: 14px; border: 1px solid var(--line); background: var(--ash-2); }.asset-range { display: block; height: 100%; background: var(--ember-dim); }.impact-mark, .playhead { position: absolute; top: -5px; height: 24px; width: 2px; }.impact-mark { background: var(--gold); }.playhead { background: var(--paper); box-shadow: 0 0 5px var(--paper); }.scrubber { display: block; width: 100%; margin-top: -14px; opacity: 0; cursor: pointer; }.legend { display: flex; gap: 14px; color: var(--dim); font-size: 10px; margin-top: 8px; }.swatch { display: inline-block; width: 8px; height: 8px; margin-right: 4px; background: var(--ember-dim); }.impact-swatch { background: var(--gold); }.notes { margin-top: 14px; padding: 14px; }.notes h3 { color: var(--ember); font-size: 12px; letter-spacing: 3px; margin-bottom: 8px; }.notes p { color: var(--dim); font-size: 11px; line-height: 1.7; }
@keyframes fx-hit-play { 0% { background-position: -73px -57px; } 14.3% { background-position: -73px 0; } 28.6% { background-position: -73px -114px; } 42.9% { background-position: 0 -57px; } 57.2% { background-position: 0 0; } 71.5% { background-position: 0 -171px; } 85.8%, 100% { background-position: 0 -114px; } }
@keyframes impact-flash { 30% { filter: brightness(1.8); transform: translateX(-2px); } 60% { transform: translateX(2px); } }
.dummy .dmg-pop { position: absolute; top: -6px; left: 50%; margin: 0; color: var(--paper); font-size: 18px; font-weight: bold; text-shadow: 0 1px 3px rgba(0,0,0,.8); pointer-events: none; animation: dmg-pop .7s ease-out forwards; }
/* 冲击 fx 贴地锚定：底边与木桩地面齐平（bottom:0 = 底座下缘），水平中心 = 木桩中线；
   帧序/时长由 FxImpactSprite 按官方 PLIST 播放，本层只负责锚点与 dx/dy 偏移。 */
.fx-pop-anchor { display: contents; }
.fx-pop { position: absolute; bottom: 0; left: 50%; z-index: 2; }
@keyframes dmg-pop { 0% { opacity: 0; transform: translate(-50%, 8px); } 15% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -30px); } }
@media (max-width: 700px) { .header { align-items: start; flex-direction: column; }.transport { width: 100%; }.transport button { flex: 1; }.selectors { grid-template-columns: 1fr 1fr; }.duel { grid-template-columns: 1fr 40px 1fr; gap: 5px; }.asset-box { grid-template-columns: 80px 1fr; gap: 5px 7px; }.asset-box video { width: 80px; height: 100px; }.dummy { height: 120px; transform: scale(.8); }.dummy.hit { transform: scale(.8) translateX(3px); } }
</style>
