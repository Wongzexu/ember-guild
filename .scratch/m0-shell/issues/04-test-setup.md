# 测试方案定案

Type: grilling
Status: resolved
Blocked by: 01

## Question

Vitest 在 M0 的具体落法（用户已确认"M0 就搭 Vitest + 引擎单测"，本票细化）：

- 哪些引擎模块先有测试：`core.js` 的 tick 推进（0.5s 步进、dt 累积）？`save.js` 的存档往返 + `version` 迁移桩？
- 测试文件位置与命名（`game/src/engine/__tests__/`？还是 `.spec.js` 并列？）。
- npm scripts：`dev` / `build` / `test` 三条怎么配。
- M0 验收清单里"引擎单测全绿"的具体条目（几条用例、覆盖什么场景）。

## Notes

- 产出物：蓝图中的"测试方案"章节 + 验收清单对应条目。
- 不依赖"M0 范围清单"与"组织面板原型"，可与它们并行。

## Answer

2026-08-26 五问全按推荐，测试方案闭环：

- **范围**：core.js + save.js 都测（M0 仅有的两个引擎模块）。
- **用例**：6 条——①tick(state,0) 状态不变 ②tick(state,500)→totalPlayMs+500 ③连续 tick 累计 ④save→load 往返深比较 ⑤无存档→null（首建路径）⑥version 不匹配→走 migrate 桩/明确报错。
- **位置**：`core.test.js` / `save.test.js` 与源码并列（Vitest 默认零配置扫描）。
- **scripts**：`test` = `vitest run`（验收可复现）、`test:watch` = `vitest`（开发热跟）。
- **验收表述**：M0 验收清单写"`npm run test` 6 条用例全通过"。