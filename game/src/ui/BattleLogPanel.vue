<script setup>
// 战记 · 具体事件层：战斗事实流水（出手/击败/掉落/撤回），最新在上；只读，不参与存档里程碑
// 标题/计数/切换由 App 右栏标题行承担，这里只渲染列表本体
import { computed } from "vue";

const props = defineProps({
  state: { type: Object, required: true },
});

const entries = computed(() => [...(props.state.battleLog ?? [])].reverse());

function fmt(t) {
  const d = new Date(t);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
</script>

<template>
  <div class="blog">
    <div v-if="entries.length === 0" class="empty">
      尚无战斗记录。派出远征后，这里的墨迹会一笔一笔多起来。
    </div>
    <div v-else class="list">
      <div v-for="(e, i) in entries" :key="i" class="item">
        <span class="time">{{ fmt(e.t) }}</span>
        <span class="text">{{ e.text }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.blog {
  width: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.item {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--line);
}

.time {
  font-size: 10px;
  color: var(--dim);
  font-variant-numeric: tabular-nums;
}

.text {
  font-size: 12px;
  line-height: 1.7;
  color: var(--text);
}

.empty {
  font-size: 12px;
  color: var(--dim);
  border: 1px dashed var(--line);
  border-radius: 3px;
  padding: 20px 14px;
  text-align: center;
  line-height: 1.8;
}
</style>
