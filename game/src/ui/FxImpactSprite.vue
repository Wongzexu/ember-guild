<script setup>
import { computed, onMounted, ref } from "vue";
import { FX_SHEETS } from "../data/fx-sheets.js";

// 命中冲击 fx 精灵播放器：挂载即用 WAAPI 逐帧步进播完一次（帧位不均匀，按 PLIST 帧序驱动背景位偏移）。
// 定位/偏移归父级（absolute 锚点 + transform），本组件只负责帧画面。
const props = defineProps({
  sprite: { type: String, required: true }, // 共享 fx 库键，如 "fx_collision"
  scale: { type: Number, default: 1.6 },
});

const el = ref(null);
const sheet = computed(() => FX_SHEETS[props.sprite]);
const baseStyle = computed(() => {
  const s = sheet.value;
  if (!s) return {};
  return {
    width: `${s.fw * props.scale}px`,
    height: `${s.fh * props.scale}px`,
    backgroundImage: `url(/assets-runtime/duelyst/fx/${s.file ?? props.sprite}.png)`,
    backgroundSize: `${s.sw * props.scale}px ${s.sh * props.scale}px`,
  };
});

onMounted(() => {
  const s = sheet.value;
  if (!s || !el.value) return;
  const keyframes = s.frames.map(([x, y]) => ({
    backgroundPosition: `${-x * props.scale}px ${-y * props.scale}px`,
    easing: "steps(1, end)",
  }));
  const anim = el.value.animate(keyframes, {
    duration: s.frames.length * s.delay * 1000,
    fill: "forwards",
  });
  // 播完淡出：fill: forwards 会把最后一帧定格到父级卸载为止（白色冲击 480ms 后悬停 ~1s+），
  // 命中反馈播完后快速淡出（~140ms），既不留收尾定格也不生硬闪没。
  anim.onfinish = () => {
    if (!el.value) return;
    el.value.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: "forwards" });
  };
});
</script>

<template>
  <span ref="el" class="fx-impact-sprite" :style="baseStyle"></span>
</template>

<style scoped>
.fx-impact-sprite {
  display: block;
  background-repeat: no-repeat;
  image-rendering: pixelated;
  pointer-events: none;
}
</style>
