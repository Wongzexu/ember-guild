# M2 装备雏形 blueprint（map）

Label: wayfinder:map
Status: **完工（2026-08-30）——5/5 票全部解决，决策完备，路已清。可直接照 blueprint 动手实现装备系统。**
Implementation: **已实现（2026-08-31）**——五步清单走完：①数据层（items 8 基底/affixes 双池/regions 扩展）②equipment.js + 存档 v0.3 迁移 ③hero.js 四条接线 ④expedition.js attackCountdown 调度 + 掉落管线 ⑤背包·装备 tab（B 圆环+C 对比）；86 引擎测试绿 + build 过。实现期三决策（词缀池方案 A / 8 基底 / 掉率 40%+35%）与两处蓝图勘误（#03 示例攻速 1.12→引擎 1.08；原型盾池 flat_vit 违反 §5.3 安全注已排除）见 `docs/DECISIONS.md` 2026-08-31 条 + PENDING #15。
Effort: m2-equipment（用户口中的"M2 装备雏形"，GDD §15 第 196/197 行）

## Destination

一张**决策完备的 M2 装备雏形实现蓝图**：白/蓝装备（掉落→穿到英雄→战力变化）+ 攻速生效 + 护甲减伤，三者接线。验收 = GDD §15 M2 行「能打装备穿上，英雄变强可见」。交付物是决策（画清实现前所有未定分叉），不是代码；拿到蓝图即可直接动手写装备系统。

范围确认（charting 期间用户已拍板六项，推荐项全采纳）：

