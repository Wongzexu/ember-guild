# M0 空壳蓝图（map）

Label: wayfinder:map
Status: ✅ 完成（2026-08-26）——4/4 票解决，目的地已达成：交付 `docs/M0-BLUEPRINT.md`
Effort: m0-shell（用户口头称"W0"，即 GDD 第 15 章的 M0 空壳）

## Destination

一张**决策完备的 M0 空壳实现蓝图**：进入开发的闸门已过、范围边界已钉死、组织面板长什么样已定、测试方案已定——拿到蓝图即可直接动手写代码，无需再开任何决策。蓝图交付物是决策，不是代码。

## Notes

- **领域**：《挂机远征》开发首里程碑。来源文档：`docs/GDD.md`（第 15 章里程碑表）、`docs/ARCHITECTURE.md`（技术方案已写死大半）、`docs/DECISIONS.md`（唯一 ✅：方向定稿验收前不写代码）、`docs/PLAN.md`（第 2 节有 8 步"做对了"验收清单）。
- **技能**：每张票按各自 Notes 调用对应技能（grilling / prototype / domain-modeling）；不确定就同时调 grilling + domain-modeling。
- **环境事实**：Node v24.18.0、npm 11.16.0、git 2.43.0 已装；项目**未 git init**（决策：W0 一开始就 init，先提交 docs/）。
- **约定**：纯决策地图，不产执行票；决策与文档用中文；验收标准写**可勾选清单**；用户偏好 A 选项（推荐项）采纳率 100%，给出推荐时可直接往推荐项收敛。
- **已定骨架（charting 期间用户确认）**：M0 = 项目骨架 + Tick 引擎 + 存档 + 界面框架；进 M0 = 四区布局壳（顶栏/中央/左导航/右入口）+ 组织面板、存档 version + migrate 桩、编年史首条"组织成立"、Vitest 引擎单测；推迟 = PRNG、离线结算、data/*.json、导出/导入按钮；验收 = dev 能起 + build 能过 + 单测全绿 + 手动刷新不丢 ×3。

## Decisions so far

- [进入开发定案](issues/01-enter-development.md)：2026-08-26 用户点头，方向定稿进入 M0；DECISIONS/GDD 已更新，CONCEPT 陈旧表述已修。
- [M0 范围清单](issues/02-m0-scope.md)：7 键全量快照骨架；org.name=余烬公会+编年史首条文案；rngSeed 写死 12345；tick 只累计 totalPlayMs；engine 只建 core/save.js、ui 只建 App/OrgPanel.vue；存档 30s+首建+beforeunload，键 ardora_save_v1。
- [组织面板原型](issues/03-org-panel-prototype.md)：三形态定案——B 卷轴=首页（M0 实现）、A 指挥桌=详情页（M1+）、C 仪表盘=小窗（M7）；原型资产 .scratch/m0-shell/prototype-org-panel.html；图标用 game-icon-pack（CC0）本地 vendor。
- [测试方案定案](issues/04-test-setup.md)：Vitest 测 core+save 共 6 条用例；测试文件与源码并列；scripts=test（vitest run）+test:watch；验收表述"npm run test 6 条全通过"。

## Not yet specified

- **Vite 脚手架 2026 产物细节**（模板默认文件/版本号）：执行蓝图时照 ARCHITECTURE §7 走即可，不影响任何决策，暂不成票。
- **M0→M1 手交面**（蓝图收尾时顺带写清，暂不成票）。

## Out of scope

- **M1+ 功能**（英雄、出征、金币/经验、掉落、离线结算、PRNG、data/*.json 数据表、存档导出/导入、Electron）——全部超出"M0 空壳蓝图"这个目的地，属于后续里程碑各自的新 effort，不在此图上毕业。
- **游戏名/文案风格**——规划期已定"可后置"，与 M0 蓝图无关。