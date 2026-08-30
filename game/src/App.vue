<script setup>
import { computed, ref } from "vue";
import OrgPanel from "./ui/OrgPanel.vue";
import HeroListPanel from "./ui/HeroListPanel.vue";
import HeroDetailPanel from "./ui/HeroDetailPanel.vue";
import ExpeditionPanel from "./ui/ExpeditionPanel.vue";
import { createParty, startExpedition, stopExpedition } from "./engine/expedition.js";
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
const heroId = ref(null);

function selectHero(id) {
  heroId.value = id;
  view.value = "hero";
}

function backToHeroes() {
  view.value = "heroes";
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

function stop() {
  const s = props.state;
  if (!s.parties[0]) return;
  s.parties = [stopExpedition(s.parties[0])];
}

function ico(url) {
  return { "--icon": `url("${url}")` };
}
</script>

<template>
  <div class="shell">
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
      <OrgPanel v-if="view === 'chronicle'" :state="state" @open-hero="view = 'heroes'" @open-expedition="view = 'expedition'" />
      <HeroListPanel v-else-if="view === 'heroes'" :state="state" @select="selectHero" />
      <HeroDetailPanel v-else-if="view === 'hero'" :hero="activeHero" @back="backToHeroes" />
      <ExpeditionPanel
        v-else
        :state="state"
        @deploy="deploy"
        @stop="stop"
      />
    </main>

    <aside class="rail">
      <div class="rail-title">
        <i class="icon" :style="ico(documentIcon)"></i>
        编年史时间线
      </div>
      <div
        v-for="(entry, i) in state.chronicle"
        :key="i"
        class="timeline-item"
        :class="{ cur: i === state.chronicle.length - 1 }"
      >
        {{ entry.text }}
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
        <div class="placeholder"><i class="icon" :style="ico(backpackIcon)"></i> 背包</div>
        <div class="placeholder"><i class="icon" :style="ico(hammerIcon)"></i> 铸造台</div>
        <div class="placeholder"><i class="icon" :style="ico(bookIcon)"></i> 图鉴</div>
      </div>
    </aside>
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

.topbar {
  grid-area: top;
  display: flex;
  align-items: center;
  gap: 22px;
  background: var(--topbar-bg);
  border-bottom: 1px solid var(--line);
  padding: 0 24px;
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

.main {
  grid-area: main;
  padding: 32px 40px;
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

.rail-title {
  font-size: 13px;
  color: var(--ember);
  letter-spacing: 4px;
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
</style>
