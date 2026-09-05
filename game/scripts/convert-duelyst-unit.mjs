// Duelyst 官方 SpriteSheet（PNG + Cocos2d plist）→ 项目统一 WebM 动画转换脚本
//
// 用法：
//   node scripts/convert-duelyst-unit.mjs <unitDir> <framePrefix> [--actions idle,attack,hit,death] [--fps 10] [--scale 6] [--canvas 512]
// 例：
//   node scripts/convert-duelyst-unit.mjs eigrem neutral_mercsworndefender
//   node scripts/convert-duelyst-unit.mjs blaze-hound neutral_beastphasehound
//
// 输入（必须已存在于 game/public/assets-runtime/duelyst/units/<unitDir>/）：
//   <framePrefix>.png    官方 SpriteSheet
//   <framePrefix>.plist  官方帧定义（TexturePacker/Cocos2d 格式）
// 输出（同目录）：
//   preview.png                     待机首帧放大图
//   <action>.webm                   每个动作一个 VP9+alpha WebM（10fps、512×512）
//
// 约定与既有运行时资源一致：512×512 / 10fps / yuva420p 透明通道。
// 帧来源：plist 中 <prefix>_<action>_<NNN>.png 命名的帧（未请求的动作忽略）。
// 依赖：devDependencies 中的 sharp（裁帧/缩放）与 ffmpeg-static（WebM 编码）。

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const bundledFfmpeg = require("ffmpeg-static");
const ffmpegPath = fs.existsSync(bundledFfmpeg)
  ? bundledFfmpeg
  : path.resolve(import.meta.dirname, "../node_modules/.ignored/ffmpeg-static/ffmpeg");

const UNITS_ROOT = path.resolve(import.meta.dirname, "../public/assets-runtime/duelyst/units");

function parseArgs(argv) {
  const args = { actions: ["idle", "attack", "hit", "death"], fps: 10, scale: 6, canvas: 512 };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--actions") args.actions = rest[++i].split(",");
    else if (rest[i] === "--fps") args.fps = Number(rest[++i]);
    else if (rest[i] === "--scale") args.scale = Number(rest[++i]);
    else if (rest[i] === "--canvas") args.canvas = Number(rest[++i]);
    else (args.positional ??= []).push(rest[i]);
  }
  return args;
}

// plist 的 frames 段为固定三段式结构，此处按 TexturePacker XML 格式做窄解析。
function parsePlistFrames(plistPath) {
  const xml = fs.readFileSync(plistPath, "utf8");
  const frames = {};
  const re =
    /<key>([^<]+\.png)<\/key>\s*<dict>\s*<key>frame<\/key>\s*<string>\{\{(-?\d+),(-?\d+)\},\{(\d+),(\d+)\}\}<\/string>[\s\S]*?<key>offset<\/key>\s*<string>\{(-?\d+),(-?\d+)\}<\/string>\s*<key>rotated<\/key>\s*<(true|false)\/>/g;
  let m;
  while ((m = re.exec(xml))) {
    frames[m[1]] = {
      x: Number(m[2]),
      y: Number(m[3]),
      w: Number(m[4]),
      h: Number(m[5]),
      offsetX: Number(m[6]),
      offsetY: Number(m[7]),
      rotated: m[8] === "true",
    };
  }
  return frames;
}

async function main() {
  const args = parseArgs(process.argv);
  const [unitDir, prefix] = args.positional ?? [];
  if (!unitDir || !prefix) {
    console.error("用法：node scripts/convert-duelyst-unit.mjs <unitDir> <framePrefix> [--actions ...]");
    process.exit(1);
  }

  const outDir = path.join(UNITS_ROOT, unitDir);
  const sheetPath = path.join(outDir, `${prefix}.png`);
  const plistPath = path.join(outDir, `${prefix}.plist`);
  if (!fs.existsSync(sheetPath) || !fs.existsSync(plistPath)) {
    console.error(`缺少官方资源：${sheetPath} 或 ${plistPath}`);
    process.exit(1);
  }

  const frames = parsePlistFrames(plistPath);
  const sheet = sharp(sheetPath);
  const { width: sheetW, height: sheetH } = await sheet.metadata();

  // 按动作分组：{prefix}_{action}_{NNN}.png，数字序播放
  const groups = {};
  for (const name of Object.keys(frames)) {
    const m = name.match(new RegExp(`^${prefix}_(\\w+)_(\\d+)\\.png$`));
    if (!m) continue;
    const [, action, idx] = m;
    (groups[action] ??= []).push({ idx: Number(idx), name });
  }
  for (const action of Object.keys(groups)) {
    groups[action].sort((a, b) => a.idx - b.idx);
  }

  const canvas = args.canvas;
  const tmpDir = fs.mkdtempSync(path.join(process.env.TMPDIR ?? "/tmp", "duelyst-convert-"));
  const written = [];

  for (const action of args.actions) {
    const group = groups[action];
    if (!group?.length) {
      console.warn(`跳过 ${action}：plist 中无 ${prefix}_${action}_* 帧`);
      continue;
    }
    const frameDir = path.join(tmpDir, action);
    fs.mkdirSync(frameDir, { recursive: true });

    for (let i = 0; i < group.length; i++) {
      const f = frames[group[i].name];
      if (f.rotated) throw new Error(`帧 ${group[i].name} 为旋转帧，脚本未支持`);
      if (f.x + f.w > sheetW || f.y + f.h > sheetH) throw new Error(`帧 ${group[i].name} 越界`);
      const content = await sharp(sheetPath)
        .extract({ left: f.x, top: f.y, width: f.w, height: f.h })
        .resize(f.w * args.scale, f.h * args.scale, { kernel: "nearest" })
        .png()
        .toBuffer();
      // 源帧中心 + plist offset（y 轴向下为正，与 Cocos 的 y 向上相反，此处符号取反）
      const left = Math.round((canvas - f.w * args.scale) / 2 + f.offsetX * args.scale);
      const top = Math.round((canvas - f.h * args.scale) / 2 - f.offsetY * args.scale);
      await sharp({ create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: content, left, top }])
        .png()
        .toFile(path.join(frameDir, String(i).padStart(3, "0") + ".png"));
    }

    const outWebm = path.join(outDir, `${action}.webm`);
    execFileSync(ffmpegPath, [
      "-y",
      "-framerate", String(args.fps),
      "-i", path.join(frameDir, "%03d.png"),
      "-c:v", "libvpx-vp9",
      "-pix_fmt", "yuva420p",
      "-b:v", "0",
      "-crf", "18",
      "-an",
      outWebm,
    ], { stdio: "pipe" });
    written.push(`${action}.webm（${group.length} 帧 @${args.fps}fps）`);
    console.log(`✓ ${unitDir}/${action}.webm`);

    if (action === "idle") {
      await sharp(path.join(frameDir, "000.png"))
        .resize(canvas, canvas, { kernel: "nearest" })
        .png()
        .toFile(path.join(outDir, "preview.png"));
      console.log(`✓ ${unitDir}/preview.png`);
    }
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log(`完成 ${unitDir}: ${written.join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
