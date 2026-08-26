<script setup>
import OrgPanel from "./ui/OrgPanel.vue";

defineProps({
  state: { type: Object, required: true },
});
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <span class="org-name">
        <i class="icon" style="--icon: url('./ui/icons/fire.svg')"></i>
        余烬公会
      </span>
      <span class="stat">
        <i class="icon" style="--icon: url('./ui/icons/tower.svg')"></i>
        等级 <b>{{ state.org.level }}</b>
      </span>
      <span class="stat">
        <i class="icon" style="--icon: url('./ui/icons/trophy.svg')"></i>
        传奇度 <b>{{ state.org.legend }}</b>
      </span>
      <span class="stat">
        <i class="icon" style="--icon: url('./ui/icons/coin.svg')"></i>
        金币 <b>{{ state.org.gold }}</b>
      </span>
    </header>

    <main class="main">
      <OrgPanel :state="state" />
    </main>

    <aside class="rail">
      <div class="rail-title">
        <i class="icon" style="--icon: url('./ui/icons/document.svg')"></i>
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
        <i class="icon" style="--icon: url('./ui/icons/warrior-helmet-lv1.svg')"></i>
        英雄
      </div>
      <div class="placeholder" style="min-height: 60px">
        <i class="icon" style="--icon: url('./ui/icons/compass.svg')"></i>
        远征
      </div>
      <div class="placeholder" style="min-height: 60px">
        <i class="icon" style="--icon: url('./ui/icons/backpack.svg')"></i>
        背包
      </div>
      <div class="placeholder" style="min-height: 60px">
        <i class="icon" style="--icon: url('./ui/icons/hammer.svg')"></i>
        铸造台
      </div>
      <div class="placeholder" style="min-height: 60px">
        <i class="icon" style="--icon: url('./ui/icons/book.svg')"></i>
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
  background: radial-gradient(ellipse at 30% 20%, #2b2118 0%, var(--ink) 60%);
}

.topbar {
  grid-area: top;
  display: flex;
  align-items: center;
  gap: 22px;
  background: rgba(23, 18, 13, 0.85);
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
  background: rgba(42, 35, 32, 0.6);
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