<script setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import regionsData from "../data/regions.json";
import monstersData from "../data/monsters.json";
import { heroStats } from "../engine/hero.js";
import MonsterVisual from "./MonsterVisual.vue";
import HeroVisual from "./HeroVisual.vue";
import { actionTiming } from "../data/visuals.js";
import swordIcon from "./icons/sword.svg";

const props = defineProps({
  state: { type: Object, required: true },
});

const emit = defineEmits(["deploy", "stop", "challenge"]);

// 与 App.vue 同款图标注入（mask + currentColor，自动继承按钮火色）
function ico(url) {
  return { "--icon": `url("${url}")` };
}

const REGIONS = regionsData.regions;
const MONSTERS = monstersData.monsters;

const heroCommand = ref(null);
const monsterCommand = ref(null);
const heroFeedback = ref(null);
const monsterFeedback = ref(null);
const playbackQueues = new Map();
const activeUnits = new Set();
const pendingImpactTimers = new Set();
// 血条显示值（ADR-002 §2.2 事件流重放）：null = 未同步，回退 live state。
// 引擎在出手瞬间已扣血，显示层延迟到命中时刻（t + attackHitMs）才掉，避免"血条先于挥砍"。
const monsterHp = ref(null);
const heroHp = ref(null);
// 目标替换标记（boss-challenge 事件）：值 = 新怪（Boss）id。MonsterVisual 据此跳过
// 旧怪死亡动画（挑战 = 换目标非击杀）；spawn 事件（真实击杀换怪）到达即清除。
const challengeSwapId = ref(null);
// 血条跳变：挑战瞬间缓存清空 → 百分比直接跳满，禁用 width 过渡避免"从旧怪残血滑到满"
const hpJump = ref(null);
// backlog 阈值：事件落后模拟时钟超过该值（离线回补/后台切回）→ 整队清空直接对齐 live state
const BACKLOG_MS = 3000;

function commandRef(unitId) {
  return unitId === "hero" ? heroCommand : monsterCommand;
}

function playNext(unitId) {
  if (activeUnits.has(unitId)) return;
  const queue = playbackQueues.get(unitId);
  if (!queue?.length) return;
  activeUnits.add(unitId);
  commandRef(unitId).value = queue.shift();
}

function actionEnded(unitId) {
  activeUnits.delete(unitId);
  commandRef(unitId).value = null;
  playNext(unitId);
}

function scheduleImpact(callback, delay) {
  const timer = setTimeout(() => {
    pendingImpactTimers.delete(timer);
    callback();
  }, delay);
  pendingImpactTimers.add(timer);
}

function triggerFeedback(unitId, eventId) {
  const feedback = unitId === "hero" ? heroFeedback : monsterFeedback;
  feedback.value = { id: eventId };
  scheduleImpact(() => {
    feedback.value = null;
  }, 240);
}

function enqueue(unitId, action, eventId) {
  if (!unitId || !action) return;
  if (!playbackQueues.has(unitId)) playbackQueues.set(unitId, []);
  const queue = playbackQueues.get(unitId);
  // 同类动作合并：攻击动画时长 > 攻击间隔时事件会持续积压，视觉上保留最新一条即可
  if (queue.length > 0 && queue[queue.length - 1].action === action) return;
  queue.push({ id: `${eventId}:${unitId}:${action}`, action });
  playNext(unitId);
}

function syncToLive() {
  for (const timer of pendingImpactTimers) clearTimeout(timer);
  pendingImpactTimers.clear();
  activeUnits.clear();
  playbackQueues.clear();
  heroCommand.value = null;
  monsterCommand.value = null;
  heroFeedback.value = null;
  monsterFeedback.value = null;
  heroHp.value = null;
  monsterHp.value = null;
  // 挑战瞬间的跳变帧与替换标记一并作废（定时器被清时不能残留，否则血条过渡永久禁用）
  hpJump.value = null;
  challengeSwapId.value = null;
}

function displayHpOf(unitId) {
  if (unitId === "hero") {
    const max = hero.value ? heroStats(hero.value).maxHp : 0;
    const live = hero.value?.hp ?? max;
    return { display: heroHp.value, live, max };
  }
  const m = party.value?.monster;
  return { display: monsterHp.value, live: m?.hp ?? 0, max: m?.maxHp ?? 0 };
}

function setDisplayHp(unitId, hp) {
  if (unitId === "hero") heroHp.value = hp;
  else monsterHp.value = hp;
}

