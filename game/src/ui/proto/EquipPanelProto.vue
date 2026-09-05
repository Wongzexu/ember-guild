<script setup>
// M2 装备面板 UI —— prototype（探究"如何长这样"，非正式代码）
// 问题：#05 装备面板与穿戴交互（UI）。已拍板 「选定版 B+C」：B 属性圆环骨架 + C 对比交互。
// 关键：圆环槽位排布 = 头顶 / 脚底 / 主手最左 / 副手最右 / 其余四槽填对角线；
// 装备对比用 C 的左"已穿" vs 右"候选"，**提升标注放在名称后面**（不放在前）。
// 数据模型为 stub：镜像 #01 B 层叠（实例对象嵌 hero.equipment、背包存未穿、穿走即移）
// + #02 接线（heroStats 折装备 flat、heroAttackRange/heroAttackSpeed armorReduction）
// + #04 命名（基底名固定·稀有度加修饰词：迅捷之铜锤）。引擎未接装备，故穿脱为内存演示。
// 运行：game 目录 pnpm dev → 英雄详情视图。
// THROWAWAY：选定设计后照录蓝图，本组件不进主分支。

import { computed, onMounted, ref, onUnmounted } from "vue";

//—— 纯逻辑模块（可 lift）：stub 数据 + 接线公式，镜像 #01/#02/#04 决策
const SLOTS = ["mainhand", "offhand", "head", "body", "hands", "feet", "ring", "amulet"];
const SLOT_LABEL = {
  mainhand: "主手", offhand: "副手", head: "头", body: "身",
  hands: "手", feet: "脚", ring: "戒", amulet: "链",
};

const BASE_ITEMS = {
  "copper-hammer": { id: "copper-hammer", type: "weapon", slot: "mainhand", subtype: "hammer", reqLevel: 1, damage: [1, 3], bps: 1.0, name: "铜锤" },
  "iron-hammer": { id: "iron-hammer", type: "weapon", slot: "mainhand", subtype: "hammer", reqLevel: 5, damage: [6, 11], bps: 1.0, name: "铁锤" },
  "great-hammer": { id: "great-hammer", type: "weapon", slot: "mainhand", subtype: "hammer", reqLevel: 5, damage: [10, 16], bps: 0.8, name: "大锤" },
  "wood-shield": { id: "wood-shield", type: "shield", slot: "offhand", subtype: "phys", reqLevel: 1, armor: 8, name: "木盾" },
  "oak-shield": { id: "oak-shield", type: "shield", slot: "offhand", subtype: "phys", reqLevel: 5, armor: 22, name: "橡木盾" },
};
const AFFIX_NAME = {
  flat_str: ["+力量", "str"],
  flat_dex: ["+敏捷", "dex"],
  flat_vit: ["+体质", "vit"],
  attack_speed_pct: ["+攻速%", null],
  phys_damage_pct: ["+物理伤害%", null],
  flat_phys: ["+附加伤害", null],
  armor_pct: ["+护甲%", null],
};

function baseOf(id) {
  const b = BASE_ITEMS[id];
  if (!b) throw new Error("未知基底 " + id);
  return b;
}

function emptyEquip() {
  return Object.fromEntries(SLOTS.map((s) => [s, null]));
}

// 实例名 = 修饰词 + 基底名（#04：基底名固定，稀有度只加修饰词）
function instanceName(inst) {
  if (!inst) return "";
  const base = baseOf(inst.baseId);
  if (inst.rarity === "blue" && inst.affixes.length > 0) {
    return AFFIX_NAME[inst.affixes[0].affix][0].replace("%", "") + "·" + base.name;
  }
  return base.name;
}

function affixSum(equipped, filter) {
  let sum = 0;
  for (const item of equipped) {
    for (const a of item.affixes ?? []) if (filter(a)) sum += a.value;
  }
  return sum;
}

