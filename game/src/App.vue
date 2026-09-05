<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import OrgPanel from "./ui/OrgPanel.vue";
import HeroListPanel from "./ui/HeroListPanel.vue";
import HeroDetailPanel from "./ui/HeroDetailPanel.vue";
import ExpeditionPanel from "./ui/ExpeditionPanel.vue";
import ProloguePanel from "./ui/ProloguePanel.vue";
import InventoryPanel from "./ui/InventoryPanel.vue";
import BattleLogPanel from "./ui/BattleLogPanel.vue";
import AssetGalleryPanel from "./ui/AssetGalleryPanel.vue";
import EquipPanelProto from "./ui/proto/EquipPanelProto.vue";
import ActionTestPanel from "./ui/ActionTestPanel.vue";
import AssetTimingPanel from "./ui/AssetTimingPanel.vue";
import { createParty, startExpedition, stopExpedition, challengeBoss } from "./engine/expedition.js";
import { equipItem, unequipItem } from "./engine/equipment.js";
import { SAVE_KEY } from "./engine/save.js";
import regionsData from "./data/regions.json";
import monstersData from "./data/monsters.json";
import backpackIcon from "./ui/icons/backpack.svg";
import bookIcon from "./ui/icons/book.svg";
import coinIcon from "./ui/icons/coin.svg";
import compassIcon from "./ui/icons/compass.svg";
import documentIcon from "./ui/icons/document.svg";
import flagIcon from "./ui/icons/flag.svg";
import fireIcon from "./ui/icons/fire.svg";
import hammerIcon from "./ui/icons/hammer.svg";
import towerIcon from "./ui/icons/tower.svg";
import trophyIcon from "./ui/icons/trophy.svg";
import helmetIcon from "./ui/icons/warrior-helmet-lv1.svg";
import sunIcon from "./ui/icons/sun.svg";
import moonIcon from "./ui/icons/moon.svg";
import swordIcon from "./ui/icons/sword.svg";
import playIcon from "./ui/icons/play.svg";

const THEME_KEY = "ardora_theme_v1";

const props = defineProps({
  state: { type: Object, required: true },
});

const theme = ref(
  document.documentElement.dataset.theme === "light" ? "light" : "dark",
);
const isDark = computed(() => theme.value === "dark");
const modeLabel = computed(() => (isDark.value ? "光明模式" : "暗黑模式"));
const modeIcon = computed(() => (isDark.value ? sunIcon : moonIcon));

const view = ref("chronicle");
// 战记内嵌右栏：与编年史时间线互斥切换，独立于 view，开关不影响主区
const showBattleLog = ref(false);
// 新手引导：未完成序章 → 强制序章页（M1 老档迁移后 onboarding.completed=true 不受影响）
const onboarding = computed(() => props.state.onboarding ?? { step: "completed", completed: true });
const showPrologue = computed(() => !onboarding.value.completed);
const heroId = ref(null);
const inventoryHeroId = ref(null);
const inventoryTab = ref("equip");
const equipProto = new URLSearchParams(location.search).get("equipproto") === "1";

function selectHero(id) {
  heroId.value = id;
  view.value = "hero";
}

function backToHeroes() {
  view.value = "heroes";
}

function openInventory(id, tab = "equip") {
  inventoryHeroId.value = id ?? props.state.heroes[0]?.id ?? null;
  inventoryTab.value = tab;
  view.value = "inventory";
}

// 穿脱：引擎纯函数（B 层叠）→ 结果赋回 reactive 快照（与 deploy/stop 同法）
function onEquip({ heroId: hid, instanceId }) {
  Object.assign(props.state, equipItem(props.state, hid, instanceId));
}

function onUnequip({ heroId: hid, slot }) {
  Object.assign(props.state, unequipItem(props.state, hid, slot));
}

const activeHero = computed(() => props.state.heroes.find((h) => h.id === heroId.value) ?? null);

function toggleTheme() {
  const next = isDark.value ? "light" : "dark";
  theme.value = next;
  document.documentElement.dataset.theme = next;
  localStorage.setItem(THEME_KEY, next);
}

function deploy(regionKey) {
  const s = props.state;
  const p = s.parties[0] ?? createParty("eigrem", regionKey);
  s.parties = [startExpedition({ ...p, regionKey, monster: null })];
}

