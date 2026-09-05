<script setup>
import { computed } from "vue";
import { heroStats } from "../engine/hero.js";
import HeroVisual from "./HeroVisual.vue";

const props = defineProps({
  state: { type: Object, required: true },
});

const emit = defineEmits(["select"]);

const runningParty = computed(() =>
  props.state.parties.find((p) => p.status === "expedition"),
);

function statusOf(hero) {
  if (runningParty.value?.heroIds.includes(hero.id)) {
    return { label: "出征中", cls: "out" };
  }
  return { label: "待命", cls: "idle" };
}
</script>

<template>
  <div class="hero-list">
    <div class="list-head">
      <h2>英雄名册</h2>
      <p class="list-hint">点卡片查看详情；组队出征在远征厅。</p>
    </div>

    <div class="cards">
      <button
        v-for="h in state.heroes"
        :key="h.id"
        class="card"
        type="button"
        @click="emit('select', h.id)"
      >
        <div class="card-top">
          <div class="avatar">
            <HeroVisual :hero="h" />
          </div>
          <div class="title">
            <h3>{{ h.name }}</h3>
            <span class="sub">职业 · {{ h.title }}（纯力近战）</span>
          </div>
        </div>
        <div class="card-mid">
          <span class="tag">Lv.{{ h.level }}</span>
          <span class="tag">铁砧</span>
          <span class="status" :class="statusOf(h).cls">{{ statusOf(h).label }}</span>
        </div>
        <blockquote class="q">「{{ h.quotes[1] }}」</blockquote>
        <div class="card-foot">
          <span>武器 · 铜锤</span>
          <button class="more" type="button" tabindex="-1">详情 →</button>
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.hero-list {
  max-width: 760px;
  width: 100%;
}

.list-head h2 {
  font-size: 20px;
  color: var(--gold);
  letter-spacing: 5px;
}

.list-hint {
  font-size: 12px;
  color: var(--dim);
  margin: 6px 0 18px;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.card {
  text-align: left;
  font-family: inherit;
  color: inherit;
  background: var(--card-bg);
  border: 1px solid var(--line);
  border-radius: 4px;
  box-shadow: var(--card-shadow);
  padding: 18px 20px;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.card:hover {
  border-color: var(--ember);
}

.card-top {
  display: flex;
  gap: 14px;
  align-items: center;
}

.avatar {
  width: 56px;
  height: 56px;
  border-radius: 2px;
  border: 1px solid var(--line);
  background: var(--ash-2);
  display: grid;
  place-items: center;
  font-size: 30px;
  color: var(--ember);
  box-shadow: var(--ui-shadow);
}

.title h3 {
  font-size: 17px;
  color: var(--paper);
  letter-spacing: 2px;
}

.title .sub {
  font-size: 12px;
  color: var(--dim);
}

.card-mid {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: 12px;
}

.tag {
  font-size: 11px;
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: 3px;
  padding: 2px 8px;
  background: var(--rail-bg);
}

.status {
  margin-left: auto;
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 3px;
}

.status.idle { color: var(--dim); border: 1px dashed var(--line); }
.status.out { color: var(--ember); border: 1px solid var(--ember); }

.q {
  margin-top: 12px;
  color: var(--ember);
  font-size: 13px;
  font-style: italic;
  min-height: 20px;
}

.card-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 14px;
  border-top: 1px dashed var(--line);
  padding-top: 10px;
  font-size: 12px;
  color: var(--dim);
}

.more {
  border: none;
  background: none;
  font-family: inherit;
  font-size: 12px;
  color: var(--gold);
  letter-spacing: 2px;
  cursor: pointer;
}
</style>
