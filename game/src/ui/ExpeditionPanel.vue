<script setup>
import { computed } from "vue";
import regionsData from "../data/regions.json";
import { heroStats } from "../engine/hero.js";

const props = defineProps({
  state: { type: Object, required: true },
});

const emit = defineEmits(["deploy", "stop"]);

const REGIONS = regionsData.regions;

const party = computed(() => props.state.parties[0] ?? null);
const hero = computed(() => props.state.heroes[0]);
const isRunning = computed(() => party.value?.status === "expedition");
const currentRegion = computed(() => {
  if (!isRunning.value || !party.value) return null;
  return REGIONS.find((r) => r.key === party.value.regionKey) ?? null;
});

function locked(r) {
  if (!hero.value) return "无英雄";
  if (hero.value.level < r.unlock.heroLevel) return `英雄 Lv.${r.unlock.heroLevel}`;
  if (props.state.org.level < r.unlock.orgLevel) return `组织 Lv.${r.unlock.orgLevel}`;
  return null;
}

const monsterPct = computed(() => {
  const m = party.value?.monster;
  if (!m || !m.maxHp) return 0;
  return Math.max(0, Math.min(100, (m.hp / m.maxHp) * 100));
});

const heroHpPct = computed(() => {
  if (!hero.value) return 0;
  const max = heroStats(hero.value).maxHp;
  if (!max) return 0;
  return Math.max(0, Math.min(100, ((hero.value.hp ?? max) / max) * 100));
});
</script>

<template>
  <div class="expedition">
    <div class="party-head">
      <h2>远征厅</h2>
      <div v-if="isRunning && currentRegion" class="running">
        <span class="pulse"></span>
        出征中 · {{ currentRegion.name }} → 击杀 {{ party.killCount }} · 金币 +{{ party.goldEarned }}
        <button class="btn btn-stop" type="button" @click="emit('stop')">停止</button>
      </div>
    </div>

    <p class="hint">M1 首闭环：此刻能去的地方只有迷雾边缘，要带上的人也只要艾格雷姆就够。</p>

    <div class="region-grid">
      <div v-for="r in REGIONS" :key="r.key" class="region-card" :class="{ locked: locked(r) }">
        <h3>{{ r.name }}</h3>
        <div class="row"><span>推荐等级</span><b>{{ r.levelRange[0] }}–{{ r.levelRange[1] }}</b></div>
        <div class="row"><span>怪物血量</span><b>{{ r.monster.hp[0] }}–{{ r.monster.hp[1] }}</b></div>
        <div class="row"><span>怪物威力</span><b>{{ r.monster.dmg[0] }}–{{ r.monster.dmg[1] }}</b></div>
        <div class="row"><span>击杀经验</span><b>{{ r.xp }}</b></div>
        <div class="row"><span>产出</span><b class="loot">{{ r.loot.join(" / ") }}</b></div>
        <div v-if="locked(r) === null" class="op">
          <button
            class="btn"
            type="button"
            :disabled="isRunning && party.regionKey === r.key"
            @click="emit('deploy', r.key)"
          >
            {{ isRunning && party.regionKey === r.key ? "出征中" : "出发" }}
          </button>
        </div>
        <p v-else class="lock-note">🔒 {{ locked(r) }}</p>
      </div>
    </div>

    <section class="battle-log" v-if="isRunning && currentRegion">
      <h4>战斗</h4>
      <div class="bars">
        <div class="bar">
          <span class="name">{{ hero.name }}</span>
          <div class="track"><div class="fill hero" :style="{ width: heroHpPct + '%' }"></div></div>
        </div>
        <div class="bar">
          <span class="name">迷雾怪物</span>
          <div class="track"><div class="fill foe" :style="{ width: monsterPct + '%' }"></div></div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.expedition {
  max-width: 760px;
  width: 100%;
}

.party-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
}

.party-head h2 {
  font-size: 20px;
  color: var(--gold);
  letter-spacing: 5px;
}

.running {
  font-size: 13px;
  color: var(--ember);
}

.pulse {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ember);
  margin-right: 6px;
  animation: pulse 1.2s infinite;
}

@keyframes pulse {
  50% { opacity: 0.3; }
}

.hint {
  font-size: 12px;
  color: var(--dim);
  margin: 6px 0 16px;
}

.region-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 14px;
}

.region-card {
  background: var(--card-bg);
  border: 1px solid var(--line);
  border-radius: 4px;
  box-shadow: var(--card-shadow);
  padding: 14px 16px;
}

.region-card.locked {
  opacity: 0.45;
}

.region-card h3 {
  font-size: 15px;
  color: var(--paper);
  letter-spacing: 2px;
  margin-bottom: 8px;
}

.row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  padding: 3px 0;
  color: var(--dim);
}

.row b {
  color: var(--text);
  font-weight: normal;
}

.row .loot {
  color: var(--gold);
}

.op {
  margin-top: 10px;
}

.btn {
  width: 100%;
  padding: 8px 0;
  border: 1px solid var(--line);
  border-radius: 3px;
  background: linear-gradient(180deg, var(--ash-3), var(--ash-2));
  color: var(--text);
  font-family: inherit;
  letter-spacing: 4px;
  cursor: pointer;
}

.btn:hover:not(:disabled) {
  border-color: var(--ember);
  color: var(--ember);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-stop {
  width: auto;
  padding: 4px 14px;
  margin-left: 10px;
  letter-spacing: 2px;
  font-size: 12px;
}

.lock-note {
  margin-top: 10px;
  font-size: 12px;
  color: var(--dim);
}

.battle-log {
  margin-top: 20px;
  background: var(--card-bg);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 16px 18px;
}

.battle-log h4 {
  font-size: 13px;
  color: var(--ember);
  letter-spacing: 5px;
  margin-bottom: 12px;
}

.bars {
  display: grid;
  gap: 10px;
}

.bar {
  display: grid;
  grid-template-columns: 90px 1fr;
  align-items: center;
  gap: 12px;
}

.bar .name {
  font-size: 12px;
  color: var(--dim);
}

.track {
  height: 14px;
  border: 1px solid var(--line);
  border-radius: 3px;
  background: var(--ash-2);
  overflow: hidden;
}

.fill {
  height: 100%;
  transition: width 0.4s ease;
}

.fill.hero { background: linear-gradient(90deg, var(--ember-dim), var(--ember)); }
.fill.foe { background: linear-gradient(90deg, var(--ash-3), var(--gold)); }
</style>
