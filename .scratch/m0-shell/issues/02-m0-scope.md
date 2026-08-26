# M0 范围清单

Type: grilling
Status: resolved
Blocked by: 01

## Question

把 M0 空壳的范围钉成**可勾选清单**，作为蓝图的正文：

- **进 M0**（charting 已定骨架，本票细化）：四区布局壳 + 中央组织面板有内容、其余占位；存档带 `version` + `migrate` 桩；编年史第一条"组织成立"；Vitest + 引擎单测；git init + docs 先提交。
- **推迟（明确不进 M0）**：PRNG、离线结算/`visibilitychange`、`data/*.json`、导出/导入按钮。
- **待定细节（本票要答的）**：
  - M0 状态快照的精确形状——`org` 字段子集（name/level/legend/gold？materials 留不留？）、`meta` 哪些字段（rngSeed 现在写死还是省略？）、`chronicle` 首条文案与结构。
  - 存档节奏：30 秒自动存 + 关键事件即存（ARCHITECTURE §4.2 已写）是否原样进 M0。
  - 目录结构：是否照 ARCHITECTURE §6 建 `game/` 全骨架（engine 各模块文件先建空壳？还是只建 M0 用到的 core/save？）。
  - Tick 引擎最小规格：0.5s tick、`tick(state, dt) → newState` 纯函数，M0 阶段 tick 里推进什么（仅时间/编年史？还是空转？）。

## Notes

- 解析后：解锁"组织面板原型"（内容先定，外观后定）。
- 产出物：蓝图中的"M0 验收清单"章节 + 状态快照示例（照 ARCHITECTURE §4.1 裁剪）。

## Answer

2026-08-26 六问全按推荐，M0 范围闭环：

- **状态快照**：7 个顶层键全量骨架（org/heroes/parties/inventory/chronicle/unlocks/meta），空结构占位；`org.name = "余烬公会"`；chronicle 首条 = "灰烬纪元·元年：余烬公会于雅尔多拉成立。风起于余烬，传奇待书写。"；`meta.rngSeed = 12345` 写死（PRNG 模块 M1 实现）。
- **Tick 最小规格**：0.5s 步进，M0 只累计 `meta.totalPlayMs`（时间引擎真跑，为 M1 出征留接口）。
- **目录/文件**：engine 只建 core.js + save.js；ui 只建 App.vue + OrgPanel.vue；不建空文件；组件细拆等 03 原型定视觉后定。
- **存档**：30s 定时存 + 首建即存 + beforeunload 即存；localStorage 键 `ardora_save_v1`。
- 蓝图最终装配（docs/M0-BLUEPRINT.md）在地图全部票解决后一次性产出。