// 序章「加入战斗」收口：完成引导 → 写编年史 → 建 0-1 队并出征 → 打开远征页
function joinBattle() {
  const s = props.state;
  s.onboarding = { step: "completed", completed: true };
  s.chronicle = [
    ...s.chronicle,
    { t: Date.now(), text: "雾墙之前，艾格雷姆提起铜锤，迈出了第一步。", legend: 0 },
  ];
  deploy("tutorial-0-1");
  view.value = "expedition";
}

function stop() {
  const s = props.state;
  if (!s.parties[0]) return;
  s.parties = [stopExpedition(s.parties[0])];
}

// Boss 挑战（#16 二批）：引擎纯函数返回全量 state（出征中=换怪 / 待命=直接开战），赋回快照
function challenge(regionKey) {
  Object.assign(props.state, challengeBoss(props.state, regionKey));
}

// 编年史时间线：区域限高 200px，新文案追加在底部、旧文案向上推，视图自动滚到最新
// 战记/时间线切换也触发回滚：display:none 期间浏览器会丢 scrollTop，切回需重新钉底
const timelineEl = ref(null);
watch(
  [() => props.state.chronicle.length, showBattleLog],
  async () => {
    if (showBattleLog.value) return;
    await nextTick();
    timelineEl.value?.scrollTo({ top: timelineEl.value.scrollHeight });
  },
);

// Boss 发现 Toast（#16 二批补课）：发现是事件性瞬间（bossSpotted sticky、重载不重放），
// 战记 fact 玩家看不到 → 用状态 diff 驱动全局提示；挂载首帧的存量发现不重播。
const bossToast = ref(null);
let bossToastTimer = null;
watch(
  () => props.state.bossSpotted,
  (now, prev) => {
    if (!prev) return; // 首次触发前的基线不算"新发现"
    for (const key of Object.keys(now ?? {})) {
      if (now[key] && !prev[key]) {
        const region = regionsData.regions.find((r) => r.key === key);
        bossToast.value = {
          region: region?.name ?? key,
          boss: region?.boss ? (monstersData.monsters[region.boss.id]?.name ?? "未知存在") : "未知存在",
        };
        if (bossToastTimer) clearTimeout(bossToastTimer);
        bossToastTimer = setTimeout(() => {
          bossToast.value = null;
          bossToastTimer = null;
        }, 6000);
        break; // M2 单队单区：同批至多一个新发现
      }
    }
  },
);

function dismissBossToast() {
  bossToast.value = null;
  if (bossToastTimer) {
    clearTimeout(bossToastTimer);
    bossToastTimer = null;
  }
  view.value = "expedition";
}

onBeforeUnmount(() => {
  if (bossToastTimer) clearTimeout(bossToastTimer);
});

// 一键清档：抹掉存档并整页重载（重载前 main.js 依据 discard 标志跳过 beforeunload 回写）
function clearSave() {
  if (!window.confirm("确定清档？将删除全部进度并从序章重新开始。")) return;
  sessionStorage.setItem("ardora_discard_save", "1");
  localStorage.removeItem(SAVE_KEY);
  location.reload();
}

function ico(url) {
  return { "--icon": `url("${url}")` };
}
</script>

