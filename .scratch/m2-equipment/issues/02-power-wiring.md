# 装备→战力接线（攻击值/攻速/护甲）

Type: prototype
Status: resolved
Blocked by: 01

## Question

穿上装备后，装备的数值**如何进入英雄的战斗点算**，让「变强可见」落到实处？（依赖 #01 定好的数据形态，本票只决定接线公式，不重定数值。）

要答清的四条接线：

- **武器伤害区间**：`heroAttackRange(hero)` 现在只跟 `createHero` 的起始武器走（铜锤 1-3）。穿上新武器后，伤害区间怎么换成基础伤害区间？是覆盖 `heroAttackRange` 返回、还是加进 `heroDamageModifiers`？（#12 已把 hit 接线，但武器伤害未接。）
- **攻击值/命中加成**：词缀里的 "+力量/+敏捷" 是否进 `heroStats`？进了 `heroStats` 自然流进 `heroHitValue`（#12 已接）。命中值词缀（+命中/Cast点）M2 有没有？还是丢 #13？
- **攻速**：攻速词缀（+攻速%）目前只作为 `attackSpeedPct` 修正存在。接线后攻速 = 武器BPS × (1 + DEX/100 + Σ攻速词缀%)，这个公式现在就要进引擎吗（#04 攻速调度票依赖它）？
- **护甲减伤（装备端 K_甲=300）**：护甲从哪来（护甲词缀/防具基底），怎么进 `heroStats`，然后怎么进 `applyDamage` 的减伤（与属性端抗性率的乘积分层，SYSTEMS §6）？

## Notes

- 上游：`docs/NUMBERS.md` §4.1（战斗公式：攻击值/攻速/减伤/抗性）、`docs/WEAPONS.md` §5（武器固有词缀）/§6（词缀）、`docs/SYSTEMS.md` §6（两端分层）。引擎现状 = `game/src/engine/hero.js`（heroStats/heroHitValue/heroAttackRange/heroDamageModifiers/applyDamage）。
- 本票与 #04（攻速调度）强耦合：#04 需要攻速公式先定；本票的攻速公式要等 #04 确认接线形态。两者可在同一 session 解一张，但先解本票者优先。
- 产出物：蓝图中的「装备→战力接线」章节 + `heroStats`/`heroAttackRange`/`applyDamage` 如何改的伪代码。
- 优先：先 prototype（接线公式如何改代码），再 grilling 拍板。

## Answer

2026-08-30 解决（prototype 证实 + grilling 拍板，四条全采纳推荐）。产出物：`../power-wiring-proto.mjs`（逻辑模块可 lift 入 hero.js；演示层 throwaway）。

**四条接线（装备数值 → 战斗点算）：**

- **① 武器伤害区间**：`heroAttackRange` 改为读**已穿主手** `hero.equipment.mainhand.baseId` 的 `base.damage`（废弃旧 `weaponId`→`weaponDamage` 路径，#01 迁移已废 weaponId 字段）。区间 = `(base.damage + Σflat_phys) × (1 + STR/100) × (1 + Σ增伤%)`。
- **② +属性词缀**：装备 `flat_str/flat_dex/flat_vit`（带 `.stat` 字段）**折进 heroStats**，与现有天赋 flat/multi 同法 —— 自动流进 `heroHitValue`（DEX×10+主属性×5），零额外接线（原型 攻击值 208→218 证实）。**命中值词缀（+命中/Cast点）丢 #13**，M2 用 §5.2 池（无命中值词缀）。
- **③ 攻速**：`heroAttackSpeed = 武器bps × (1 + DEX/100 + Σ攻速词缀% + 基底implicit攻速%)`。BPS 取自已穿主手；盾无 bps。公式即入引擎，供 #04 调度用。
- **④ 护甲减伤（K_甲=300）**：`总护甲 = Σ(基底护甲 + flat护甲词缀)`；`armorReduction = 1 − 300/(300+总护甲)`。敌方伤害两端分层乘法：`atk × (1 − armorReduction) × (1 − physRes)`（§4.1 / SYSTEMS §6）。`applyDamage` 保持纯扣血；两段减伤在 `stepExpeditions` 算好（expedition.js:152 现 `(1 - s.physRes/100)` 处扩成两段）。

**三条配套约束（写进 #05 面板票）：**

- **Q1**：M2 不引入 +命中/Cast点 词缀（丢 #13）；蓝装 roll 走 §5.2/§5.3 已定池。
- **Q2**：装备 flat 属性折进 heroStats（非独立层）；换装会联动 maxHp/命中/攻速。
- **Q3**：M2 用「基底护甲 + flat 护甲词缀」，`armor_pct` 乘区语义推迟 M3 防具池落地再定（避免现造无感乘区）。
- **Q4**：**装备交互仅限非战斗态**（统一面板）；战斗/远征中禁换装/卸装。

> 演示复核（Lv5 艾格雷姆，命名口径 = #04「基底名固定·稀有度只加修饰词」）：初始白铜锤 1~3 伤害 / 攻速 1.12/s / 无盾；穿**蓝铜锤·迅捷之铜锤**（铜锤基底 +2力/+10%物伤）→ 攻击值 208→218（伤害区间仍 1~3，因铜锤基底伤害低、词缀是 STR/物伤桶）；再穿蓝木盾（护甲22/+3体）→ 减伤 6.83% / 物抗 6.54%，敌伤20 实收 18→17。双手大锤 handedness=two → offhand 强制空、伤害 11~18、攻速 0.90/s。基底不随品质升级——换更强的基底（铁锤/大锤）是换基底类型，蓝装只是给当前基底加修饰词。

**挂钩**：#04（攻速公式已在 #02 定）——#03/#04 阻塞解除前提达成。