function heroStats(hero) {
  const lv = hero.level;
  const g = hero.growth ?? {};
  const stat = (k) => (hero.base?.[k] ?? 0) + (lv - 1) * (1 + (g[k] ?? 0));
  const equipped = Object.values(hero.equipment ?? {}).filter(Boolean);
  const stats = {
    str: stat("str"), dex: stat("dex"), vit: stat("vit"), int: stat("int"), agi: stat("agi"),
  };
  for (const item of equipped) {
    for (const a of item.affixes ?? []) {
      if (a.stat) stats[a.stat] = (stats[a.stat] ?? 0) + a.value;
    }
  }
  stats.maxHp = 100 + stats.vit * 12;
  const resist = (vit) => (1 - 300 / (300 + vit)) * 100;
  stats.physRes = Math.min(75, resist(stats.vit));
  return stats;
}

function heroAttackRange(hero) {
  const main = hero.equipment?.mainhand;
  const base = main ? baseOf(main.baseId) : null;
  const dmg = base?.damage ?? [0, 0];
  const s = heroStats(hero);
  const equipped = Object.values(hero.equipment ?? {}).filter(Boolean);
  const dmgPct = affixSum(equipped, (a) => a.affix === "phys_damage_pct") / 100;
  const mult = (1 + s.str / 100) * (1 + dmgPct);
  return [Math.floor(dmg[0] * mult), Math.floor(dmg[1] * mult)];
}

function heroAttackSpeed(hero) {
  const main = hero.equipment?.mainhand;
  const base = main ? baseOf(main.baseId) : null;
  const bps = base?.bps ?? 1.0;
  const s = heroStats(hero);
  const equipped = Object.values(hero.equipment ?? {}).filter(Boolean);
  const pct = affixSum(equipped, (a) => a.affix === "attack_speed_pct") / 100;
  return bps * (1 + s.dex / 100 + pct);
}

function heroArmor(hero) {
  let armor = 0;
  const equipped = Object.values(hero.equipment ?? {}).filter(Boolean);
  for (const item of equipped) {
    const base = baseOf(item.baseId);
    if (base.armor) armor += base.armor;
  }
  armor += affixSum(equipped, (a) => a.affix === "armor_pct");
  return armor;
}

function heroDps(hero) {
  const [lo, hi] = heroAttackRange(hero);
  return ((lo + hi) / 2) * heroAttackSpeed(hero);
}

//—— 演示（stub）数据模型：B 层叠——背包存未穿，穿走即移
let nid = 1;
function mk(baseId, rarity, affixes) {
  return { id: nid++, baseId, rarity, affixes };
}
function demoState() {
  const hero = {
    level: 5,
    base: { str: 12, dex: 8, vit: 12, int: 5, agi: 7 },
    growth: { str: 0.4, vit: 0.5 },
    core: "str",
    equipment: emptyEquip(),
  };
  // 迁移（#01）：起始铜锤铸成实例塞 mainhand
  hero.equipment.mainhand = mk("copper-hammer", "white", []);
  const bag = [
    mk("copper-hammer", "blue", [{ affix: "flat_str", stat: "str", value: 2 }, { affix: "phys_damage_pct", value: 10 }]),
    mk("oak-shield", "blue", [{ affix: "flat_vit", stat: "vit", value: 3 }]),
    mk("iron-hammer", "white", []),
    mk("great-hammer", "white", []),
    mk("wood-shield", "white", []),
  ];
  return { hero, bag };
}

//—— 圆环槽位次序（顺时针，0°=头顶向外）
//    头顶(0) → 颈(45) → 副手(90·最右) → 手(135) → 脚底(180) → 戒(225) → 主手(270·最左) → 身(315)
//    四锚点：头=上 / 脚=下 / 主手=最左 / 副手=最右（身/颈对调：身体左上、颈部右上）
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
const state = ref(demoState());
const hero = computed(() => state.value.hero);
const bag = computed(() => state.value.bag);
const selected = ref(null); // C 对比：当前选中的候选实例（点名称选中，点"穿"或不选中则收起）

