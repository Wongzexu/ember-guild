# 《挂机远征》技术架构文档（ARCHITECTURE）

> ✅ **技术选型已定稿**（2026-08-26，ADR-001 accepted：留 Vue 3 + Vite，不换 Godot）。
> **前端 = Vue 3 + Vite**；**无后端起步，预留云存档接口**；后期 Electron 桌面化。M0/M1 已按此实现并验收，当前 M2 装备系统开发中（86+ 引擎测试绿）。
> 版本 v0.3（对齐实况：存档 v0.4、engine/data/ui 实际清单）· 配套 GDD / NUMBERS。
> 本文件回答三个问题：用什么前端？要不要后端？代码怎么组织？

---

## 1. 架构总览（一张图看懂）

整个游戏就是**三层**，各管各的，互不越界：

```
┌───────────────────────────────────────────────┐
│  UI 界面层  (Vue 组件)                          │
│   组织面板 / 英雄详情 / 出征面板 / 背包 / 铸造台 │
│   只负责"把状态画出来"和"把玩家操作交给引擎"      │
└───────────────────┬───────────────────────────┘
                    │ 读取 state / 派发 action
                    ▼
┌───────────────────────────────────────────────┐
│  引擎层  (纯函数，无副作用，不碰界面)             │
│   tick(state, dt) → newState                    │
│   技能推进 / 战斗 / 掉落 / 词缀roll / 锻造 全在这 │
└───────────────────┬───────────────────────────┘
                    │ 读写
                    ▼
┌───────────────────────────────────────────────┐
│  数据层                                           │
│   data/*.json      静态配置（技能/装备/词缀/地图） │
│   SaveManager      存档：本地 localStorage（现在）│
│                    CloudSync 适配器（预留接口）    │
└───────────────────────────────────────────────┘
```

**核心铁律：引擎是纯函数** —— 同一个（状态 + 时间差）永远算出同一个结果。界面上所有变动都来自状态，状态就是"游戏的全部真相"。这带来 4 个白捡的好处：

1. 刷新/关页不丢（状态随时能存）。
2. 离线收益好算（时间差灌进引擎即可）。
3. 云存档是"白送的"（把状态快照发给服务器即可）。
4. 换界面皮肤不动游戏逻辑。

---

## 2. 前端选型：Vue 3 + Vite

| 项 | 选择 | 为什么 |
|----|------|--------|
| 框架 | **Vue 3**（Composition API，`<script setup>`） | 响应式绑定：状态一变，进度条/数字自动刷新，挂机游戏"每秒都在变"的 UI 会非常好写；官方文档有中文，资料多，上手压力小 |
| 构建 | **Vite** | 一条命令起开发服务器，改代码即改即刷新；也是 Vue 官方推荐的配套 |
| 语言 | **JavaScript**（初期） | 少了类型系统的学习负担，先把游戏做出来；后期想加 TypeScript 随时可以渐进引入 |
| 状态管理 | 不引入 Pinia（初期） | 初期就一个全局状态对象 + Vue `reactive` 足够；复杂度上来了再说 |

> 为什么不选裸 HTML/JS：挂机游戏每秒几十处数字刷新，手动操作 DOM 代码会指数级变臃肿、易出 bug。框架自动帮我们同步界面。

---

## 3. 后端策略：无后端起步 + 云存档预留

### 3.1 为什么无后端

- 纯单机玩法：所有计算（Tick、战斗、掉落、离线补发）本地即可完成。
- 省掉服务器、数据库、网络同步一整块复杂度，开发速度大幅提升。
- 离线收益在本地确定性结算，不需要服务器参与。

### 3.2 云存档如何"预留"（关键设计）

只要做到**把"游戏状态"和"怎么存"完全解耦**，云存档就是换一个适配器的事：

```
SaveManager
 ├─ LocalAdapter  (现在用)：state → localStorage（本机）
 └─ CloudAdapter  (未来加)：state → 服务器 API
```

接口形状（未来实现时照此写就行）：

```js
// src/engine/save.js 中定义统一接口，两种适配器都实现它
class SaveAdapter {
  async load() {}          // 返回存档快照，没有则 null
  async save(snapshot) {}  // 上传快照
  async merge(remote, local) {} // 冲突时合并（未来）
}
```

- **现在**：LocalAdapter，存 `localStorage`，每 30 秒自动存 + 关键事件即存。
- **未来**：想加云存档时写 CloudAdapter 调一个简单的账号接口，其余代码不动。
- 引擎按"无后端"设计，所以现在**完全不需要写任何服务器代码**。

---