1. **含攻速接线**——M2 = 装备雏形 + nextAttackAt 时间戳调度（GDD §15 两行都归 M2）。
2. **白+蓝**：白=纯基底 0 词缀；蓝=从已定词缀池（NUMBERS §5.2/§5.3）随机 roll 1~2 条。M3 再加 Tier/史诗/传说/通货锻造/*Cast点。
3. **掉落管线**：击杀概率掉（白高/蓝低，对齐 §6 品质权重），只接「掉入背包 + 可穿戴」，不接商店/回收。
4. **8 槽数据结构全就位**（主/副/头/身/手/脚/戒/链），M2 实际可穿 = 主手武器 + 副手盾（铁砧=锤+盾）；其余槽禁穿、后续填。
5. **攻速 = nextAttackAt 时间戳 + 单个英雄**（M1 窄实现），留多英雄接口；攻速 = 武器BPS×(1+DEX/100)。
6. **护甲减伤同批接线**（装备端 K_甲=300，NUMBERS §4.1）——三防齐 2/3（抗性上线、护甲接线、闪避留 #14）。

## Notes

- **领域**：《挂机远征》M2 装备里程碑。来源文档：`docs/GDD.md` §15（里程碑表，M2=196/197 行）、`docs/WEAPONS.md`（武器/8 槽/词缀结构）、`docs/NUMBERS.md` §4.1（战斗公式）/§5（装备数据）/§6（通货掉率）/§3（属性成长）、`docs/SYSTEMS.md` §2（属性盘落位）、`docs/PENDING.md`（#11/#12 已关、#13/#14 挂起）、`docs/DECISIONS.md`。
- **上游已关**：#11 五倾向权重表 ✅、#12 战斗重写三件套 ✅（命中/闪避公式+桥位×3.5 已入引擎）。M2 站在 #12 之上。
- **下游挂起**：#13 M3 命中值词缀定价（M3 开工）、#14 三防依赖声明（M2/M3 同批——M2 接护甲后正好可再议）。本地图**不碰**这两张，只标交叉。
- **技能**：每张票按各自 Type 调对应技能（grilling / prototype / domain-modeling / research）；拿不准就同时调 grilling + domain-modeling。防御/gamerule 这类纯设计问答走 grilling；架构分叉（调度模型、数据形态）先 prototype 再 grilling。
- **约定**：纯决策地图，不产执行票；决策与文档用中文；验收标准写**可勾选清单**；用户偏好推荐项采纳率高，给推荐时可直接往推荐项收敛。**每 session 只解一张**（research 除外）；每张票做完把 gist 进 Decisions so far。
- **已定事实**（charting 期间确认）：8 槽/词缀池/BPS 阶梯/护甲 K_甲=300/品质权重 60-32-7.5-0.5 全部在 NUMBERS/WEAPONS 已有数值，本图只决定**怎么接线用**，不重定数值。

## Decisions so far

- [装备数据模型](issues/01-equipment-data-model.md)：✦ 双手武器=武器自身 `handedness: one|two` + 禁用副手槽（PoE DisableOffhandSlot 同构）；✦ 实例 id=单调自增主键（不占 rng）；✦ 实例存储=B 层叠——**实例对象**嵌 `hero.equipment`，背包只存未穿，穿走即移；✦ 词缀池独立 `affixes.json` 按部位分池；✦ M2 只穿 mainhand+offhand，其余 6 槽禁用占位。**存档 v0.2→v0.3：老 weaponId 铸成实例入 mainhand 并删字段**、hero.equipment 8 槽、meta.nextItemId=2。原型 equipment-model-proto.mjs。
- [装备→战力接线](issues/02-power-wiring.md)：✦ `heroAttackRange` 改读已穿主手 `base.damage`（废弃 weaponId 路径），区间=(base.damage+Σflat_phys)×(1+STR/100)×(1+Σ增伤%)；✦ 装备 `flat_str/dex/vit`（带 .stat）**折进 heroStats** → 自动流进 heroHitValue，零额外接线；✦ `heroAttackSpeed=武器bps×(1+DEX/100+Σ攻速词缀%+基底implicit攻速%)`；✦ 护甲 K_甲=300：`总护甲=Σ(基底+flat词缀)`、`armorReduction=1−300/(300+总护甲)`，敌方伤害两端分层乘法 `atk×(1−armorReduction)×(1−physRes)`，applyDamage 保持纯扣血。**配套约束**：+命中/Cast点 词缀丢 #13；armor_pct 乘区推迟 M3；**装备交互仅限非战斗态**；M2 用「基底+flat 护甲词缀」。原型 power-wiring-proto.mjs（lift 逻辑模块）。
- [攻速调度模型](issues/03-attack-speed-scheduler.md)：✦ **Arknights 式独立节奏**——无回合无「英雄→怪反击」耦合，每个英雄/怪各带 `attackCountdown`(ms) 相对倒计时，到点即出手（可 burst，`while<=0` 打满+余量）；`interval=1000/attackSpeed`。✦ 怪物纯时间驱动、数据=每 region.monster 加 `attackInterval`(ms) 默认 1000；**死亡即取消未出手**。✦ 每步固定轮转序（heroIds→monster 最后）保 rng 确定性（#12 契约不破）。✦ **不引入射程/距离判定**——family 轴只改 multiplier 永不进 timer。✦ M2 单英雄对单怪，多英雄（各自 countdown）+ 多怪口子留好。供 #05。
- [装备掉落管线](issues/04-drop-pipeline.md)：✦ **命名口径**：基底名固定、稀有度只加修饰词不换基底（蓝装="迅捷之铜锤"=铜锤基底+词缀；铁锤/大锤=并列基底类型非升级）。✦ 掉落率=每击杀 roll 一次、每区 `baseDropRate`（雾林 40%）；与品质权重独立。✦ 基底按 iLv 从池抽、与品质独立；品质(白/蓝)→词缀数(0/1~2)→weapon/shield 池。✦ **词缀防重复取最优**（同 affix 键去重留大值，不用前后缀分区）。✦ rng 次序=击杀内 `gold→掉落判定→品质→基底→词缀→spawn新怪`，共用 meta.rngState。✦ 交付=背包手动穿（非自动最优，配合 #02 仅非战斗态换装）。✦ 掉宝率词缀丢 M3。
- [装备面板与穿戴交互](issues/05-equip-panel-ui.md)：✦ **信息分层**：详情页装备区块=只读表格（槽位+装备名+稀有度，无战斗数字）；战斗数字全在装备页。✦ **装备页 = 背包 tab**（装备/其他）；候选区与 #01 B 层叠同源。✦ 入口=详情页装备区右上「穿戴装备」→跳背包·装备 tab。✦ **圆环槽位排布**：头顶(0°)→颈(45°)→副手(90°)→手(135°)→脚底(180°)→戒(225°)→主手(270°)→身(315°)，四锚点固定（身/颈已对调）。✦ 对比=B 圆环+C 双列，**提升标注后置**（`攻击区间 6–11 (+5~+8)`）。✦ **数据次序=先 stub 摆位后接 #01~#04 引擎**。原型 EquipPanelProto.vue。

## Not yet specified

（无——fog 全部通过 #01~#05 成票并解决。蓝图决策完备，可直接动手实现。）

## Out of scope

- **M3 词缀系统**（前缀/后缀/Tier I~III、史诗/传说、通货锻造/铸造台、Cast点）——词缀数值表已就位但 M3 才实现；M2 蓝装只借用 §5.2/§5.3 固定池随机。
- **元素/真伤/抗性曲线**（NUMBERS §4.4）——GDD §16 仍标 🔶，M2 战斗公式定稿配套，本图不碰。
- **闪避（AGI 饱和族）接线**——#14 三防依赖声明的范畴，本图只接护甲，闪避留 #14 同批。
- **多英雄/多队伍并行、离线装备结算、商店/装备回收、锻造台 UI**——M5+/M3，超出 M2 装备雏形。
- **#13 词缀定价、#14 三防检验**——各归 M3/M2-M3 同批，不在此图毕业。

---

## 交叉引用（来源文档）

| 想看 | 去哪 |
|------|------|
| M2 里程碑范围 | `docs/GDD.md` §15（196/197 行） |
| 武器 8 槽 / 词缀结构 / 形态 | `docs/WEAPONS.md` §8/§6/§4 |
| 战斗公式（攻击值/攻速/命中/减伤/抗性） | `docs/NUMBERS.md` §4.1 |
| 装备数据（基底阶梯/词缀池/稀有度/掉率） | `docs/NUMBERS.md` §5 + §6 |
| 属性成长/落位 | `docs/NUMBERS.md` §3 + `docs/SYSTEMS.md` §2 |
| 上游命中接线 | `game/src/engine/hero.js`（heroHitValue/heroDamageModifiers）、`expedition.js`（hitChance/standardAttackValue/enemyDodgeValue） |