function consumeCombatEvents(events) {
  const simNow = props.state.meta.totalPlayMs ?? 0;
  // 事实序 FIFO（ADR-002 §2.2）：按 t 排序消费，显示顺序 = 事实提交顺序
  const list = [...(events ?? [])].sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
  if (!isRunning.value || list.some((e) => (e.t ?? simNow) < simNow - BACKLOG_MS)) {
    syncToLive(); // 停止 / 离线回补 backlog：整批丢弃，显示直接对齐 live state
    return;
  }
  let lastKillDelay = null; // 同批内致命一击的命中延迟（spawn 换模 / heal 与之同步）
  for (const event of list) {
    if (event.type === "boss-challenge") {
      // 挑战 Boss（#16 二批）：目标替换而非击杀——在途伤害/换模定时器与回放队列全部作废，
      // 血条显示缓存清空（回退 live = Boss 满血），MonsterVisual 跳过旧怪死亡动画。
      syncToLive();
      challengeSwapId.value = event.monster?.id ?? null;
      hpJump.value = event.id;
      scheduleImpact(() => {
        hpJump.value = null;
      }, 80);
      continue;
    }
    const actor = event.actorId === hero.value?.id ? "hero" : "monster";
    if (event.type === "spawn") {
      challengeSwapId.value = null; // 真实击杀换怪：替换标记失效，后续 id 变化恢复死亡演出
      scheduleImpact(() => {
        setDisplayHp("monster", event.monster?.hp ?? party.value?.monster?.hp ?? 0);
      }, lastKillDelay ?? 0);
      continue;
    }
    if (event.type === "heal") {
      scheduleImpact(() => {
        heroHp.value = event.hp;
      }, lastKillDelay ?? 0);
      continue;
    }
    if (event.type === "death") {
      enqueue(actor, "death", event.id);
      if (actor === "hero") heroHp.value = 0;
      continue;
    }
    if (event.type !== "attack") continue;
    enqueue(actor, "attack", event.id);
    for (const targetId of event.targetIds ?? []) {
      const target = targetId === hero.value?.id ? "hero" : "monster";
      const unit = actor === "hero" ? hero.value : party.value?.monster;
      // 命中时刻（ADR-002）：事件 t + 攻击方前摇，相对模拟时钟换算成真实延迟
      const hitDelay = Math.max(0, (event.t ?? simNow) + actionTiming(unit, "attack").attackHitMs - simNow);
      if (event.killed && target === "monster") lastKillDelay = hitDelay;
      if (event.result === "hit") {
        scheduleImpact(() => {
          setDisplayHp(target, event.targetHpAfter ?? displayHpOf(target).live);
          if (event.killed) return;
          if (activeUnits.has(target)) triggerFeedback(target, event.id);
          else enqueue(target, "hit", event.id);
        }, hitDelay);
      }
    }
  }
}

onBeforeUnmount(() => {
  for (const timer of pendingImpactTimers) clearTimeout(timer);
  pendingImpactTimers.clear();
  activeUnits.clear();
  playbackQueues.clear();
});

// 区域卡敌人信息（#5 拆分）：enemies 池 → 名称与血量/威力汇总区间；Boss 不混入普通敌池
function enemyInfo(r) {
  if (!r.enemies?.length) {
    return { names: ["迷雾怪物"], hp: r.monster?.hp ?? [0, 0], dmg: r.monster?.dmg ?? [0, 0] };
  }
  const defs = r.enemies.map((id) => MONSTERS[id]);
  return {
    names: defs.map((d) => d.name),
    hp: [Math.min(...defs.map((d) => d.hp[0])), Math.max(...defs.map((d) => d.hp[1]))],
    dmg: [Math.min(...defs.map((d) => d.dmg[0])), Math.max(...defs.map((d) => d.dmg[1]))],
  };
}

// Boss 卡数据（#5）：血量显示为定值——挑战走 fixed spawn 取 HP 上限（引擎同款）；威力保持区间
function bossInfo(r) {
  if (!r.boss) return null;
  const b = MONSTERS[r.boss.id];
  if (!b) return null;
  return { name: b.name, hp: b.hp[1], dmg: b.dmg };
}

// Boss 状态标签（#6）：击杀进度 = min(区累计击杀, 发现门槛)；发现后 sticky 标签；首杀完成再战
function bossProgress(r) {
  if (!r.boss) return null;
  const kills = props.state.regionKills?.[r.key] ?? 0;
  return {
    kills: Math.min(kills, r.boss.every),
    every: r.boss.every,
    spotted: bossSpotted(r),
    cleared: Boolean(props.state.bossKills?.[r.key]),
  };
}