## 4. 游戏状态与存档设计

### 4.1 状态快照结构（示例）

```jsonc
{
  "version": "0.7.0",          // 存档版本号，升级时迁移（0.1→0.2→…→0.7，见 save.js）
  "org": { "name": "余烬公会", "level": 1, "legend": 0, "gold": 0, "materials": {} },
  "heroes": [                  // 英雄（职业 + 五维 + visual 素材键 + 装备；无稀有度）
    { "id": "h1", "class": "anvil", "visual": { "portrait": "eigrem" },
      "level": 1, "xp": 0, "hp": 244,
      "base": { "str": 12, "dex": 8, "vit": 12, "int": 5, "agi": 7 },
      "bias": null,            // 策略倾向（M2 起接线，五倾向权重表）
      "equipment": { "weapon": "<实例id>", "offhand": null, "...": null } }
  ],
  "parties": [                 // 出征队伍（≤3 人/队）
    { "id": "p1", "heroIds": ["h1"], "regionKey": "mist_edge", "status": "expedition",
      "killCount": 0, "goldEarned": 0 }
  ],
  "inventory": { "items": [] },  // 装备实例池（weaponId 铸实例，meta.nextItemId 发号）
  "chronicle": [               // 编年史（史诗层）：只记固定里程碑，叙事文案、无数值
    { "t": 0, "text": "组织成立，招入第一名英雄…", "legend": 5 }
  ],
  "battleLog": [               // 战记（具体事件层）：战斗事实流水，滚动截断 300 条（DECISIONS 2026-09-04 两层分轨）
    { "t": 0, "text": "艾格雷姆 攻击 余烬猎犬，造成 3 伤害" }
  ],
  "unlocks": { "regions": ["mist_edge"], "events": [] },
  "meta": { "createdAt": 0, "lastSavedAt": 0, "totalPlayMs": 0,
            "rngState": 12345,       // PRNG 状态外置（纯函数步进，非 seed 重放）
            "nextItemId": 2 }
}
```

### 4.2 存档规则

| 规则 | 内容 |
|------|------|
| 自动保存 | 每 30 秒一次 + 触发"大事"（飞升/换图/锻造）时 |
| 版本迁移 | 存档带 `version`，载入时旧版本走 `migrate(oldState) → newState`，保证老档不废 |
| 导出/导入 | 提供"导出为 .json 文件 / 导入文件"按钮，玩家可备份、换浏览器 |
| 容量 | 词缀装备用紧凑数组存储，当前量级不会超过 localStorage 上限 |

### 4.3 随机数：固定种子（进阶但重要）

- 存档外置 PRNG 状态 `meta.rngState`（`game/src/engine/prng.js` 纯函数步进：`next(rngState) → (值, 新状态)`），所有掉落/词缀/命中/暴击随机都从这里派生。
- **rng 消耗次序 = 战斗契约**（如命中 roll → 伤害 roll，#3 Q4）——同一状态下逐 roll 可复现 → 未来云同步 / 离线结算 / 回放都精确一致，也方便测试数值。

---

## 5. 时间系统与离线收益（确定性算法）

### 5.1 在线

- 界面用 `requestAnimationFrame` 循环（或 100ms 定时器）累积真实时间差 `dt`。
- 引擎按 Tick（0.5 秒）步进：`state = tick(state, dt)`。
- 引擎内各支队伍（parties）并行推进：出征/采集/委托互不阻塞。
- 页面切后台（`visibilitychange` 事件）时记录时间戳，回来时按离线流程结算。

### 5.2 离线收益（结算公式）

```
启动时：
  离线时长 = now - 存档.lastSavedAt
  若 > 1 分钟，则对每个"挂机中的活动"结算：
    有效产出 = 离线时长 × 在线每秒产出 × 离线效率系数(默认 60%)
    经验    = 离线时长 × 在线每秒经验 × 0.6
  直接灌入存档，然后正常开始在线 tick。
```

- 上限保护：单次离线结算上限 **24 小时**（超出部分丢弃），防止几个月不玩回来数值爆炸；同时按"每秒产出"但封顶怪物击杀数/开箱数，避免一次结算卡死浏览器。
- 效率系数设计：离线 60% < 在线 100% → 鼓励在线，但不惩罚离线。

---

## 6. 目录结构（写代码后的样子）

