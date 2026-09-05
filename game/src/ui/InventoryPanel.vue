<script setup>
// 背包（M2 · 蓝图 #05 定稿：装备/其他 tab；装备 tab = B 圆环骨架 + C 对比交互）
// 信息分层：战斗数字（攻击区间/攻速/命中攻击值/护甲减伤/DPS）只在本页；
// 穿脱走引擎纯函数 equipItem/unequipItem（B 层叠：穿走即移；#02 Q4 仅非战斗态）。
// 圆环槽位定稿（#05 ④）：头顶(0°)→颈(45°)→副手(90°)→手(135°)→脚底(180°)→戒(225°)→主手(270°)→身(315°)。
import { computed, ref } from "vue";
import {
  SLOTS,
  SLOT_LABEL,
  WEARABLE_SLOTS,
  baseOf,
  instanceName,
  canEquip,
} from "../engine/equipment.js";
import {
  heroStats,
  heroHitValue,
  heroAttackRange,
  heroAttackSpeed,
  heroArmor,
  armorReduction,
} from "../engine/hero.js";

const props = defineProps({
  state: { type: Object, required: true },
  heroId: { type: String, default: null },
  initialTab: { type: String, default: "equip" },
});

const emit = defineEmits(["equip", "unequip"]);

const tab = ref(props.initialTab);

const hero = computed(
  () => props.state.heroes.find((h) => h.id === props.heroId) ?? props.state.heroes[0]
);
const inCombat = computed(() =>
  (props.state.parties ?? []).some(
    (p) => p.status === "expedition" && (p.heroIds ?? []).includes(hero.value.id)
  )
);
const bag = computed(() => props.state.inventory.items);

//—— 战力数字（#05 ①：完整战斗数字只在装备页；DPS 汇总归面板 #03）
const numbers = computed(() => {
  const h = hero.value;
  const s = heroStats(h);
  const [lo, hi] = heroAttackRange(h);
  const speed = heroAttackSpeed(h);
  const hv = heroHitValue(h);
  return {
    atkVal: Math.ceil(hv.phys),
    dmgLo: lo,
    dmgHi: hi,
    speed,
    armor: heroArmor(h),
    armorRed: armorReduction(h),
    dps: Math.ceil(((lo + hi) / 2) * speed),
    maxHp: Math.ceil(s.maxHp),
  };
});

//—— 圆环槽位次序（顺时针；四锚点固定：头=上/脚=下/主手=最左/副手=最右；身/颈已对调）
const RING_ORDER = [
  { slot: "head", ang: 0 },
  { slot: "amulet", ang: 45 },
  { slot: "offhand", ang: 90 },
  { slot: "hands", ang: 135 },
  { slot: "feet", ang: 180 },
  { slot: "ring", ang: 225 },
  { slot: "mainhand", ang: 270 },
  { slot: "body", ang: 315 },
];

function itemAt(slot) {
  return hero.value.equipment?.[slot] ?? null;
}

function slotLocked(slot) {
  return !WEARABLE_SLOTS.has(slot);
}

//—— C 对比：点候选选中 → 当前 ⟶ 更换（提升标注放名称后面）
const selected = ref(null);

function select(inst) {
  selected.value = selected.value === inst ? null : inst;
}

function check(inst) {
  return canEquip(hero.value, inst);
}

// 候选穿上后的模拟装备（镜像 equipItem 规则，只算数字不给提交）
function simulateEquip(inst) {
  const slot = baseOf(inst.baseId).slot;
  const equipment = { ...hero.value.equipment, [slot]: inst };
  if (slot === "mainhand" && baseOf(inst.baseId).handedness === "two") {
    equipment.offhand = null; // 双手武器禁副手（#01 决策 ①）
  }
  return { ...hero.value, equipment };
}

