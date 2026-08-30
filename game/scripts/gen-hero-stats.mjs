// §3.5 投算表打印器：从引擎 heroStats() 逐级生成 markdown 表
// 用途：NUMBERS §3.5 的表永远由此脚本输出粘贴（引擎=唯一账本，文档=打印件）
// 用法：node scripts/gen-hero-stats.mjs
import { createHero, heroStats } from "../src/engine/hero.js";

const hero = createHero("anvil");

// §3.5 主表锚点（可增删；全量用 --all）
const anchors = [1, 5, 10, 15, 20, 30, 50, 99];

function statLine(level) {
  const h = { ...hero, level, xp: 0 };
  const s = heroStats(h);
  const note = talentNote(level);
  return `| ${level} | ${Math.ceil(s.str)} | ${Math.ceil(s.dex)} | ${Math.ceil(s.vit)} | ${Math.ceil(s.int)} | ${Math.ceil(s.agi)} | ${Math.ceil(s.maxHp)} | ${s.physRes.toFixed(1)}% | ${s.magRes.toFixed(1)}% | ${note} |`;
}

function talentNote(level) {
  if (level < 5) return "无词条（纯成长）";
  if (level < 10) return "天赋 Lv5 STR+5";
  if (level < 15) return "天赋 Lv5/10";
  if (level < 20) return "天赋 Lv5/10/15";
  if (level < 25) return "天赋 Lv5/10/15/20";
  return "天赋 Lv5→20";
}

console.log("| 等级 | STR | DEX | VIT | INT | AGI | HP | 物抗 | 法抗 | 备注 |");
console.log("|-----|-----|-----|-----|-----|-----|-----|------|------|------|");
for (const lv of anchors) {
  console.log(statLine(lv));
}