```
my-deskgame/
├── docs/                    # 设计文档（现在）
│   ├── GDD.md
│   ├── NUMBERS.md
│   ├── DECISIONS.md
│   └── ARCHITECTURE.md
├── game/                    # 前端工程（M1 开始创建）
│   ├── index.html
│   ├── package.json
│   ├── vite.config.mjs      # 后续 Electron 打包时扩展
│   └── src/
│       ├── main.js          # 入口：装配引擎+存档+UI
│       ├── App.vue          # 根组件（布局：顶栏/技能栏/中央面板/背包）
│       ├── engine/          # 纯逻辑层（实际清单；每文件并列同名 *.test.js）
│       │   ├── core.js      # tick 循环、时间换算
│       │   ├── hero.js      # 英雄属性点算（heroStats：起始+曲线+天赋+装备 flat）
│       │   ├── xp.js        # 经验曲线（§2.1 锚点插值）
│       │   ├── expedition.js# 远征推进 + 战斗结算 + 命中/闪避管线（hitChance 等）
│       │   ├── equipment.js # 装备实例/穿戴校验/掉落 roll（M2）
│       │   ├── prng.js      # 种子随机数（rngState 纯函数步进）
│       │   └── save.js      # 存档/迁移/适配器接口（当前 v0.4）
│       │                    # craft.js（锻造/通货）M3 按需新建
│       ├── data/            # 数据表（纯 JSON，调数值只动这里）
│       │   ├── heroes.json     # 英雄（职业/成长/天赋/性格/visual 键）
│       │   ├── monsters.json   # 怪物（HP/伤害/分档/visual 键）
│       │   ├── regions.json    # 区域（产出/iLv/敌闪避分档 dodgeTiers）
│       │   ├── items.json      # 装备基底（M2 首批 8 基底）
│       │   ├── affixes.json    # 词缀池（M2 首批 weapon/shield 池）
│       │   ├── visuals.js      # 视觉映射：单位动画路径/时序(attackHitMs)/fx.impact
│       │   ├── currency.json   # 通货效果与掉率（M3）
│       │   └── crafting.json   # 铸造台配方（M3）
│       ├── ui/              # Vue 组件（实际清单）
│       │   ├── OrgPanel.vue / ProloguePanel.vue    # 组织面板 / 序章事件
│       │   ├── HeroListPanel.vue / HeroDetailPanel.vue  # 名册 / 英雄详情（A 形态）
│       │   ├── ExpeditionPanel.vue                  # 出征面板（战斗回放挂载点）
│       │   ├── InventoryPanel.vue                   # 背包·装备（M2）
│       │   ├── HeroVisual.vue / MonsterVisual.vue   # 单位动画组件
│       │   ├── ActionTestPanel.vue / AssetTimingPanel.vue / AssetGalleryPanel.vue  # 素材调试台
│       │   └── proto/                               # 面板原型存档
│       └── style.css
└── electron/                # M7 桌面打包时才建（占位说明）
```

---

## 7. 开发环境（M0 已照此完成；新机器复现照做即可）

1. 安装 **Node.js LTS**（免费，官网 nodejs.org 下载，装完命令行里 `node -v` 能打印版本号就算成功）。
2. 在项目根目录创建前端工程：`npm create vite@latest game -- --template vue`
3. 进入工程安装依赖：`cd game && npm install`
4. 启动开发服务器：`npm run dev` → 浏览器打开提示的地址（如 `http://localhost:5173`）→ **即改即刷新**。
5. 里程碑验收沿用各蓝图清单：M0（组织面板刷新不丢）✅、M1（出征后数字涨、刷新不丢）✅ 均已通过。

---

## 8. Electron 桌面化路径（M7，现在不用管）

- 到里程碑 M7，用 **electron-vite / electron-builder** 打包：
  - 主进程文件只负责"开一个窗口，加载游戏构建产物"。
  - 游戏本体代码（engine/data/ui）**一行不用改**。
- 同一份代码 = 浏览器版 + 桌面版，正好满足你"初期浏览器、后期程序"的要求。

---

## 9. 架构关键决策速查

| # | 决策 | 一句话理由 |
|---|------|-----------|
| 1 | 引擎=纯函数，状态=单一 JSON 快照 | 存档/离线/云同步/换皮全部白捡 |
| 2 | Vue 3 + Vite，JS 起步 | 响应式 UI 好写、中文资料多、后期可加 TS |
| 3 | 无后端起步 | 纯单机所有逻辑本地可算，开发最快 |
| 4 | 预留 CloudAdapter 接口 | 未来云存档=换一个适配器，不动逻辑 |
| 5 | 固定种子随机数 | 结果可复现，测试与云同步稳定 |
| 6 | 离线结算公式 + 24h 上限 | 确定性、防数值爆炸 |
| 7 | Electron 最后打包 | 浏览器先行，桌面零成本迁移 |