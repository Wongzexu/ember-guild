<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { HERO_VISUALS, MONSTER_VISUALS, actionTiming } from "../data/visuals.js";
import FxImpactSprite from "./FxImpactSprite.vue";

const HERO_ATTACK = actionTiming({ visual: { portrait: "eigrem" } }, "attack");
const ENEMY_ATTACK = actionTiming({ visual: "blaze-hound" }, "attack");

// 受击窗口前移缓冲：hit.webm 仅 0.3s、与 300ms 窗口零余量，video 重挂载的解码延迟会吃掉整段受击帧。
// 提前触发只是表现层缓冲，时间轴上事件仍显示真实命中时刻。
const HIT_LEAD_MS = 100;
const HIT_DURATION = 300;
// 命中特效播放窗口：覆盖共享库最长特效（剑气斩 23 帧 × 80ms ≈ 1.84s）。
const FX_DURATION = 1900;

// 预加载全部动作素材：受击是播放中途才首次挂载对应 video，不预热则首播必然丢帧。
const PRELOAD_UNITS = ["eigrem", "blaze-hound"];
const PRELOAD_ACTIONS = ["idle", "run", "attack", "hit", "death"];
const preloadedVideos = [];

function preloadAll() {
  for (const unit of PRELOAD_UNITS) {
    for (const action of PRELOAD_ACTIONS) {
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.src = videoSrc(unit, action);
      video.load();
      preloadedVideos.push(video);
    }
  }
}

// 回放场景表：场景只声明输入——谁在第几毫秒发起攻击。事件全部由统一规则推导：
// 1) 指令即播攻击动画（attackDurationMs）；2) 命中时刻 = 指令 + attackHitMs，
// 在受击方位置放攻击方的 fx.impact，伤害进计算层；3) 受击动画仅当受击方当时空闲才播，
// 忙碌（自己的攻击未播完）时跳过，反馈由特效承担。
const scenarios = {
  "hero-basic": {
    label: "英雄出手",
    description: "最基本场景：英雄攻击一次，敌人受击。",
    duration: 1800,
    commands: [{ at: 0, side: "hero" }],
  },
  simultaneous: {
    label: "双方同时出手",
    description: "同一个战斗时刻，双方同时完成攻击。",
    duration: 3000,
    commands: [
      { at: 0, side: "hero" },
      { at: 0, side: "enemy" },
    ],
  },
};

function nameOf(side) {
  return side === "hero" ? "英雄" : "敌人";
}

function timingOf(side) {
  return side === "hero" ? HERO_ATTACK : ENEMY_ATTACK;
}

// 由攻击指令推导事件：攻击（事实+表现）与命中（事实；命中动画是否播由忙碌规则决定）。
// fx 段宽 = 播放窗口按场景剩余时长截断，防时间轴溢出。
function deriveEvents(commands, totalMs) {
  const events = [];
  for (const cmd of commands) {
    const victim = cmd.side === "hero" ? "enemy" : "hero";
    const timing = timingOf(cmd.side);
    const hitAt = cmd.at + timing.attackHitMs;
    events.push({ at: cmd.at, duration: timing.attackDurationMs, actor: nameOf(cmd.side), label: "攻击", kind: "attack", side: cmd.side });
    const busy = commands.some((other) => other.side === victim && hitAt >= other.at && hitAt < other.at + timingOf(other.side).attackDurationMs);
    events.push({
      at: hitAt,
      duration: Math.max(300, Math.min(FX_DURATION, totalMs - hitAt)),
      actor: nameOf(victim),
      label: busy ? "受到攻击 · 仅特效" : "受到攻击 · 结算",
      kind: "impact",
      side: victim,
      owner: cmd.side,
      hitAnim: !busy,
    });
  }
  return events.sort((a, b) => a.at - b.at);
}

const scenarioKey = ref("hero-basic");
const currentTime = ref(0);
const playing = ref(false);
let timer = null;

const scenario = computed(() => {
  const base = scenarios[scenarioKey.value];
  return { ...base, events: deriveEvents(base.commands, base.duration) };
});
const progress = computed(() => (currentTime.value / scenario.value.duration) * 100);
const activeEvent = computed(() => {
  const events = scenario.value.events.filter((event) => event.at <= currentTime.value);
  return events[events.length - 1] ?? scenario.value.events[0];
});

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  playing.value = false;
}