function select(inst) {
  selected.value = inst;
}

function equip(inst) {
  if (!inst) return;
  const base = baseOf(inst.baseId);
  if (hero.value.level < base.reqLevel) return; // 需等级不足（演示忽略提示）
  const bagArr = state.value.bag;
  const idx = bagArr.indexOf(inst);
  if (idx < 0) return;
  bagArr.splice(idx, 1);
  const slot = base.slot;
  const old = hero.value.equipment[slot];
  hero.value.equipment[slot] = inst;
  if (old) bagArr.push(old); // 旧的下装回背包
  state.value = { ...state.value, bag: [...bagArr] };
}
function unequip(slot) {
  const inst = hero.value.equipment[slot];
  if (!inst) return;
  hero.value.equipment[slot] = null;
  state.value = { ...state.value, bag: [...state.value.bag, inst] };
}

//—— 战力数字（面板显示用，含 DPS 汇总）
const numbers = computed(() => {
  const s = heroStats(hero.value);
  const [lo, hi] = heroAttackRange(hero.value);
  return {
    str: s.str, dex: s.dex, vit: s.vit,
    maxHp: s.maxHp, physRes: s.physRes,
    atkVal: s.dex * 10 + s.str * 5,
    dmgLo: lo, dmgHi: hi,
    speed: heroAttackSpeed(hero.value),
    armor: heroArmor(hero.value),
    armorRed: (1 - 300 / (300 + heroArmor(hero.value))) * 100,
    dps: heroDps(hero.value),
  };
});

function itemAt(slot) {
  return hero.value.equipment[slot];
}
function canEquip(inst) {
  if (!inst) return false;
  return hero.value.level >= baseOf(inst.baseId).reqLevel;
}

//—— 对比：候选装 vs 已穿同槽。提升标注放在名称后面（拍板口径）。
function baseDmg(inst) {
  const b = baseOf(inst.baseId);
  return b.damage || null;
}
// 返回候选相对当前已穿的主手/副手差值描述（示例用：攻击区间 / 护甲）
function compareDelta(inst) {
  const slot = baseOf(inst.baseId).slot;
  const cur = hero.value.equipment[slot];
  const d = baseDmg(inst);
  const cd = cur ? baseDmg(cur) : null;
  if (slot === "mainhand") {
    const n0 = d ? d[0] : 0, n1 = d ? d[1] : 0;
    const c0 = cd ? cd[0] : 0, c1 = cd ? cd[1] : 0;
    return { label: "攻击区间", txt: `${n0}–${n1}`, plus: `${n0 - c0}~${n1 - c1}` };
  }
  const nA = baseOf(inst.baseId).armor || 0;
  const cA = cur ? baseOf(cur.baseId).armor || 0 : 0;
  return { label: "护甲", txt: `${nA}`, plus: `${nA - cA}` };
}

