<script setup>
// 敌人表现组件（§1 原则：动画只响应状态变化，不参与战斗结算）
// 生命下降 → hit；生命归零/换怪 → death；敌出手（我方掉血）→ attack；其余 → idle。
// 资源缺失或加载失败 → 文字占位，战斗照常进行。
import { computed, ref, watch } from "vue";
import { monsterVisualOf } from "../data/visuals.js";

const props = defineProps({
  monster: { type: Object, default: null },
  command: { type: Object, default: null },
  feedback: { type: Object, default: null },
  // swapId：目标替换标记（boss-challenge 事件，值 = 新怪 id）。id 变化且匹配时不播旧怪
  // 死亡动画——挑战 Boss 是"换目标"，旧怪并未被击杀（spawn 换怪仍走死亡演出）。
  swapId: { type: null, default: null },
  // boss：Boss 战视觉标识（金色边框 + 首领徽章），仅表现，不参与战斗结算
  boss: { type: Boolean, default: false },
  // flip：水平镜像（官方素材默认朝右；战斗中敌人在右侧需面向左）
  flip: { type: Boolean, default: false },
});
const emit = defineEmits(["action-ended"]);

const mode = ref("idle");
const failed = ref(false);
const deathGhost = ref(null); // 死亡动画期间的旧怪快照（引擎同 tick 换怪，UI 用幽灵保留尸体演出）

const shown = computed(() => (mode.value === "death" && deathGhost.value) || props.monster);
const visual = computed(() => monsterVisualOf(shown.value));
const animation = computed(() => visual.value?.animations?.[mode.value] ?? null);

function play(next) {
  mode.value = next;
}

function finishAction() {
  if (mode.value === "death") deathGhost.value = null;
  if (mode.value !== "idle") {
    mode.value = "idle";
    emit("action-ended");
  }
}

let previousMonster = null;

watch(
  () => props.monster?.id,
  (id) => {
    const m = props.monster;
    if (!m) {
      previousMonster = null;
      return;
    }
    if (previousMonster && previousMonster.id !== id) {
      if (props.swapId && id === props.swapId) {
        // 目标替换（挑战 Boss）：作废旧怪死亡演出，新目标直接 idle 入场
        deathGhost.value = null;
        mode.value = "idle";
      } else {
        deathGhost.value = previousMonster; // 换怪 = 旧怪被击杀
        play("death");
      }
    }
    previousMonster = m;
  },
  { immediate: true },
);

watch(
  () => props.command?.id,
  () => {
    const action = props.command?.action;
    if (action) play(action);
    if (action && !animation.value) setTimeout(() => emit("action-ended"), 0);
  },
);
</script>

<template>
  <div class="monster-visual" :class="{ fallback: failed || !visual || !animation, impact: feedback, flip, boss }">
    <video
      v-if="visual && !failed && animation && shown"
      :key="`${animation}:${shown.id ?? ''}:${props.command?.id ?? ''}`"
      class="animation"
      :src="animation"
      autoplay
      muted
      :loop="mode === 'idle'"
      playsinline
      :aria-label="`${shown.name ?? '敌人'} ${mode} 动画`"
      @error="failed = true"
      @ended="finishAction"
    ></video>
    <span v-else class="fallback-text">{{ shown?.name ?? "迷雾怪物" }}</span>
    <div v-if="shown" class="plate">
      <span class="name">{{ shown.name ?? "迷雾怪物" }}</span>
      <span class="level">Lv.{{ shown.level ?? "?" }}</span>
      <span v-if="boss" class="tier">首领</span>
    </div>
  </div>
</template>

<style scoped>
.monster-visual {
  position: relative;
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  overflow: hidden;
  background:
    linear-gradient(135deg, rgba(224, 123, 57, 0.08) 25%, transparent 25%) 0 0 / 8px 8px,
    var(--ash-2);
  border: 2px solid var(--line);
  box-shadow: inset 0 0 0 2px var(--ink);
}

.monster-visual.flip .animation {
  transform: scaleX(-1);
}

.animation {
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
}

.fallback-text {
  color: var(--gold);
  font-size: 14px;
}

.impact {
  animation: impact-flash 0.24s ease-out;
}

@keyframes impact-flash {
  25% { filter: brightness(1.8) saturate(0.55); transform: translateX(-2px); }
  55% { transform: translateX(2px); }
}

.plate {
  position: absolute;
  left: 8px;
  bottom: 8px;
  display: flex;
  gap: 8px;
  align-items: baseline;
  font-size: 12px;
  color: var(--text);
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid var(--line);
  border-radius: 3px;
  padding: 3px 8px;
}

.plate .name {
  color: var(--gold);
  letter-spacing: 2px;
}

.plate .level {
  color: var(--dim);
}

/* Boss 战视觉标识（#10 轻量）：火色边框 + 光晕 + 名牌首领徽章 */
.monster-visual.boss {
  border-color: var(--ember);
  box-shadow: inset 0 0 0 2px var(--ink), 0 0 16px rgba(224, 123, 57, 0.3);
}

.monster-visual.boss .plate {
  border-color: var(--ember);
}

.plate .tier {
  color: var(--ember);
  font-size: 10px;
  letter-spacing: 1px;
  border: 1px solid var(--ember);
  border-radius: 2px;
  padding: 0 4px;
}
</style>