function play() {
  if (playing.value) {
    stop();
    return;
  }
  currentTime.value = 0;
  playing.value = true;
  timer = setInterval(() => {
    currentTime.value = Math.min(scenario.value.duration, currentTime.value + 50);
    if (currentTime.value >= scenario.value.duration) stop();
  }, 50);
}

function chooseScenario(key) {
  scenarioKey.value = key;
  stop();
  currentTime.value = 0;
}

function styleSegment(event) {
  return {
    left: `${(event.at / scenario.value.duration) * 100}%`,
    width: `${(event.duration / scenario.value.duration) * 100}%`,
  };
}

function trackEvents(side) {
  return scenario.value.events.filter((event) => event.side === side);
}

// 动作优先级：攻击动画永远完整播放；受击动画仅当命中方被标记 hitAnim（受击时空闲）才出现。
function actionFor(side) {
  // 未开始播放（入场/场景切换后）双方保持待机，点击播放才进入动作
  if (!playing.value && currentTime.value === 0) return "idle";
  const t = currentTime.value;
  const attacking = trackEvents(side).some((event) => event.kind === "attack" && t >= event.at && t < event.at + event.duration);
  if (attacking) return "attack";
  const hit = trackEvents(side).some((event) => event.kind === "impact" && event.hitAnim && t >= event.at - HIT_LEAD_MS && t < event.at + HIT_DURATION);
  return hit ? "hit" : "idle";
}

// 命中特效（新受击体系）：受击方身上放的是攻击方的 fx.impact（visuals.js 单位绑定），
// 落点 = 受击方自己的 anchor.hit（每单位受击定位点，归一化坐标）；
// 攻击方无配置（如猎犬）则该方向命中没有冲击层，只剩其攻击动画自带演出。
const UNIT_VISUALS = { hero: HERO_VISUALS.eigrem, enemy: MONSTER_VISUALS["blaze-hound"] };
function impactFxOf(side) {
  const t = currentTime.value;
  const impact = trackEvents(side).find((event) => event.kind === "impact" && t >= event.at && t < event.at + FX_DURATION);
  if (!impact) return null;
  const fx = UNIT_VISUALS[impact.owner].fx?.impact;
  if (!fx) return null;
  // impact 支持单对象或数组（多层叠放，如艾格雷姆 = 蓝火花+白冲击）；统一归一为层数组
  const layers = Array.isArray(fx) ? fx : [typeof fx === "string" ? { sprite: fx } : fx];
  return { layers, event: impact, anchor: UNIT_VISUALS[side].anchor?.hit ?? { x: 0.5, y: 0.7 } };
}
const heroImpactFx = computed(() => impactFxOf("hero"));
const enemyImpactFx = computed(() => impactFxOf("enemy"));

// 特效落点样式：锚点=受击方 anchor.hit（百分比，随视频框自适应），居中后叠 fx 配置的 dx/dy 偏移
function impactLayerStyle(fx) {
  const { x, y } = fx.anchor;
  return {
    left: `${x * 100}%`,
    top: `${y * 100}%`,
    transform: `translate(-50%, -50%) translate(${fx.dx || 0}px, ${-(fx.dy || 0)}px)`,
  };
}
const layerStyle = (anchor, fx) => impactLayerStyle({ ...fx, anchor });

function actionLabel(action) {
  return { idle: "待机", run: "奔跑", attack: "攻击", hit: "受击", death: "死亡" }[action];
}

function videoSrc(side, action) {
  const unit = side === "hero" ? "eigrem" : "blaze-hound";
  return `/assets-runtime/duelyst/units/${unit}/${action}.webm`;
}

function queueItems(side) {
  return trackEvents(side)
    .map((event) => `${event.at}ms · ${event.label}`);
}

onBeforeUnmount(stop);
onMounted(preloadAll);
</script>

