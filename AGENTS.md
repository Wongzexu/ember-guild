# AGENTS.md

《挂机远征》开发工作区指南。项目当前处于**规划阶段**（设计文档见 `docs/`），尚未写代码；方向定稿后按里程碑 M0→M7 推进（见 `docs/GDD.md` 第 15 章）。

## 项目文档地图

| 文档 | 用途 |
|------|------|
| `docs/CONCEPT.md` | 概念推导（世界观/核心循环/系统清单） |
| `docs/GDD.md` | 游戏设计文档 v0.2（系统 S1~S7） |
| `docs/NUMBERS.md` | 数值参考（经验曲线/战斗公式/装备词缀/通货） |
| `docs/ARCHITECTURE.md` | 技术架构（Vue 3 + Vite、纯函数引擎、无后端起步） |
| `docs/PLAN.md` | 规划流程（8 步已完成） |
| `docs/DECISIONS.md` | 决策日志 |
| `docs/adr/` | ADR（架构决策记录） |

## Agent skills

### Issue tracker

工作票以本地 markdown 文件形式存在于 `.scratch/<effort>/`（map + `issues/NN-<slug>.md`）。详见 `docs/agents/issue-tracker.md`。

### Domain docs

单上下文：根目录 `CONTEXT.md` + `docs/adr/`；游戏设计文档 `docs/GDD.md` / `docs/NUMBERS.md` 等同样视为领域来源。详见 `docs/agents/domain.md`。

## 规划期工作流

- 用 `/wayfinder` 规划超出一个 session 的大块工作（决策票地图，见 `docs/agents/issue-tracker.md` 的 Wayfinding operations）。
- 用 `/grilling`、`/grill-me`、`/grill-with-docs` 打磨设计与决策。
- 方向正式定稿前**不写代码**（唯一已确认决策，见 `docs/DECISIONS.md` 末条）。