<template>
  <div class="shell" :class="{ 'no-rail': showPrologue }">
    <header class="topbar">
      <span class="org-name">
        <i class="icon" :style="ico(fireIcon)"></i>
        余烬公会
      </span>
      <span class="stat">
        <i class="icon" :style="ico(towerIcon)"></i>
        等级 <b>{{ state.org.level }}</b>
      </span>
      <span class="stat">
        <i class="icon" :style="ico(trophyIcon)"></i>
        传奇度 <b>{{ state.org.legend }}</b>
      </span>
      <span class="stat">
        <i class="icon" :style="ico(coinIcon)"></i>
        金币 <b>{{ state.org.gold }}</b>
      </span>
      <button class="theme-btn" type="button" @click="toggleTheme">
        <i class="icon" :style="ico(modeIcon)"></i>
        {{ modeLabel }}
      </button>
    </header>

    <main class="main">
      <ProloguePanel v-if="showPrologue" :state="state" @complete="joinBattle" />
      <OrgPanel v-else-if="view === 'chronicle'" :state="state" @open-hero="view = 'heroes'" @open-expedition="view = 'expedition'" />
      <HeroListPanel v-else-if="view === 'heroes'" :state="state" @select="selectHero" />
      <EquipPanelProto v-else-if="view === 'hero' && equipProto" />
      <HeroDetailPanel
        v-else-if="view === 'hero'"
        :hero="activeHero"
        :state="state"
        @back="backToHeroes"
        @open-inventory="openInventory"
      />
      <InventoryPanel
        v-else-if="view === 'inventory'"
        :state="state"
        :hero-id="inventoryHeroId"
        :initial-tab="inventoryTab"
        @equip="onEquip"
        @unequip="onUnequip"
      />
      <AssetGalleryPanel v-else-if="view === 'assets'" />
      <ActionTestPanel v-else-if="view === 'action-test'" />
      <AssetTimingPanel v-else-if="view === 'asset-timing'" />
      <ExpeditionPanel
        v-else
        :state="state"
        @deploy="deploy"
        @stop="stop"
        @challenge="challenge"
      />
    </main>

    <aside v-if="!showPrologue" class="rail">
      <div class="rail-title-row">
        <div class="rail-title">
          <i class="icon" :style="ico(documentIcon)"></i>
          {{ showBattleLog ? `战记 · ${state.battleLog?.length ?? 0} 条` : "编年史时间线" }}
        </div>
        <button
          class="battlelog-link"
          type="button"
          :title="showBattleLog ? '返回编年史时间线' : '战斗流水：出手/击败/掉落/撤回'"
          @click="showBattleLog = !showBattleLog"
        >
          {{ showBattleLog ? "« 时间线" : "战记 »" }}
        </button>
      </div>
      <BattleLogPanel v-if="showBattleLog" class="rail-feed" :state="state" />
      <div v-show="!showBattleLog" ref="timelineEl" class="timeline">
        <div
          v-for="(entry, i) in state.chronicle"
          :key="i"
          class="timeline-item"
          :class="{ cur: i === state.chronicle.length - 1 }"
        >
          {{ entry.text }}
        </div>
      </div>
      <div class="nav">
        <button
          class="nav-btn"
          :class="{ active: view === 'chronicle' }"
          type="button"
          @click="view = 'chronicle'"
        >
          <i class="icon" :style="ico(flagIcon)"></i> 组织
        </button>
        <button
          class="nav-btn"
          :class="{ active: view === 'heroes' || view === 'hero' }"
          type="button"
          @click="view = 'heroes'"
        >
          <i class="icon" :style="ico(helmetIcon)"></i> 英雄
        </button>
        <button
          class="nav-btn"
          :class="{ active: view === 'expedition' }"
          type="button"
          @click="view = 'expedition'"
        >
          <i class="icon" :style="ico(compassIcon)"></i> 远征
        </button>
        <button
          class="nav-btn"
          :class="{ active: view === 'inventory' }"
          type="button"
          @click="openInventory(null)"
        >
          <i class="icon" :style="ico(backpackIcon)"></i> 背包
        </button>
        <button
          class="nav-btn"
          :class="{ active: view === 'assets' }"
          type="button"
          @click="view = 'assets'"
        >
          <i class="icon" :style="ico(documentIcon)"></i> 素材库
        </button>
        <button
          class="nav-btn"
          :class="{ active: view === 'action-test' }"
          type="button"
          @click="view = 'action-test'"
        >
          <i class="icon" :style="ico(playIcon)"></i> 动作测试
        </button>
        <button
          class="nav-btn"
          :class="{ active: view === 'asset-timing' }"
          type="button"
          @click="view = 'asset-timing'"
        >
          <i class="icon" :style="ico(hammerIcon)"></i> 素材精调
        </button>
        <div class="placeholder"><i class="icon" :style="ico(hammerIcon)"></i> 铸造台</div>
        <div class="placeholder"><i class="icon" :style="ico(bookIcon)"></i> 图鉴</div>
        <button class="clear-btn" type="button" @click="clearSave">一键清档</button>
      </div>
    </aside>

    <button v-if="bossToast" class="boss-toast" type="button" @click="dismissBossToast">
      <span class="boss-toast-title"><i class="icon" :style="ico(swordIcon)"></i>已发现 Boss</span>
      <span class="boss-toast-body">{{ bossToast.boss }} 在「{{ bossToast.region }}」现身——可随时发起 Boss 战</span>
      <span class="boss-toast-hint">点击前往远征厅</span>
    </button>
  </div>
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-rows: 48px 1fr;
  grid-template-columns: 1fr 260px;
  grid-template-areas: "top top" "main right";
  height: 100vh;
  background: radial-gradient(ellipse at 30% 20%, var(--bg-glow) 0%, var(--ink) 60%);
}