<template>
  <div class="action-test">
    <header class="header">
      <div>
        <p class="eyebrow">PROTOTYPE · COMBAT REPLAY</p>
        <h2>战斗动作回放</h2>
        <p class="intro">慢速观察战斗事实如何变成动画，不写入编年史或存档。</p>
      </div>
      <div class="transport">
        <button class="primary" type="button" @click="play">{{ playing ? "暂停" : "播放" }}</button>
      </div>
    </header>

    <div class="scenario-tabs">
      <button v-for="(item, key) in scenarios" :key="key" type="button" :class="{ active: scenarioKey === key }" @click="chooseScenario(key)">
        {{ item.label }}
      </button>
    </div>

    <section class="replay">
      <div class="replay-top"><div><b>{{ scenario.label }}</b><span>{{ scenario.description }}</span></div><strong>{{ Math.round(currentTime) }} ms / {{ scenario.duration }} ms</strong></div>
      <div class="fighters">
        <div class="fighter">
          <div class="video-wrap">
            <video :key="`hero-${actionFor('hero')}`" :src="videoSrc('hero', actionFor('hero'))" autoplay muted :loop="actionFor('hero') === 'idle'" playsinline></video>
            <FxImpactSprite v-if="heroImpactFx && playing" v-for="(layer, i) in heroImpactFx?.layers ?? []" :key="`${heroImpactFx.event.at}-${i}`" class="fx-impact-layer" :sprite="layer.sprite" :style="layerStyle(heroImpactFx.anchor, layer)" />
          </div>
          <b>艾格雷姆</b><span>{{ actionLabel(actionFor("hero")) }}</span>
        </div>
        <i>对</i>
        <div class="fighter enemy">
          <div class="video-wrap">
            <video :key="`enemy-${actionFor('enemy')}`" :src="videoSrc('enemy', actionFor('enemy'))" autoplay muted :loop="actionFor('enemy') === 'idle'" playsinline></video>
            <FxImpactSprite v-if="enemyImpactFx && playing" v-for="(layer, i) in enemyImpactFx?.layers ?? []" :key="`${enemyImpactFx.event.at}-${i}`" class="fx-impact-layer" :sprite="layer.sprite" :style="layerStyle(enemyImpactFx.anchor, layer)" />
          </div>
          <b>余烬猎犬</b><span>{{ actionLabel(actionFor("enemy")) }}</span>
        </div>
      </div>
      <div class="current-event"><small>当前事件</small><b>{{ activeEvent.actor }} · {{ activeEvent.label }}</b></div>
    </section>

    <section class="timeline panel">
      <div class="panel-title"><h3>时间轴</h3><span>播放头会随回放移动</span></div>
      <div class="track event-track"><label>事件</label><div class="track-area"><span v-for="(event, i) in scenario.events" :key="`${event.label}-${i}`" class="segment event" :class="{ current: event === activeEvent }" :style="styleSegment(event)">{{ event.actor }} · {{ event.label }}</span></div></div>
      <div class="track"><label>英雄</label><div class="track-area"><span v-for="(event, i) in trackEvents('hero')" :key="`${event.label}-${i}`" class="segment hero-segment" :style="styleSegment(event)">{{ event.label }}</span></div></div>
      <div class="track"><label>敌人</label><div class="track-area"><span v-for="(event, i) in trackEvents('enemy')" :key="`${event.label}-${i}`" class="segment enemy-segment" :style="styleSegment(event)">{{ event.label }}</span></div></div>
      <div class="playhead" :style="{ left: `calc(92px + (100% - 92px) * ${progress / 100})` }"></div>
    </section>

    <div class="bottom-grid">
      <section class="panel log"><div class="panel-title"><h3>引擎事件</h3><span>事实，不受动画影响</span></div><ol><li v-for="(event, i) in scenario.events" :key="`${event.label}-log-${i}`" :class="{ current: event === activeEvent }"><time>{{ event.at }}ms</time><b>{{ event.actor }}</b><span>{{ event.label }}</span></li></ol></section>
      <section class="panel queue"><div class="panel-title"><h3>播放队列</h3><span>表现层</span></div><div class="queue-side"><b>英雄</b><span v-for="item in queueItems('hero')" :key="item">{{ item }}</span></div><div class="queue-side"><b>敌人</b><span v-for="item in queueItems('enemy')" :key="item">{{ item }}</span></div><p class="good">命中特效 = 攻击方的 fx.impact（猎犬未配置则该方向无冲击层）；受击动画仅受击方空闲时插入；攻击动画始终完整播放，互不覆盖。</p></section>
    </div>
  </div>
</template>

