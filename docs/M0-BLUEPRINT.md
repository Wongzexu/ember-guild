# M0 空壳实现蓝图（BLUEPRINT）

> 状态：✅ **已完成验收**（2026-08-26，5/5 全勾）；过程档案，仅供追溯
> 来源：wayfinder 地图 `.scratch/m0-shell/map.md` + 4 张决策票全部解决
> 前置：方向已定稿（`docs/DECISIONS.md` 2026-08-26 条目），用户点头进入 M0

---

## 1. 目标与验收

**目标**（GDD §15 M0）：项目骨架 + Tick 引擎 + 存档 + 界面框架。

**验收清单**（逐条可勾选）：

- [x] `git init` 完成，docs/ 已提交
- [x] `npm run dev` 能起，浏览器打开看到组织面板（B 卷轴首页形态）
- [x] `npm run build` 通过
- [x] `npm run test`：6 条引擎单测全通过
- [x] 手动刷新 / 关页重开 ×3，组织面板内容不丢

---

## 2. 技术栈（既有决策，不变更）

- **前端**：Vue 3 + Vite（JS 起步，无 Pinia）——见 `docs/ARCHITECTURE.md` §2
- **后端**：无后端起步，SaveAdapter 接口预留——§3
- **引擎**：纯函数 `tick(state, dt) → newState`，单一 JSON 快照，固定随机种子——§1/§4.3
- **测试**：Vitest
- **图标**：game-icon-pack（CC0，800+ 圆角 SVG），**本地 vendor 进 `game/`**，不依赖 CDN；用仓库根目录 `Icon_Catalog.json` 检索挑名；M0 只取组织面板所需十几个（火焰/卷轴/金币/星/盾/背包/锤/书/罗盘/人群 等）

---

## 3. 目录与文件清单

```
my-deskgame/
├── docs/                      # 已有
└── game/                      # 本里程碑创建（脚手架默认产物保留）
    └── src/
        ├── main.js            # 入口：装配引擎+存档+UI
        ├── App.vue            # 布局壳（B 形态：顶栏/中央/右侧）
        ├── engine/
        │   ├── core.js        # tick 循环、时间换算（M0 只累计 meta.totalPlayMs）
        │   └── save.js        # 存档/迁移/适配器接口
        │   ├── core.test.js   # 3 条用例（与源码并列）
        │   └── save.test.js   # 3 条用例
        ├── ui/
        │   ├── OrgPanel.vue   # 组织面板（编年史中心）
        │   └── icons/         # vendor 的 game-icon-pack SVG
        └── style.css
```

**不建空文件**：combat/loot/craft/prng/data/其余组件全部 M1+ 按需建（ARCHITECTURE §6 的完整清单是未来形态，不是 M0 目标）。

---

## 4. 状态快照与存档

**7 个顶层键全量骨架**（空部分用空数组/对象占位，M1 填内容时存档结构不用迁移）：

```jsonc
{
  "version": "0.1.0",
  "org": { "name": "余烬公会", "level": 1, "legend": 0, "gold": 0, "materials": {} },
  "heroes": [],
  "parties": [],
  "inventory": { "gold": 0, "materials": {}, "items": [] },
  "chronicle": [
    { "t": 0, "text": "灰烬纪元·元年：余烬公会于雅尔多拉成立。风起于余烬，传奇待书写。", "legend": 0 }
  ],
  "unlocks": {},
  "meta": { "createdAt": 0, "lastSavedAt": 0, "totalPlayMs": 0, "rngSeed": 12345 }
}
```

**存档规则**：
- localStorage 键：`ardora_save_v1`
- 时机：每 30 秒自动存 + 首建即存 + `beforeunload` 关页前即存
- `version` 字段 + `migrate(oldState)` 桩（版本不匹配走迁移或明确报错）
- `rngSeed` 写死 12345（PRNG 模块 M1 掉落时实现，字段现在就固定）

---

## 5. 界面规格（B 卷轴·编年史中心，首页形态）

**原型资产**：`.scratch/m0-shell/prototype-org-panel.html`（Variant B；A/C 变体保留为档案）

- **顶栏**：组织名「余烬公会」+ 等级 / 传奇度 / 金币
- **中央**：编年史卷轴大卡（"灰烬纪元·元年"标题 + 首条文案 + "编年史官·首记"署名）
- **右侧**：编年史时间线（当前条目高亮）+ 英雄/远征/背包等入口（占位"敬请期待"）
- 深色史诗基调（炭黑 + 余烬橙 + 金色 + 羊皮纸色）
- **后续形态既定**（本里程碑不实现）：A 指挥桌 = 详情页大页面（M1+ 英雄/远征详情）；C 仪表盘 = 小窗（M7 Electron"摸鱼小窗"）

---

## 6. 测试方案

- **框架**：Vitest（脚手架加依赖）
- **文件**：`core.test.js` / `save.test.js` 与源码并列（默认扫描，零配置）
- **scripts**：
  - `npm run test` → `vitest run`（验收可复现）
  - `npm run test:watch` → `vitest`（开发热跟）
- **6 条用例**：
  1. `tick(state, 0)` → 状态不变
  2. `tick(state, 500)` → `totalPlayMs` +500（0.5s tick）
  3. 连续多次 tick → 时间正确累计
  4. `save` → `load` 往返 → 深比较一致
  5. 载入无存档 → 返回 null（触发首建路径）
  6. 存档 `version` 不匹配 → 走 `migrate` 桩（或明确报错）

---

## 7. 实施顺序建议

1. `git init` + 提交 docs/（含本蓝图）
2. `npm create vite@latest game -- --template vue`，装依赖，加 Vitest（照 ARCHITECTURE §7 环境步骤，Node v24 已就绪）
3. 引擎：`core.js` + `save.js` + 两个测试文件 → `npm run test` 先绿
4. 界面：`App.vue` 布局壳 + `OrgPanel.vue`（B 形态）+ vendor 图标 + `style.css`
5. 装配 `main.js`（30s 定时存 + beforeunload + 首建）
6. 按第 1 节验收清单逐条过，全勾即 M0 完成

---

## 8. M0 → M1 手交面

M0 交付：可跑的骨架、7 键快照格式、存档链路、B 形态组织面板、6 条引擎单测。

M1 起点（首闭环：组织壳 + 1 名英雄 + 出征挂机 + 金币/经验）：
- `heroes` / `parties` 空骨架开始填内容
- 新建 `prng.js`（种子随机数，字段已就位）
- 起步 `data/*.json`（首批数据表）
- 详情页形态（A 指挥桌）随英雄/远征面板启用
- 离线结算与 `visibilitychange` 属 M2+，M1 不碰

---

## 附：本蓝图之外的既有约束

- `docs/ARCHITECTURE.md` 为技术权威文档，冲突时以架构文档为准并回改本蓝图
- 数值/数据全部放 `data/*.json`（M1 起），试错成本低
- 游戏名仍为占位《挂机远征》，正式名后置