const party = computed(() => props.state.parties[0] ?? null);
const hero = computed(() => props.state.heroes[0]);
const isRunning = computed(() => party.value?.status === "expedition");
const currentRegion = computed(() => {
  if (!isRunning.value || !party.value) return null;
  return REGIONS.find((r) => r.key === party.value.regionKey) ?? null;
});
// Boss 发现（#16 二批）：发现一次 = 永久可挑战（sticky）；正在打 Boss 时按钮隐藏
function bossSpotted(r) {
  return Boolean(r.boss && props.state.bossSpotted?.[r.key]);
}
function fightingBoss(r) {
  return Boolean(party.value?.monster && r.boss && party.value.monster.id === r.boss.id);
}
function challengeable(r) {
  if (!bossSpotted(r) || fightingBoss(r)) return false;
  if (isRunning.value) return party.value.regionKey === r.key;
  return locked(r) === null;
}

function locked(r) {
  if (!hero.value) return "无英雄";
  if (hero.value.level < r.unlock.heroLevel) return `英雄 Lv.${r.unlock.heroLevel}`;
  if (props.state.org.level < r.unlock.orgLevel) return `组织 Lv.${r.unlock.orgLevel}`;
  const gate = r.unlock.regionKey;
  if (gate && !props.state.unlocks?.[gate]) {
    const pre = REGIONS.find((x) => x.key === gate);
    return `先完成「${pre?.name ?? gate}」`;
  }
  // Boss 解锁链（#16）：上一区小 Boss 被击败过（bossKills 首杀登记）
  const bossGate = r.unlock.bossKey;
  if (bossGate && !props.state.bossKills?.[bossGate]) {
    const pre = REGIONS.find((x) => x.key === bossGate);
    return `先击败「${pre?.name ?? bossGate}」的 Boss`;
  }
  return null;
}

const monsterPct = computed(() => {
  const { display, live, max } = displayHpOf("monster");
  if (!max) return 0;
  const hp = display ?? live;
  return Math.max(0, Math.min(100, (hp / max) * 100));
});

const heroHpPct = computed(() => {
  if (!hero.value) return 0;
  const { display, live, max } = displayHpOf("hero");
  if (!max) return 0;
  return Math.max(0, Math.min(100, ((display ?? live) / max) * 100));
});

watch(() => props.state.combatEvents, consumeCombatEvents);
watch(
  () => party.value?.status,
  (status) => {
    if (status !== "expedition") syncToLive();
  },
);
</script>