.shell.no-rail {
  grid-template-columns: 1fr;
  grid-template-areas: "top" "main";
}

.topbar {
  grid-area: top;
  display: flex;
  align-items: center;
  gap: 28px;
  background: var(--topbar-bg);
  border-bottom: 1px solid var(--line);
  padding: 0 clamp(20px, 3vw, 42px);
}

.org-name {
  font-size: 15px;
  color: var(--gold);
  letter-spacing: 4px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.org-name .icon {
  color: var(--ember);
  width: 20px;
  height: 20px;
  vertical-align: -0.28em;
}

.stat {
  color: var(--dim);
  font-size: 13px;
}

.stat b {
  color: var(--text);
}

.theme-btn {
  margin-left: auto;
  background: none;
  border: 1px solid var(--line);
  border-radius: 3px;
  color: var(--text);
  font-size: 12px;
  font-family: inherit;
  padding: 4px 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.theme-btn:hover {
  border-color: var(--ember);
}

/* Boss 发现 Toast（#16 二批）：全局层——挂机发现时玩家可能在任意 view */
.boss-toast {
  position: fixed;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 60;
  display: grid;
  gap: 3px;
  justify-items: center;
  padding: 10px 24px;
  background: var(--card-bg);
  border: 1px solid var(--ember);
  border-radius: 4px;
  box-shadow: 0 0 24px rgba(224, 123, 57, 0.35);
  cursor: pointer;
  font-family: inherit;
  text-align: center;
  /* 纯 CSS 入场（无 JS 钩子）：出现即完整可点，移除瞬时，不依赖 transitionend */
  animation: toast-in 0.25s ease;
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-8px);
  }
}

.boss-toast-title {
  color: var(--ember);
  font-size: 13px;
  letter-spacing: 3px;
}

.boss-toast-title .icon {
  width: 1em;
  height: 1em;
  margin-right: 5px;
  vertical-align: -0.12em;
}

.boss-toast-body {
  color: var(--text);
  font-size: 12px;
}

.boss-toast-hint {
  color: var(--dim);
  font-size: 10px;
}

.main {
  grid-area: main;
  min-width: 0;
  padding: clamp(24px, 4vw, 48px) clamp(20px, 4vw, 64px);
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow-y: auto;
}

.rail {
  grid-area: right;
  background: var(--rail-bg);
  border-left: 1px solid var(--line);
  padding: 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}

.rail-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.rail-title {
  font-size: 13px;
  color: var(--ember);
  letter-spacing: 4px;
}

.battlelog-link {
  background: none;
  border: none;
  font-family: inherit;
  font-size: 11px;
  letter-spacing: 1px;
  color: var(--dim);
  cursor: pointer;
  padding: 2px 4px;
}

.battlelog-link:hover {
  color: var(--ember);
}

.timeline {
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.timeline-item {
  font-size: 12px;
  color: var(--dim);
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 3px;
  line-height: 1.7;
}

.timeline-item.cur {
  border-color: var(--line);
  background: var(--card-bg);
  color: var(--text);
}

.nav {
  margin-top: 8px;
  display: grid;
  gap: 8px;
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-family: inherit;
  letter-spacing: 2px;
  color: var(--text);
  background: linear-gradient(180deg, var(--ash-3), var(--ash-2));
  border: 1px solid var(--line);
  border-radius: 3px;
  padding: 10px 12px;
  cursor: pointer;
  text-align: left;
}

.nav-btn:hover,
.nav-btn.active {
  border-color: var(--ember);
  color: var(--ember);
}

.nav-btn .icon {
  width: 16px;
  height: 16px;
}

.placeholder {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  letter-spacing: 2px;
  color: var(--dim);
  border: 1px dashed var(--line);
  border-radius: 3px;
  padding: 10px 12px;
}

.clear-btn {
  margin-top: auto;
  background: none;
  border: 1px solid var(--line);
  border-radius: 3px;
  color: var(--dim);
  font-family: inherit;
  font-size: 12px;
  letter-spacing: 2px;
  padding: 8px 12px;
  cursor: pointer;
}

.clear-btn:hover {
  border-color: var(--ember);
  color: var(--ember);
}

/* 战记内嵌右栏：替代时间线位置的滚动列表，高度对齐时间线量级 */
.rail-feed {
  max-height: 280px;
}

</style>
