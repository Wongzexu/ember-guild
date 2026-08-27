<script setup>
import { computed, ref } from "vue";
import OrgPanel from "./ui/OrgPanel.vue";
import backpackIcon from "./ui/icons/backpack.svg";
import bookIcon from "./ui/icons/book.svg";
import coinIcon from "./ui/icons/coin.svg";
import compassIcon from "./ui/icons/compass.svg";
import documentIcon from "./ui/icons/document.svg";
import fireIcon from "./ui/icons/fire.svg";
import hammerIcon from "./ui/icons/hammer.svg";
import towerIcon from "./ui/icons/tower.svg";
import trophyIcon from "./ui/icons/trophy.svg";
import helmetIcon from "./ui/icons/warrior-helmet-lv1.svg";
import sunIcon from "./ui/icons/sun.svg";
import moonIcon from "./ui/icons/moon.svg";

const THEME_KEY = "ardora_theme_v1";

defineProps({
  state: { type: Object, required: true },
});

const theme = ref(
  document.documentElement.dataset.theme === "light" ? "light" : "dark",
);
const isDark = computed(() => theme.value === "dark");
const modeLabel = computed(() => (isDark.value ? "光明模式" : "暗黑模式"));
const modeIcon = computed(() => (isDark.value ? sunIcon : moonIcon));

function toggleTheme() {
  const next = isDark.value ? "light" : "dark";
  theme.value = next;
  document.documentElement.dataset.theme = next;
  localStorage.setItem(THEME_KEY, next);
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
      <OrgPanel :state="state" />
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
      <div class="placeholder" style="min-height: 60px">
        <i class="icon" :style="ico(helmetIcon)"></i>
        英雄
      </div>
      <div class="placeholder" style="min-height: 60px">
        <i class="icon" :style="ico(compassIcon)"></i>
        远征
      </div>
      <div class="placeholder" style="min-height: 60px">
        <i class="icon" :style="ico(backpackIcon)"></i>
        背包
      </div>
      <div class="placeholder" style="min-height: 60px">
        <i class="icon" :style="ico(hammerIcon)"></i>
        铸造台
      </div>
      <div class="placeholder" style="min-height: 60px">
        <i class="icon" :style="ico(bookIcon)"></i>
        图鉴
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
  font-size: 18px;
}

.stat {
  font-size: 12px;
  color: var(--dim);
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.stat .icon {
  font-size: 15px;
  color: var(--gold);
}

.stat b {
  color: var(--paper);
  font-weight: 600;
}

.theme-btn {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--dim);
  font-family: inherit;
  font-size: 12px;
  letter-spacing: 2px;
  padding: 4px 14px;
  cursor: pointer;
}

.theme-btn:hover {
  color: var(--ember);
  border-color: var(--ember);
}

.theme-btn .icon {
  font-size: 14px;
}

.main {
  grid-area: main;
  padding: 40px 60px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.rail {
  grid-area: right;
  border-left: 1px solid var(--line);
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--rail-bg);
  overflow-y: auto;
}

.rail-title {
  font-size: 12px;
  color: var(--ember);
  letter-spacing: 3px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.rail-title .icon {
  font-size: 15px;
}

.timeline-item {
  font-size: 12px;
  color: var(--dim);
  padding-left: 12px;
  border-left: 2px solid var(--line);
  padding-bottom: 12px;
  line-height: 1.7;
}

.timeline-item.cur {
  color: var(--paper);
  border-left-color: var(--ember);
}
</style>