<template>
  <div class="expedition">
    <div class="party-head">
      <h2>远征厅</h2>
      <div v-if="isRunning && currentRegion" class="running">
        <span class="pulse"></span>
        出征中 · {{ currentRegion.name }} → 击杀 {{ party.killCount }} · 金币 +{{ party.goldEarned }}
        <span v-if="fightingBoss(currentRegion)" class="boss-live-tag">
          <i class="icon" :style="ico(swordIcon)"></i>正在挑战 Boss
        </span>
        <button
          v-if="challengeable(currentRegion)"
          class="btn btn-boss"
          type="button"
          @click="emit('challenge', currentRegion.key)"
        >
          <i class="icon" :style="ico(swordIcon)"></i>挑战 Boss
        </button>
        <button class="btn btn-stop" type="button" @click="emit('stop')">停止</button>
      </div>
    </div>

    <p class="hint">从 0-1「初始」的第一战开始，穿过迷雾边缘向幽暗林地推进。</p>

    <div class="region-grid">
      <div v-for="r in REGIONS" :key="r.key" class="region-card" :class="{ locked: locked(r) }">
        <h3>{{ r.name }}</h3>
        <div class="row"><span>推荐等级</span><b>{{ r.levelRange[0] }}–{{ r.levelRange[1] }}</b></div>
        <div class="row"><span>敌人</span><b>{{ enemyInfo(r).names.join(" / ") }}</b></div>
        <div class="row"><span>怪物血量</span><b>{{ enemyInfo(r).hp[0] }}–{{ enemyInfo(r).hp[1] }}</b></div>
        <div class="row"><span>怪物威力</span><b>{{ enemyInfo(r).dmg[0] }}–{{ enemyInfo(r).dmg[1] }}</b></div>
        <div class="row"><span>击杀经验</span><b>{{ r.xp }}</b></div>
        <div class="row"><span>产出</span><b class="loot">{{ r.loot.join(" / ") }}</b></div>
        <template v-if="bossInfo(r)">
          <div class="row boss-row"><span>Boss</span><b>{{ bossInfo(r).name }}</b></div>
          <div class="row boss-row"><span>Boss 血量</span><b>{{ bossInfo(r).hp }}</b></div>
          <div class="row boss-row">
            <span>Boss 威力</span><b>{{ bossInfo(r).dmg[0] }}–{{ bossInfo(r).dmg[1] }}</b>
          </div>
          <div class="row boss-row">
            <span>Boss 动向</span>
            <b v-if="bossProgress(r).cleared">首杀完成 · 可再战</b>
            <b v-else-if="bossProgress(r).spotted">已发现 · 可挑战</b>
            <b v-else>击杀进度 {{ bossProgress(r).kills }} / {{ bossProgress(r).every }}</b>
          </div>
        </template>
        <div v-if="locked(r) === null" class="op">
          <button
            class="btn"
            type="button"
            :disabled="isRunning && party.regionKey === r.key"
            @click="emit('deploy', r.key)"
          >
            {{ isRunning && party.regionKey === r.key ? "出征中" : "出发" }}
          </button>
          <!-- 待命直达入口（#7 互斥）：出征中只保留顶部按钮，卡内按钮仅在未出征时出现 -->
          <button
            v-if="!isRunning && challengeable(r)"
            class="btn btn-boss"
            type="button"
            @click="emit('challenge', r.key)"
          >
            <i class="icon" :style="ico(swordIcon)"></i>挑战 Boss
          </button>
        </div>
        <p v-else class="lock-note">🔒 {{ locked(r) }}</p>
      </div>
    </div>

    <section class="battle-log" v-if="isRunning && currentRegion">
      <h4>战斗</h4>
      <div class="battle-stage">
        <div class="combatant">
          <div class="visual">
            <HeroVisual
              :hero="hero"
              :command="heroCommand"
              :feedback="heroFeedback"
              animated
              @action-ended="actionEnded('hero')"
            />
          </div>
        </div>
        <span class="vs">对</span>
        <div class="combatant" :class="{ boss: fightingBoss(currentRegion) }">
          <div class="visual">
            <MonsterVisual
              :monster="party.monster"
              :command="monsterCommand"
              :feedback="monsterFeedback"
              :swap-id="challengeSwapId"
              :boss="fightingBoss(currentRegion)"
              flip
              @action-ended="actionEnded('monster')"
            />
          </div>
        </div>
      </div>
      <div class="bars">
        <div class="bar">
          <span class="name">{{ hero.name }}</span>
          <div class="track"><div class="fill hero" :style="{ width: heroHpPct + '%' }"></div></div>
        </div>
        <div class="bar" :class="{ boss: fightingBoss(currentRegion) }">
          <span class="name">
            <i v-if="fightingBoss(currentRegion)" class="icon" :style="ico(swordIcon)"></i>{{ party.monster?.name ?? "迷雾怪物" }}
          </span>
          <div class="track">
            <div
              class="fill foe"
              :class="{ boss: fightingBoss(currentRegion), jump: hpJump !== null }"
              :style="{ width: monsterPct + '%' }"
            ></div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.expedition {
  max-width: 1040px;
  width: 100%;
}

.party-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--line);
}

.party-head h2 {
  font-size: 20px;
  color: var(--gold);
  letter-spacing: 5px;
}

.running {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  font-size: 12px;
  color: var(--ember);
  text-align: right;
}

.pulse {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ember);
  margin-right: 1px;
  animation: pulse 1.2s infinite;
}

@keyframes pulse {
  50% { opacity: 0.3; }
}

.hint {
  font-size: 12px;
  color: var(--dim);
  margin: 6px 0 16px;
}

.region-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.region-card {
  min-width: 0;
  min-height: 300px;
  display: flex;
  flex-direction: column;
  background: var(--card-bg);
  border: 1px solid var(--line);
  border-radius: 4px;
  box-shadow: var(--card-shadow);
  padding: 18px;
  transition: border-color 0.2s ease, transform 0.2s ease;
}

.region-card:not(.locked):hover {
  border-color: var(--ember-dim);
  transform: translateY(-2px);
}

.region-card.locked {
  opacity: 0.45;
}

.region-card h3 {
  font-size: 15px;
  color: var(--paper);
  letter-spacing: 2px;
  margin-bottom: 14px;
}

