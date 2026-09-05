# 挂机远征（Ember Guild）

架空奇幻题材的放置游戏：经营「余烬公会」这个英雄集结组织——招募英雄、派遣挂机远征、打造词缀装备，把组织写成编年史传说。

- 技术栈：Vue 3 + Vite · 纯函数引擎 · 无后端（localStorage 存档）· Vitest
- 当前阶段：M2 装备系统开发期（M0 空壳 / M1 首闭环已验收）

## 快速开始

```bash
cd game
npm install
npm run dev     # 开发服务器（即改即刷新）
npm test        # 引擎单测（vitest）
npm run build   # 生产构建
```

## 项目目录（最简）

```
ember-guild/
├── AGENTS.md                 # Agent 工作区指南（文档地图/工作流）
├── docs/                     # 设计文档（领域来源）
│   ├── GDD.md                # 游戏设计文档（主文档）
│   ├── NUMBERS.md            # 数值账本（公式/锚点/词缀/通货）
│   ├── SYSTEMS.md            # 体系全览（属性盘/两极/命闪/防御）
│   ├── HEROES.md / WEAPONS.md# 英雄 / 武器装备专档
│   ├── ARCHITECTURE.md       # 技术架构
│   ├── DECISIONS.md          # 决策记录（按日期追加）
│   ├── PENDING.md            # 待办与待决策（跨 session 唯一来源）
│   └── adr/                  # 架构决策记录（ADR）
└── game/                     # 前端工程
    ├── public/assets-runtime/ # 运行时素材（Duelyst 单位/特效）
    └── src/
        ├── engine/           # 纯逻辑层（tick/hero/xp/expedition/equipment/prng/save）
        ├── data/             # 数据表 JSON + 视觉映射 visuals.js
        └── ui/               # Vue 面板与战斗回放组件
```

## 文档导读

新手读 `docs/GDD.md`；查数字看 `docs/NUMBERS.md`；查"为什么这么做"看 `docs/DECISIONS.md`；查"还有什么没定"看 `docs/PENDING.md`。