function compareDelta(inst) {
  const slot = baseOf(inst.baseId).slot;
  const sim = simulateEquip(inst);
  if (slot === "mainhand") {
    const [c0, c1] = heroAttackRange(hero.value);
    const [n0, n1] = heroAttackRange(sim);
    return { label: "攻击区间", txt: `${n0}–${n1}`, plus: signed(`${n0 - c0}~${n1 - c1}`) };
  }
  const cArmor = heroArmor(hero.value);
  const nArmor = heroArmor(sim);
  const cRed = armorReduction(hero.value);
  const nRed = armorReduction(sim);
  const redDiff = nRed - cRed;
  return {
    label: "护甲",
    txt: `${nArmor}（${redDiff >= 0 ? "+" : ""}${redDiff.toFixed(1)}% 减伤）`,
    plus: signed(`${nArmor - cArmor}`),
  };
}

function signed(txt) {
  return txt.startsWith("-") ? txt : `+${txt}`;
}

function equip(inst) {
  if (!inst || inCombat.value || !check(inst).ok) return;
  emit("equip", { heroId: hero.value.id, instanceId: inst.id });
  selected.value = null;
}

function unequip(slot) {
  if (inCombat.value || slotLocked(slot)) return;
  emit("unequip", { heroId: hero.value.id, slot });
}
</script>