.row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  gap: 12px;
  padding: 4px 0;
  color: var(--dim);
}

.row b {
  color: var(--text);
  font-weight: normal;
  text-align: right;
  overflow-wrap: anywhere;
}

.row .loot {
  color: var(--gold);
}

.op {
  display: grid;
  gap: 8px;
  margin-top: auto;
  padding-top: 16px;
}

.btn {
  width: 100%;
  min-height: 36px;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 3px;
  background: linear-gradient(180deg, var(--ash-3), var(--ash-2));
  color: var(--text);
  font-family: inherit;
  letter-spacing: 2px;
  cursor: pointer;
}

.btn:hover:not(:disabled) {
  border-color: var(--ember);
  color: var(--ember);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-stop {
  width: auto;
  padding: 4px 14px;
  margin-left: 10px;
  letter-spacing: 2px;
  font-size: 12px;
}

.btn-boss {
  margin-left: 0;
  border-color: var(--ember);
  color: var(--ember);
}

.btn-boss:hover {
  filter: brightness(1.15);
}

.btn-boss .icon {
  width: 1em;
  height: 1em;
  margin-right: 6px;
  vertical-align: -0.1em;
}

.boss-live-tag .icon,
.bar .name .icon {
  width: 1em;
  height: 1em;
  margin-right: 5px;
  vertical-align: -0.12em;
}

.boss-live-tag {
  margin-left: 10px;
  padding: 4px 14px;
  border: 1px solid var(--ember);
  border-radius: 3px;
  color: var(--ember);
  letter-spacing: 2px;
  font-size: 12px;
  animation: boss-tag-pulse 1.6s infinite;
}

@keyframes boss-tag-pulse {
  50% { opacity: 0.55; }
}

.boss-row b {
  color: var(--ember);
}

.lock-note {
  margin-top: 10px;
  font-size: 12px;
  color: var(--dim);
}

.battle-log {
  margin-top: 20px;
  background: var(--card-bg);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 20px;
  box-shadow: var(--card-shadow);
}

.battle-log h4 {
  font-size: 13px;
  color: var(--ember);
  letter-spacing: 5px;
  margin-bottom: 12px;
}

.battle-stage {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 48px minmax(0, 1fr);
  gap: 16px;
  align-items: stretch;
  margin-bottom: 14px;
}

.combatant {
  min-width: 0;
  display: grid;
  place-items: center;
}

.combatant .visual {
  width: min(100%, 240px);
  aspect-ratio: 1;
  height: auto;
  margin: 0 auto;
}

.vs {
  align-self: center;
  color: var(--dim);
  font-size: 13px;
  letter-spacing: 3px;
}

.bars {
  display: grid;
  gap: 10px;
}

.bar {
  display: grid;
  grid-template-columns: 90px 1fr;
  align-items: center;
  gap: 12px;
}

.bar .name {
  font-size: 12px;
  color: var(--dim);
}

.track {
  height: 14px;
  border: 1px solid var(--line);
  border-radius: 3px;
  background: var(--ash-2);
  overflow: hidden;
}

.fill {
  height: 100%;
  transition: width 0.4s ease;
}

/* 挑战切换瞬间：血条百分比跳变（旧怪残血 → Boss 满血），跳变帧禁用过渡防滑条穿帮 */
.fill.jump {
  transition: none;
}

.fill.hero { background: linear-gradient(90deg, var(--ember-dim), var(--ember)); }
.fill.foe { background: linear-gradient(90deg, var(--ash-3), var(--gold)); }

/* Boss 战标识（#4/#10 轻量）：血条染火色 + 名字描边 */
.bar.boss .name {
  color: var(--ember);
}

.bar.boss .track {
  border-color: var(--ember);
}

.fill.foe.boss {
  background: linear-gradient(90deg, var(--ash-3), var(--ember));
}

@media (max-width: 900px) {
  .region-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .party-head {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }

  .running {
    justify-content: flex-start;
    text-align: left;
  }

  .region-grid {
    grid-template-columns: 1fr;
  }

  .region-card {
    min-height: 0;
  }

  .battle-log {
    padding: 14px;
  }

  .battle-stage {
    grid-template-columns: minmax(0, 1fr) 28px minmax(0, 1fr);
    gap: 6px;
  }

  .combatant .visual {
    width: 100%;
  }

  .bar {
    grid-template-columns: 72px minmax(0, 1fr);
    gap: 8px;
  }

  .bar .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