function onKey(e) {
  if (e.key === "Escape") selected.value = null;
}
onMounted(() => window.addEventListener("keydown", onKey));
onUnmounted(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <div class="proto-wrap">
    <!-- 战力概要（所有变体共用） -->
    <section class="powerbar">
      <div class="pcell"><span>攻击区间</span><b class="up">{{ numbers.dmgLo }}–{{ numbers.dmgHi }}</b></div>
      <div class="pcell"><span>攻速</span><b>{{ numbers.speed.toFixed(2) }}/s</b></div>
      <div class="pcell"><span>命中/攻击值</span><b>{{ Math.ceil(numbers.atkVal) }}</b></div>
      <div class="pcell"><span>护甲减伤</span><b>{{ numbers.armorRed.toFixed(1) }}%</b></div>
      <div class="pcell dps"><span>战力 DPS</span><b>{{ Math.ceil(numbers.dps) }}</b></div>
    </section>

    <!-- ===== 选定版：B 圆环骨架 + C 对比交互 ===== -->
    <section class="vacolor main">
      <div class="ringzone">
        <div class="ring">
          <div
            v-for="r in RING_ORDER"
            :key="r.slot"
            class="node"
            :style="{ '--ang': r.ang + 'deg' }"
            :class="{ filled: itemAt(r.slot), worn: itemAt(r.slot) }"
            @click="selected && baseOf(selected.baseId).slot === r.slot ? equip(selected) : null"
          >
            <span class="nlab">{{ SLOT_LABEL[r.slot] }}</span>
            <b v-if="itemAt(r.slot)" class="nitem">{{ baseOf(itemAt(r.slot).baseId).name }}</b>
            <span v-else class="nempty">{{ r.slot === 'mainhand' || r.slot === 'offhand' ? '空' : '' }}</span>
          </div>
          <div class="core">
            <span>岩铁砧</span>
            <b>纯力·近战</b>
          </div>
        </div>
      </div>

      <div class="panes">
        <!-- 左：已穿（C 对比列） -->
        <div class="pane worn">
          <h4>已穿戴</h4>
          <div v-for="r in RING_ORDER" :key="'w' + r.slot" class="prow" :class="{ locked: r.slot !== 'mainhand' && r.slot !== 'offhand' }">
            <span class="slotname">{{ SLOT_LABEL[r.slot] }}</span>
            <template v-if="itemAt(r.slot)">
              <span class="item">{{ instanceName(itemAt(r.slot)) }}</span>
              <span class="rarity" :class="itemAt(r.slot).rarity">{{ itemAt(r.slot).rarity === 'blue' ? '稀' : '白' }}</span>
              <button class="mini" type="button" @click="unequip(r.slot)">卸</button>
            </template>
            <span v-else class="empty">{{ r.slot === 'mainhand' || r.slot === 'offhand' ? '（空）' : '未解锁' }}</span>
          </div>
        </div>

        <!-- 右：候选（点击名称 → 选中下方对比；点击"穿上" → 穿）+ 对比框 -->
        <div class="pane cand">
          <h4>候选中</h4>
          <div
            v-for="b in bag"
            :key="b.id"
            class="prow"
            :class="{ disabled: !canEquip(b), sel: selected === b }"
            @click="select(selected === b ? null : b)"
          >
            <span class="rarity" :class="b.rarity">{{ b.rarity === 'blue' ? '稀' : '白' }}</span>
            <span class="item">{{ instanceName(b) }}</span>
            <span class="sub">{{ baseOf(b.baseId).slot === 'mainhand' ? '主手' : '副手' }} · Lv.{{ baseOf(b.baseId).reqLevel }}</span>
          </div>
          <p v-if="!bag.length" class="bag-empty">背包空</p>
        </div>
      </div>

      <!-- 对比/穿上框：选中候选后出现；提升标注放名称后面 -->
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
          <span class="delta" :class="{ down: Number(compareDelta(selected).plus.replace('~', ' ').split(' ')[0]) < 0 }">
            {{ compareDelta(selected).label }} {{ compareDelta(selected).txt }} <em>({{ compareDelta(selected).plus }})</em>
          </span>
        </div>
        <button class="btn-equip" type="button" :disabled="!canEquip(selected)" @click="equip(selected); selected = null">
          穿上
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.proto-wrap {
  max-width: 760px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 18px;
  position: relative;
}
.vtit { font-size: 13px; letter-spacing: 3px; color: var(--ember); margin-bottom: 10px; }

.powerbar {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
  background: var(--card-bg);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 12px 16px;
}
.pcell { display: flex; flex-direction: column; gap: 3px; font-size: 11px; color: var(--dim); }
.pcell b { font-size: 15px; color: var(--text); }
.pcell b.up { color: var(--ember); }
.pcell.dps b { color: var(--gold); font-size: 18px; }

.vacolor { background: var(--card-bg); border: 1px solid var(--line); border-radius: 4px; padding: 16px 18px; }

.rarity { font-size: 11px; letter-spacing: 1px; align-self: flex-start; border-radius: 2px; padding: 1px 6px; flex: none; }
.rarity.white { color: var(--dim); border: 1px solid var(--line); }
.rarity.blue { color: #7db3e8; border: 1px solid #7db3e8; }

/* == 选定版：圆环骨架 + 双列候选/对比 == */
.main { display: flex; flex-direction: column; gap: 18px; }
.ringzone { display: grid; place-items: center; }
.ring { position: relative; width: 260px; height: 260px; }
.node {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(var(--ang)) translateY(-104px) rotate(calc(-1 * var(--ang)));
  width: 62px; height: 52px; border: 1px dashed var(--line); border-radius: 3px; display: grid; place-items: center;
  font-size: 10px; text-align: center; color: var(--dim); background: var(--rail-bg); cursor: pointer; transition: border-color .15s;
}
.node:hover { border-color: var(--ember); }
.node.worn { border-style: solid; border-color: var(--gold); color: var(--text); }
.nlab { display: block; font-size: 10px; }
.nitem { font-size: 11px; color: var(--gold); }
.nempty { font-size: 10px; color: var(--dim); }
.core {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: 92px; height: 92px; border: 2px solid var(--ember); border-radius: 50%; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 3px; font-size: 11px; color: var(--text);
}
.core b { color: var(--gold); }

.panes { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.pane h4 { font-size: 12px; letter-spacing: 3px; color: var(--ember); margin-bottom: 10px; }
.prow { display: flex; align-items: center; gap: 8px; padding: 7px 0; font-size: 13px; font-family: inherit; }
.worn .prow { border-bottom: 1px dashed var(--line); }
.worn .prow.locked { opacity: 0.35; }
.worn .slotname { color: var(--dim); width: 42px; flex: none; }
.cand .prow { border: 1px solid var(--line); border-radius: 3px; padding: 7px 10px; margin-bottom: 6px; cursor: pointer; background: var(--rail-bg); }
.cand .prow:hover:not(.disabled) { border-color: var(--ember); }
.cand .prow.disabled { opacity: 0.35; cursor: not-allowed; }
.cand .prow.sel { border-color: var(--ember); background: var(--ash-3); }
.prow .item { color: var(--text); }
.prow .sub { margin-left: auto; font-size: 11px; color: var(--dim); }
.mini { border: 1px solid var(--line); background: none; color: var(--dim); border-radius: 2px; padding: 1px 8px; font-size: 11px; cursor: pointer; font-family: inherit; }
.mini:hover { color: var(--ember); border-color: var(--ember); }
.bag-empty { color: var(--dim); font-size: 12px; padding: 8px 0; }
.empty { color: var(--dim); font-size: 12px; }

/* 对比框：提升标注放在名称后面 */
.compare {
  display: grid; grid-template-columns: 1fr auto 1fr auto; align-items: center; gap: 14px;
  border: 1px solid var(--ember); border-radius: 4px; background: var(--rail-bg); padding: 12px 16px;
}
.ccol { display: flex; flex-direction: column; gap: 4px; }
.ccol .chk { font-size: 11px; letter-spacing: 2px; color: var(--dim); }
.ccol b { font-size: 14px; color: var(--text); }
.ccol.cur b { color: var(--dim); }
.delta { font-size: 12px; color: var(--ember); }
.delta em { font-style: normal; color: var(--gold); font-size: 11px; }
.delta.down { color: var(--dim); }
.arrow { color: var(--dim); font-size: 18px; }
.btn-equip {
  border: 1px solid var(--ember); background: linear-gradient(180deg, var(--ash-3), var(--ash-2)); color: var(--text);
  border-radius: 3px; padding: 8px 18px; font-family: inherit; letter-spacing: 3px; cursor: pointer;
}
.btn-equip:hover:not(:disabled) { color: var(--ember); }
.btn-equip:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
