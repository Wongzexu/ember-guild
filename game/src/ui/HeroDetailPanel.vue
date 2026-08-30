<script setup>
import { computed } from "vue";
import { heroStats, weaponOf, heroAttackRange } from "../engine/hero.js";
import { xpToReach, LEVEL_MAX } from "../engine/xp.js";
import helmetIcon from "./icons/warrior-helmet-lv1.svg";
import chartIcon from "./icons/chart.svg";
import swordIcon from "./icons/sword.svg";

const props = defineProps({
  hero: { type: Object, required: true },
});

const emit = defineEmits(["back"]);

const stats = computed(() => heroStats(props.hero));
const weapon = computed(() => {
  const w = weaponOf(props.hero);
  return w ? { name: w.name, damage: `${w.damage[0]}–${w.damage[1]}` } : null;
});
const range = computed(() => heroAttackRange(props.hero));
const xpInfo = computed(() => {
  const cur = xpToReach(props.hero.level);
  const next = xpToReach(props.hero.level + 1);
  const need = Math.max(0, next - props.hero.xp);
  const pct =
    props.hero.level >= LEVEL_MAX
      ? 100
      : Math.min(100, Math.max(0, ((props.hero.xp - cur) / (next - cur)) * 100));
  return { need, pct };
});
const cells = computed(() => {
  const row = (label, v, note = "") => ({ label, v: Math.ceil(v), note });
  return [
    row("STR 力量", stats.value.str, "物理伤害"),
    row("DEX 敏捷", stats.value.dex, "攻速/命中"),
    row("VIT 体质", stats.value.vit, "生命/抗性"),
    row("INT 智力", stats.value.int, "法术/元素"),
    row("AGI 灵巧", stats.value.agi, "闪避"),
  ];
});

function ico(url) {
  return { "--icon": `url("${url}")` };
}
</script>

<template>
  <div class="hero-detail">
    <div class="head">
      <button class="back" type="button" @click="emit('back')">← 名册</button>
      <div class="avatar">
        <i class="icon" :style="ico(helmetIcon)"></i>
      </div>
      <div class="meta">
        <h1>{{ hero.name }} <span class="title">{{ hero.title }}</span></h1>
        <div class="tags">
          <span class="tag">职业 · 铁砧（纯力近战）</span>
          <span class="tag">性格 · {{ hero.personality }}</span>
          <span class="tag">Lv.{{ hero.level }}</span>
        </div>
        <blockquote class="quote">「{{ hero.quotes[1] }}」</blockquote>
        <div class="xpbar">
          <div class="xpfill" :style="{ width: xpInfo.pct + '%' }"></div>
          <span class="xptext">Lv.{{ hero.level }} · 距 Lv.{{ hero.level + 1 }} 还差 {{ Math.ceil(xpInfo.need) }}</span>
        </div>
      </div>
    </div>

    <div class="grid">
      <section class="panel">
        <h2><i class="icon" :style="ico(chartIcon)"></i> 五维</h2>
        <div class="statrow" v-for="c in cells" :key="c.label">
          <span class="k">{{ c.label }}</span>
          <b>{{ c.v }}</b>
          <span class="note">{{ c.note }}</span>
        </div>
      </section>

      <section class="panel">
        <h2><i class="icon" :style="ico(swordIcon)"></i> 战斗</h2>
        <div class="kv"><span>生命</span><b>{{ Math.ceil(stats.maxHp) }}（现 {{ hero.hp === null ? "满" : Math.ceil(hero.hp) }}）</b></div>
        <div class="kv"><span>物抗 / 法抗</span><b>{{ (stats.physRes).toFixed(1) }}% / {{ (stats.magRes).toFixed(1) }}%</b></div>
        <div class="kv"><span>武器</span><b v-if="weapon">{{ weapon.name }}（{{ weapon.damage }}）</b><b v-else>徒手</b></div>
        <div class="kv"><span>攻击区间</span><b>{{ range[0] }}–{{ range[1] }}</b></div>
      </section>
    </div>

    <section class="panel talents">
      <h2>天赋</h2>
      <p>
        Lv.5 STR+5 ｜ Lv.10 双抗+5% ｜ Lv.15 VIT+10 ｜ Lv.20 生命+50&多属性 ｜ Lv.25 攻速+10% ｜ Lv.30 近战伤害+15%（持近战武器）
        <span class="muted">（#3 过审中；Lv.35+ 六拍循环，NUMBERS §3.3）</span>
      </p>
    </section>
  </div>
</template>

<style scoped>
.hero-detail {
  max-width: 760px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.head {
  display: flex;
  gap: 22px;
  align-items: center;
}

.back {
  align-self: flex-start;
  border: 1px solid var(--line);
  background: var(--rail-bg);
  color: var(--dim);
  border-radius: 3px;
  padding: 5px 12px;
  font-family: inherit;
  font-size: 12px;
  letter-spacing: 2px;
  cursor: pointer;
}

.back:hover {
  border-color: var(--ember);
  color: var(--ember);
}

.avatar {
  width: 84px;
  height: 84px;
  border-radius: 6px;
  border: 1px solid var(--line);
  background: var(--card-bg);
  display: grid;
  place-items: center;
  font-size: 44px;
  color: var(--ember);
}

.meta h1 {
  font-size: 22px;
  color: var(--gold);
  letter-spacing: 3px;
}

.meta .title {
  font-size: 13px;
  color: var(--dim);
  letter-spacing: 6px;
  margin-left: 8px;
}

.tags {
  display: flex;
  gap: 10px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.tag {
  font-size: 12px;
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: 3px;
  padding: 2px 8px;
  background: var(--rail-bg);
}

.quote {
  margin-top: 10px;
  color: var(--ember);
  font-size: 14px;
  font-style: italic;
}

.xpbar {
  margin-top: 10px;
  position: relative;
  height: 18px;
  background: var(--ash-2);
  border: 1px solid var(--line);
  border-radius: 3px;
  overflow: hidden;
}

.xpfill {
  height: 100%;
  background: linear-gradient(90deg, var(--ember-dim), var(--gold));
  transition: width 0.5s ease;
}

.xptext {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 11px;
  color: #ffffffcc;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.panel {
  background: var(--card-bg);
  border: 1px solid var(--line);
  border-radius: 4px;
  box-shadow: var(--card-shadow);
  padding: 18px 22px;
}

.panel h2 {
  font-size: 13px;
  color: var(--ember);
  letter-spacing: 5px;
  margin-bottom: 12px;
}

.statrow {
  display: grid;
  grid-template-columns: 92px 40px 1fr;
  gap: 8px;
  padding: 6px 0;
  border-top: 1px dashed var(--line);
  font-size: 14px;
}

.statrow .k { color: var(--text); }
.statrow b { color: var(--gold); text-align: right; }
.statrow .note { color: var(--dim); font-size: 12px; }

.kv {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-top: 1px dashed var(--line);
  font-size: 14px;
}

.kv span { color: var(--dim); }
.kv b { color: var(--text); }

.muted {
  color: var(--dim);
  font-size: 12px;
}

.talents p {
  font-size: 13px;
  line-height: 1.9;
}
</style>