<template>
  <div class="inventory">
    <div class="head">
      <h1>背包</h1>
      <div class="tabs">
        <button class="tab" :class="{ active: tab === 'equip' }" type="button" @click="tab = 'equip'">装备</button>
        <button class="tab" :class="{ active: tab === 'misc' }" type="button" @click="tab = 'misc'">其他</button>
      </div>
    </div>

    <p v-if="inCombat" class="combat-hint">远征进行中，穿脱仅限非战斗态（收队后再整理装备）。</p>

    <template v-if="tab === 'equip'">
      <!-- 战力概要（所有信息汇聚处） -->
      <section class="powerbar">
        <div class="pcell"><span>攻击区间</span><b class="up">{{ numbers.dmgLo }}–{{ numbers.dmgHi }}</b></div>
        <div class="pcell"><span>攻速</span><b>{{ numbers.speed.toFixed(2) }}/s</b></div>
        <div class="pcell"><span>命中/攻击值</span><b>{{ numbers.atkVal }}</b></div>
        <div class="pcell"><span>护甲减伤</span><b>{{ numbers.armorRed.toFixed(1) }}%</b></div>
        <div class="pcell"><span>生命</span><b>{{ numbers.maxHp }}</b></div>
        <div class="pcell dps"><span>战力 DPS</span><b>{{ numbers.dps }}</b></div>
      </section>

      <section class="main">
        <div class="ringzone">
          <div class="ring">
            <div
              v-for="r in RING_ORDER"
              :key="r.slot"
              class="node"
              :style="{ '--ang': r.ang + 'deg' }"
              :class="{ filled: itemAt(r.slot), locked: slotLocked(r.slot) }"
            >
              <span class="nlab">{{ SLOT_LABEL[r.slot] }}</span>
              <b v-if="itemAt(r.slot)" class="nitem">{{ baseOf(itemAt(r.slot).baseId).name }}</b>
              <span v-else-if="slotLocked(r.slot)" class="nempty">锁</span>
              <span v-else class="nempty">空</span>
            </div>
            <div class="core">
              <span>{{ hero.name }}</span>
              <b>Lv.{{ hero.level }}</b>
            </div>
          </div>
        </div>

        <div class="panes">
          <!-- 左：已穿戴 -->
          <div class="pane worn">
            <h4>已穿戴</h4>
            <div
              v-for="s in SLOTS"
              :key="'w' + s"
              class="prow"
              :class="{ locked: slotLocked(s) }"
            >
              <span class="slotname">{{ SLOT_LABEL[s] }}</span>
              <template v-if="itemAt(s)">
                <span class="item">{{ instanceName(itemAt(s)) }}</span>
                <span class="rarity" :class="itemAt(s).rarity">{{ itemAt(s).rarity === 'blue' ? '稀' : '白' }}</span>
                <button v-if="!slotLocked(s)" class="mini" type="button" :disabled="inCombat" @click="unequip(s)">卸</button>
              </template>
              <span v-else class="empty">{{ slotLocked(s) ? '未解锁' : '（空）' }}</span>
            </div>
          </div>

          <!-- 右：候选（背包） -->
          <div class="pane cand">
            <h4>候选中</h4>
            <div
              v-for="b in bag"
              :key="b.id"
              class="prow"
              :class="{ disabled: !check(b).ok, sel: selected === b }"
              :title="!check(b).ok ? check(b).reason : ''"
              @click="check(b).ok && select(b)"
            >
              <span class="rarity" :class="b.rarity">{{ b.rarity === 'blue' ? '稀' : '白' }}</span>
              <span class="item">{{ instanceName(b) }}</span>
              <span class="sub">{{ SLOT_LABEL[baseOf(b.baseId).slot] }} · Lv.{{ baseOf(b.baseId).reqLevel }}</span>
            </div>
            <p v-if="!bag.length" class="bag-empty">背包空——去远征打点装备回来。</p>
          </div>
        </div>

        <!-- 对比/穿上框：提升标注放名称后面（#05 ⑤） -->
        <div v-if="selected" class="compare">
          <div class="ccol cur">
            <span class="chk">当前</span>
            <template v-if="itemAt(baseOf(selected.baseId).slot)">
              <b>{{ instanceName(itemAt(baseOf(selected.baseId).slot)) }}</b>
            </template>
            <span v-else class="empty">（该槽为空）</span>
          </div>
          <div class="arrow">⟶</div>
          <div class="ccol">
            <span class="chk">更换</span>
            <b>{{ instanceName(selected) }}</b>
            <span class="delta" :class="{ down: compareDelta(selected).plus.startsWith('-') }">
              {{ compareDelta(selected).label }} {{ compareDelta(selected).txt }}
              <em>({{ compareDelta(selected).plus }})</em>
            </span>
          </div>
          <button class="btn-equip" type="button" :disabled="inCombat || !check(selected).ok" @click="equip(selected)">
            穿上
          </button>
        </div>
      </section>
    </template>

    <template v-else>
      <section class="panel misc">
        <div class="kv"><span>金币</span><b>{{ state.inventory.gold }}</b></div>
        <div class="kv"><span>材料</span><b>{{ Object.keys(state.inventory.materials ?? {}).length ? "" : "（暂无）" }}</b></div>
        <p class="muted">材料/消耗品随系统落地填充（M3+）。</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.inventory {
  max-width: 760px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.head {
  display: flex;
  align-items: center;
  gap: 22px;
}

.head h1 {
  font-size: 22px;
  color: var(--gold);
  letter-spacing: 3px;
}

.tabs {
  display: flex;
  gap: 8px;
}

.tab {
  border: 1px solid var(--line);
  background: var(--rail-bg);
  color: var(--dim);
  border-radius: 3px;
  padding: 5px 14px;
  font-family: inherit;
  font-size: 12px;
  letter-spacing: 2px;
  cursor: pointer;
}

.tab.active {
  border-color: var(--ember);
  color: var(--ember);
}

.combat-hint {
  color: var(--dim);
  font-size: 12px;
}

.powerbar {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
  background: var(--card-bg);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 12px 16px;
}

.pcell {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 11px;
  color: var(--dim);
}

.pcell b {
  font-size: 15px;
  color: var(--text);
}

.pcell b.up {
  color: var(--ember);
}

.pcell.dps b {
  color: var(--gold);
  font-size: 18px;
}

.main {
  background: var(--card-bg);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.ringzone {
  display: grid;
  place-items: center;
}

.ring {
  position: relative;
  width: 260px;
  height: 260px;
}

.node {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(var(--ang)) translateY(-104px) rotate(calc(-1 * var(--ang)));
  width: 62px;
  height: 52px;
  border: 1px dashed var(--line);
  border-radius: 3px;
  display: grid;
  place-items: center;
  font-size: 10px;
  text-align: center;
  color: var(--dim);
  background: var(--rail-bg);
}

.node.locked {
  opacity: 0.35;
}

.node.filled {
  border-style: solid;
  border-color: var(--gold);
  color: var(--text);
}

.nlab {
  display: block;
  font-size: 10px;
}

.nitem {
  font-size: 11px;
  color: var(--gold);
}

.nempty {
  font-size: 10px;
  color: var(--dim);
}

.core {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 92px;
  height: 92px;
  border: 2px solid var(--ember);
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-size: 12px;
  color: var(--text);
}

.core b {
  color: var(--gold);
}

.panes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}

.pane h4 {
  font-size: 12px;
  letter-spacing: 3px;
  color: var(--ember);
  margin-bottom: 10px;
}

.prow {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 0;
  font-size: 13px;
}

.worn .prow {
  border-bottom: 1px dashed var(--line);
}

.worn .prow.locked {
  opacity: 0.35;
}

.worn .slotname {
  color: var(--dim);
  width: 42px;
  flex: none;
}

.cand .prow {
  border: 1px solid var(--line);
  border-radius: 3px;
  padding: 7px 10px;
  margin-bottom: 6px;
  cursor: pointer;
  background: var(--rail-bg);
}

.cand .prow:hover:not(.disabled) {
  border-color: var(--ember);
}

.cand .prow.disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.cand .prow.sel {
  border-color: var(--ember);
  background: var(--ash-3);
}

.prow .item {
  color: var(--text);
}

.prow .sub {
  margin-left: auto;
  font-size: 11px;
  color: var(--dim);
}

.rarity {
  font-size: 11px;
  letter-spacing: 1px;
  align-self: flex-start;
  border-radius: 2px;
  padding: 1px 6px;
  flex: none;
}

.rarity.white {
  color: var(--dim);
  border: 1px solid var(--line);
}

.rarity.blue {
  color: #7db3e8;
  border: 1px solid #7db3e8;
}

.mini {
  border: 1px solid var(--line);
  background: none;
  color: var(--dim);
  border-radius: 2px;
  padding: 1px 8px;
  font-size: 11px;
  cursor: pointer;
  font-family: inherit;
}

.mini:hover:not(:disabled) {
  color: var(--ember);
  border-color: var(--ember);
}

.mini:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.bag-empty {
  color: var(--dim);
  font-size: 12px;
  padding: 8px 0;
}

.empty {
  color: var(--dim);
  font-size: 12px;
}

.compare {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto;
  align-items: center;
  gap: 14px;
  border: 1px solid var(--ember);
  border-radius: 4px;
  background: var(--rail-bg);
  padding: 12px 16px;
}

.ccol {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ccol .chk {
  font-size: 11px;
  letter-spacing: 2px;
  color: var(--dim);
}

.ccol b {
  font-size: 14px;
  color: var(--text);
}

.ccol.cur b {
  color: var(--dim);
}

.delta {
  font-size: 12px;
  color: var(--ember);
}

.delta em {
  font-style: normal;
  color: var(--gold);
  font-size: 11px;
}

.delta.down {
  color: var(--dim);
}

.arrow {
  color: var(--dim);
  font-size: 18px;
}

.btn-equip {
  border: 1px solid var(--ember);
  background: linear-gradient(180deg, var(--ash-3), var(--ash-2));
  color: var(--text);
  border-radius: 3px;
  padding: 8px 18px;
  font-family: inherit;
  letter-spacing: 3px;
  cursor: pointer;
}

.btn-equip:hover:not(:disabled) {
  color: var(--ember);
}

.btn-equip:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.panel.misc {
  background: var(--card-bg);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 18px 22px;
}

.kv {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-top: 1px dashed var(--line);
  font-size: 14px;
}

.kv:first-child {
  border-top: none;
}

.kv span {
  color: var(--dim);
}

.kv b {
  color: var(--text);
}

.muted {
  color: var(--dim);
  font-size: 12px;
  margin-top: 8px;
}
</style>
