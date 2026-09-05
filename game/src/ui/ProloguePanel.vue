<script setup>
// 文字序章（M2 新手引导）：单线事件卡片，一次一段；无对话树/多选项/配音/过场/跳过系统。
// 播放进度写入存档（state.onboarding.step），完成时由父级收口（写编年史 + 建队 + 进入 0-1）。
import { computed, ref } from "vue";
import { visualOf } from "../data/visuals.js";
import { SAVE_KEY } from "../engine/save.js";

const props = defineProps({
  state: { type: Object, required: true },
});

const emit = defineEmits(["complete"]);

// step 存储：prologue:<已看完的段数>；完成时置 "completed"
const STEPS = [
  { text: "灰烬纪元·元年。流亡者围着一座不肯熄灭的炉子停下脚步——余烬公会，就此成立。" },
  { text: "第二天，斥候回报：公会外的原野被一层灰白色的迷雾笼罩，走进去的人，再也没回来几个。" },
  { text: "迷雾昼夜不散。夜里能听见兽吼，清晨的雾里浮着不属于这个时代的影子——异象环生。" },
  { text: "第一个握住炉锤站出来的人，叫艾格雷姆。他说迷雾里的东西，和三十年前夺走他一切的东西，是同一种味道。", hero: true },
  { text: "「炉火没熄，我就还在。」", quote: true, hero: true },
];

const heroVisual = computed(() => visualOf({ visual: { portrait: "eigrem" } }));

const index = ref(Math.min(parseStep(props.state.onboarding?.step), STEPS.length - 1));
const current = computed(() => STEPS[index.value]);
const isLast = computed(() => index.value === STEPS.length - 1);

function parseStep(step) {
  const m = /^prologue:(\d+)$/.exec(step ?? "");
  return m ? Number(m[1]) : 0;
}

function persist() {
  props.state.onboarding = {
    ...props.state.onboarding,
    step: `prologue:${index.value + 1}`,
    completed: false,
  };
  props.state.meta.lastSavedAt = Date.now();
  // 序章进度立即落盘（不等 30s 自动存档）
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(JSON.parse(JSON.stringify(props.state))));
  } catch {
    // 存储失败不阻塞引导
  }
}

function advance() {
  if (!isLast.value) {
    index.value += 1;
    persist();
  }
}

function joinBattle() {
  props.state.onboarding = { step: "completed", completed: true };
  emit("complete");
}
</script>

<template>
  <div class="prologue">
    <p class="chapter">序章 · 炉火与迷雾</p>

    <transition name="card" mode="out-in">
      <div class="card" :key="index">
        <div v-if="current.hero" class="hero-stage">
          <img
            v-if="heroVisual && heroVisual.portrait"
            class="hero-portrait"
            :src="heroVisual.portrait"
            alt="艾格雷姆"
          />
        </div>
        <p class="text" :class="{ quote: current.quote }">{{ current.text }}</p>
      </div>
    </transition>

    <button class="btn" type="button" @click="isLast ? joinBattle() : advance()">
      {{ isLast ? "加入战斗" : "继续" }}
    </button>
    <p class="dots" aria-label="序章进度">
      <i v-for="(s, i) in STEPS" :key="i" :class="{ on: i <= index }"></i>
    </p>
  </div>
</template>

<style scoped>
.prologue {
  max-width: 560px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding-top: 6vh;
}

.chapter {
  font-size: 13px;
  color: var(--ember);
  letter-spacing: 6px;
}

.card {
  width: 100%;
  min-height: 300px;
  background: var(--card-bg);
  border: 1px solid var(--line);
  border-radius: 4px;
  box-shadow: var(--card-shadow);
  padding: 32px 36px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
}

.text {
  font-size: 16px;
  line-height: 2.1;
  color: var(--text);
  text-align: center;
}

.text.quote {
  font-size: 20px;
  color: var(--gold);
  letter-spacing: 3px;
}

.hero-stage {
  height: 160px;
  display: grid;
  place-items: center;
}

.hero-portrait {
  height: 150px;
  image-rendering: pixelated;
}

.btn {
  min-width: 220px;
  padding: 12px 0;
  border: 1px solid var(--line);
  border-radius: 3px;
  background: linear-gradient(180deg, var(--ash-3), var(--ash-2));
  color: var(--text);
  font-family: inherit;
  font-size: 14px;
  letter-spacing: 6px;
  cursor: pointer;
}

.btn:hover {
  border-color: var(--ember);
  color: var(--ember);
}

.dots {
  display: flex;
  gap: 8px;
}

.dots i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1px solid var(--line);
}

.dots i.on {
  background: var(--ember);
  border-color: var(--ember);
}

.card-enter-active,
.card-leave-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
}

.card-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.card-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
