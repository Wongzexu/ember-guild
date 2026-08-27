<script setup>
import { computed } from "vue";

const props = defineProps({
  state: { type: Object, required: true },
});

const onlineText = computed(() => {
  const s = Math.floor(props.state.meta.totalPlayMs / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
});
</script>

<template>
  <div class="org">
    <div class="orgline">
      <h1>余烬公会</h1>
      <span class="lvl">Lv.{{ state.org.level }}</span>
      <span class="badge">灰烬纪元 · 元年</span>
    </div>

    <div class="scroll">
      <div class="era">灰 烬 纪 元 · 元 年</div>
      <div class="text">
        {{ state.chronicle[0].text }}
      </div>
      <div class="sig">—— 编年史官 · 首记 · 在线 {{ onlineText }}</div>
    </div>

    <div class="placeholder activity">当前活动面板 —— 敬请期待</div>
  </div>
</template>

<style scoped>
.org {
  max-width: 720px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
}

.orgline {
  display: flex;
  gap: 24px;
  align-items: baseline;
}

.orgline h1 {
  font-size: 20px;
  color: var(--gold);
  letter-spacing: 5px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.lvl {
  color: var(--ember);
  font-size: 13px;
}

.scroll {
  width: 100%;
  background: var(--card-bg);
  border: 1px solid var(--line);
  border-radius: 4px;
  box-shadow: var(--card-shadow);
  padding: 40px 48px;
  position: relative;
}

.scroll::before,
.scroll::after {
  content: "";
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 220px;
  height: 14px;
  background: var(--rod-bg);
}

.scroll::before {
  top: -7px;
  border-radius: 4px;
}

.scroll::after {
  bottom: -7px;
  border-radius: 4px;
}

.era {
  text-align: center;
  font-size: 12px;
  color: var(--ember);
  letter-spacing: 6px;
  margin-bottom: 18px;
}

.text {
  font-size: 17px;
  line-height: 2.2;
  color: var(--paper);
  text-align: center;
}

.sig {
  margin-top: 24px;
  text-align: right;
  font-size: 12px;
  color: var(--dim);
  font-style: italic;
}

.activity {
  width: 100%;
  min-height: 80px;
}
</style>