<style scoped>
.action-test { width: 100%; max-width: 980px; }
.header, .replay-top, .panel-title { display: flex; justify-content: space-between; align-items: end; gap: 16px; }
.header { margin-bottom: 18px; }.eyebrow { color: var(--ember); font-size: 10px; letter-spacing: 3px; margin-bottom: 6px; }h2 { color: var(--gold); font-size: 22px; letter-spacing: 5px; }.intro { color: var(--dim); font-size: 12px; margin-top: 8px; }
button { border: 1px solid var(--line); background: var(--ash-2); color: var(--text); font: inherit; cursor: pointer; }button:hover, button.active, button.primary { border-color: var(--ember); color: var(--ember); }
.transport, .scenario-tabs { display: flex; gap: 6px; flex-wrap: wrap; }.transport button, .scenario-tabs button { padding: 8px 11px; font-size: 11px; }.scenario-tabs { margin-bottom: 14px; }
.replay, .panel { border: 1px solid var(--line); background: var(--card-bg); box-shadow: var(--card-shadow); }.replay { padding: 16px; }.replay-top b { color: var(--paper); font-size: 13px; }.replay-top span { color: var(--dim); font-size: 11px; margin-left: 12px; }.replay-top strong { color: var(--ember); font-size: 11px; white-space: nowrap; }
.fighters { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 28px; max-width: 660px; margin: 18px auto 12px; }.fighter { position: relative; display: grid; grid-template-columns: 128px 1fr; grid-template-rows: 1fr 1fr; gap: 5px 12px; align-items: center; }.video-wrap { position: relative; grid-row: 1 / 3; }.video-wrap video { display: block; width: 128px; height: 128px; object-fit: contain; image-rendering: pixelated; background: var(--ash-2); border: 1px solid var(--line); }.fx-impact-layer { position: absolute; z-index: 2; }.fighter b { color: var(--paper); font-size: 13px; }.fighter span { color: var(--gold); font-size: 12px; }.fighter.enemy video { transform: scaleX(-1); }.fighters i { color: var(--dim); }.current-event { display: flex; justify-content: center; gap: 10px; border-top: 1px solid var(--line); padding-top: 10px; }.current-event small { color: var(--dim); }.current-event b { color: var(--gold); font-size: 12px; }
.panel { position: relative; padding: 14px; }.panel-title { align-items: baseline; margin-bottom: 12px; }.panel-title h3 { color: var(--ember); font-size: 12px; letter-spacing: 3px; }.panel-title span { color: var(--dim); font-size: 10px; }
.timeline { margin-top: 14px; overflow: hidden; }.track { display: grid; grid-template-columns: 78px 1fr; align-items: center; min-height: 38px; }.track label { color: var(--dim); font-size: 11px; }.track-area { position: relative; height: 27px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); background: repeating-linear-gradient(90deg, transparent 0, transparent calc(20% - 1px), rgba(154,138,122,.12) 20%); }.segment { position: absolute; top: 3px; height: 19px; overflow: hidden; padding: 3px 6px; border: 1px solid; border-radius: 2px; font-size: 9px; line-height: 11px; text-overflow: ellipsis; white-space: nowrap; }.event { border-color: var(--gold); color: var(--gold); background: rgba(201,162,39,.12); }.event.current { border-color: var(--ember); color: var(--ember); background: rgba(224,123,57,.2); }.hero-segment { border-color: #b86e43; color: #e6a06e; background: rgba(184,110,67,.18); }.enemy-segment { border-color: #738e61; color: #a8c38e; background: rgba(115,142,97,.18); }.playhead { position: absolute; top: 42px; bottom: 14px; width: 1px; background: var(--paper); box-shadow: 0 0 5px var(--paper); pointer-events: none; }
.bottom-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 14px; }.log ol { display: grid; gap: 5px; list-style: none; }.log li { display: grid; grid-template-columns: 50px 38px 1fr; gap: 7px; padding: 7px; color: var(--dim); font-size: 11px; border-left: 2px solid transparent; }.log li.current { color: var(--paper); border-left-color: var(--ember); background: rgba(224,123,57,.1); }.log time { color: var(--ember); }.log b { color: var(--gold); }.queue-side { display: grid; gap: 5px; margin-bottom: 12px; }.queue-side > b { color: var(--paper); font-size: 11px; }.queue-side span { padding: 6px 8px; border: 1px solid var(--line); color: var(--dim); font-size: 11px; }.queue p { font-size: 11px; line-height: 1.6; }.good { color: #8dbb76; }
@media (max-width: 700px) { .header, .replay-top { align-items: start; flex-direction: column; }.bottom-grid { grid-template-columns: 1fr; }.replay-top span { display: block; margin: 5px 0 0; }.fighters { gap: 8px; }.fighter { grid-template-columns: 78px 1fr; gap: 5px 7px; }.fighter video { width: 78px; height: 78px; }.track { grid-template-columns: 55px 1fr; }.playhead { top: 42px; } }
</style>
