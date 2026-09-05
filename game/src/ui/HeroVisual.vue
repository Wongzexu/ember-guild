<script setup>
import { computed, ref, watch } from "vue";
import { visualOf } from "../data/visuals.js";

const props = defineProps({
  hero: { type: Object, required: true },
  command: { type: Object, default: null },
  feedback: { type: Object, default: null },
  showControls: { type: Boolean, default: false },
  // animated：战斗中循环播放待机动画（无控制按钮）；showControls：预览页带按钮
  animated: { type: Boolean, default: false },
});
const emit = defineEmits(["action-ended"]);

const mode = ref("idle");
const failed = ref(false);
const visual = computed(() => visualOf(props.hero));
const animation = computed(() => visual.value?.animations?.[mode.value] ?? null);
const preview = computed(
  () => (props.showControls || props.animated) && !failed.value && visual.value && animation.value
);

function fail() {
  failed.value = true;
  if (props.command?.action) emit("action-ended");
}

function play(nextMode) {
  mode.value = nextMode;
  failed.value = false;
}

function finishAction() {
  if (mode.value !== "idle") {
    play("idle");
    emit("action-ended");
  }
}

watch(
  () => props.command?.id,
  () => {
    const action = props.command?.action;
    if (action) {
      play(action);
      // 动画缺失守卫（与 MonsterVisual 对齐）：无对应 webm 时不会触发 ended，需立即归还队列
      if (!animation.value) setTimeout(() => emit("action-ended"), 0);
    }
  },
);
</script>

<template>
  <div class="hero-visual" :class="{ fallback: failed || !visual, impact: feedback }">
    <img
      v-if="visual && !failed && !preview"
      class="portrait"
      :src="visual.portrait"
      :alt="`${hero.name} 头像`"
      @error="fail"
    />
    <span v-else-if="!preview" class="fallback-text">{{ hero.name }}</span>
    <div v-if="preview" class="animation-preview">
      <video
        v-if="animation && !failed"
        :key="`${animation}:${props.command?.id ?? mode}`"
        class="animation"
        :src="animation"
        autoplay
        muted
        :loop="mode === 'idle'"
        playsinline
        :aria-label="`${hero.name} ${mode} 动画`"
        @error="fail"
        @ended="finishAction"
      ></video>
      <span v-else class="fallback-text">{{ hero.name }}</span>
      <div v-if="showControls" class="animation-controls" aria-label="动画预览">
        <button v-for="name in ['idle', 'run', 'attack', 'death']" :key="name" type="button" @click="play(name)">
          {{ name === "idle" ? "待机" : name === "run" ? "奔跑" : name === "attack" ? "攻击" : "死亡" }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hero-visual {
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
.portrait, .animation { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; }
.animation-preview { position: absolute; inset: 0; display: grid; place-items: center; }
.animation { width: 100%; height: 100%; }
.fallback-text { color: var(--gold); font-size: 14px; }
.impact { animation: impact-flash 0.24s ease-out; }
@keyframes impact-flash {
  25% { filter: brightness(1.8) saturate(0.55); transform: translateX(-2px); }
  55% { transform: translateX(2px); }
}
.animation-controls { position: absolute; top: 8px; right: 8px; display: flex; gap: 3px; z-index: 2; }
.animation-controls button { border: 1px solid var(--line); background: var(--rail-bg); color: var(--text); font-family: inherit; font-size: 10px; padding: 2px 5px; cursor: pointer; }
</style>
