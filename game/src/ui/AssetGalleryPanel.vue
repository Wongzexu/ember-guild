<script setup>
import { onBeforeUnmount, ref } from "vue";
import { FX_SHEETS } from "../data/fx-sheets.js";

const assets = [
  { name: "敌方标识", file: "bracket_enemy.png", variants: "1x / 2x" },
  { name: "友方标识", file: "bracket_friendly.png", variants: "1x / 2x" },
  { name: "敌方目标环", file: "target_ring_enemy.png", variants: "1x / 2x" },
  { name: "友方目标环", file: "target_ring_friendly.png", variants: "1x / 2x" },
  { name: "状态面板", file: "status_panel.png", variants: "1x / 2x" },
  { name: "敌方高亮", file: "status_highlight_enemy.png", variants: "1x / 2x" },
  { name: "单位阴影", file: "unit_shadow.png", variants: "1x" },
  { name: "敌方平台", file: "matchmaking_platform_enemy.png", variants: "1x / 2x" },
  { name: "友方平台", file: "matchmaking_platform_friendly.png", variants: "1x / 2x" },
  { name: "底栏背景", file: "bottom_bar_background.png", variants: "1x / 2x" },
  { name: "卡片背景", file: "card_background.png", variants: "1x / 2x" },
  { name: "弹窗边框", file: "frame_modal.png", variants: "1x / 2x" },
];

const fxAssets = [
  { name: "通用冲击", file: "fx_impact.png" },
  { name: "红色受击", file: "fx_impactred.png" },
  { name: "治疗", file: "fx_heal.png" },
  { name: "受击痕迹", file: "fx_damagedecal.png" },
  { name: "兽类抓咬", file: "fx_animalslash.png" },
  { name: "爪击斩击", file: "fx_clawslash.png" },
  { name: "剑气斩", file: "fx_crossslash.png" },
  { name: "碰撞火花", file: "fx_collision.png" },
  { name: "碰撞火花·红", file: "fx_collisionsparkred.png" },
  { name: "碰撞火花·绿", file: "fx_collisionsparkgreen.png" },
  { name: "碰撞火花·紫", file: "fx_collisionsparkpurple.png" },
  { name: "白色冲击（中）", file: "fx_impact2.png" },
];

const fxUrl = (file) => `/assets-runtime/duelyst/fx/${file}`;

// 点击播放：默认全部静态图集，点某个框只有它变动态（再点还原，点别的切换）。
const playing = ref(null);
let playStartedAt = 0;
let rafId = null;
const playClock = ref(0);

function toggleFx(file) {
  if (playing.value === file) {
    playing.value = null;
    cancelAnimationFrame(rafId);
    rafId = null;
    return;
  }
  playing.value = file;
  playStartedAt = performance.now();
  if (rafId == null) {
    const step = (now) => {
      playClock.value = now;
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
  }
}

// 播放中的瓦片样式：整循环 = 帧序列 + 600ms 尾帧停留，然后重播。
const FX_PREVIEW_MAX = 88;
function fxPlayerStyle(file) {
  const s = FX_SHEETS[file.replace(/\.png$/, "")];
  if (!s) return {};
  const frameMs = s.delay * 1000;
  const cycle = s.frames.length * frameMs + 600;
  const t = (playClock.value - playStartedAt) % cycle;
  const idx = Math.min(s.frames.length - 1, Math.floor(t / frameMs));
  const [x, y] = s.frames[idx];
  const scale = Math.min(1, FX_PREVIEW_MAX / Math.max(s.fw, s.fh));
  return {
    width: `${s.fw * scale}px`,
    height: `${s.fh * scale}px`,
    backgroundImage: `url(${fxUrl(file)})`,
    backgroundSize: `${s.sw * scale}px ${s.sh * scale}px`,
    backgroundPosition: `${-x * scale}px ${-y * scale}px`,
  };
}

onBeforeUnmount(() => {
  if (rafId != null) cancelAnimationFrame(rafId);
});

const assetUrl = (file) => `/assets-runtime/duelyst/ui/${file}`;
</script>

<template>
  <section class="asset-gallery">
    <div class="gallery-head">
      <div>
        <span class="eyebrow">SOURCE STUDY</span>
        <h3>远古素材库</h3>
      </div>
      <span class="count">41 文件</span>
    </div>
    <p class="gallery-note">Duelyst UI / FX · 当前仅作视觉考察</p>
    <div class="asset-grid">
      <figure v-for="asset in assets" :key="asset.file" class="asset-tile">
        <div class="asset-preview">
          <img :src="assetUrl(asset.file)" :alt="asset.name" loading="lazy" />
        </div>
        <figcaption>
          <strong>{{ asset.name }}</strong>
          <small>{{ asset.variants }}</small>
        </figcaption>
      </figure>
    </div>
    <div class="fx-head">
      <div>
        <span class="eyebrow">COMBAT FX</span>
        <h3>击中表现帧</h3>
      </div>
      <span class="count">9 组 · PNG + PLIST</span>
    </div>
    <p class="gallery-note">默认静态图集 · 点击瓦片动态逐帧播放（帧序/延时取自官方 PLIST），再点还原</p>
    <div class="asset-grid fx-grid">
      <figure v-for="asset in fxAssets" :key="asset.file" class="asset-tile fx-tile" :class="{ active: playing === asset.file }" @click="toggleFx(asset.file)">
        <div class="asset-preview fx-preview">
          <img v-if="playing !== asset.file" :src="fxUrl(asset.file)" :alt="asset.name" loading="lazy" />
          <span v-else class="fx-player" :style="fxPlayerStyle(asset.file)"></span>
        </div>
        <figcaption>
          <strong>{{ asset.name }}</strong>
          <small>{{ playing === asset.file ? "播放中 · 点击还原" : "点击播放" }}</small>
        </figcaption>
      </figure>
    </div>
  </section>
</template>

<style scoped>
.asset-gallery {
  width: 100%;
  max-width: 920px;
  margin: 0 auto;
  padding: 4px 0 24px;
}

.gallery-head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 8px;
}

.eyebrow {
  display: block;
  color: var(--dim);
  font-size: 9px;
  letter-spacing: 2px;
  margin-bottom: 4px;
}

.gallery-head h3 {
  color: var(--gold);
  font-size: 20px;
  letter-spacing: 5px;
}

.count {
  color: var(--ember);
  font-size: 10px;
  white-space: nowrap;
}

.gallery-note {
  color: var(--dim);
  font-size: 12px;
  margin: 8px 0 18px;
}

.asset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.asset-tile {
  min-width: 0;
  margin: 0;
  border: 1px solid var(--line);
  background: var(--card-bg);
  padding: 8px;
  box-shadow: var(--card-shadow);
  transition: border-color 0.15s ease, transform 0.15s ease;
}

.asset-tile:hover {
  border-color: var(--ember);
  transform: translateY(-2px);
}

.asset-preview {
  height: 96px;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: var(--ash-2);
}

.asset-preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
}

.fx-head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 8px;
  margin-top: 28px;
  border-top: 1px solid var(--line);
  padding-top: 18px;
}

.fx-preview {
  background: #26363a;
}

.fx-tile {
  cursor: pointer;
}

.fx-tile.active {
  border-color: var(--gold);
}

.fx-player {
  display: block;
  background-repeat: no-repeat;
  image-rendering: pixelated;
}

figcaption {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px;
  padding-top: 8px;
}

figcaption strong {
  overflow: hidden;
  color: var(--text);
  font-size: 12px;
  font-weight: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

figcaption small {
  color: var(--dim);
  font-size: 10px;
  white-space: nowrap;
}
</style>
