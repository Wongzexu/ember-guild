# 第三方素材来源与授权记录

> 依据 `docs/DUELYST_ASSET_INTEGRATION.md` §2/§7 建立。每次向 `game/public/assets-runtime/`
> 添加素材时，在本文件登记来源、授权与转换路径，保证可追溯。

## OpenDuelyst assets

**Source:**
https://github.com/open-duelyst/duelyst
（开发商 Counterplay Games 官方开源仓库）

**License:**
CC0 1.0 Universal（见上游仓库 `LICENSE`）

**Animated sprite conversion（转换参考）:**
- https://github.com/Jordyfel/duelyst-animated-sprites-godot （CC0 1.0 Universal）
- https://github.com/Unarekin/duelyst-sprites （FoundryVTT 转换，WebM/音效目录参考）

**已导入的运行时素材：**

| 路径（`game/public/assets-runtime/` 下） | 内容 | 授权 | 备注 |
|---|---|---|---|
| `duelyst/units/eigrem/preview.png` | 英雄静态预览图（512×512，idle 首帧） | CC0 1.0 | 原型：Duelyst `Sworn Defender`；由官方 SpriteSheet 经项目脚本转出 |
| `duelyst/units/eigrem/idle.webm` | 待机动画（512×512 VP9+alpha，10fps） | CC0 1.0 | 原型：Duelyst `Sworn Defender`；早期批次经第三方转换仓库转出（批次未记录） |
| `duelyst/units/eigrem/run.webm` | 奔跑动画（512×512 VP9+alpha，10fps） | CC0 1.0 | 原型：Duelyst `Sworn Defender`；由官方 SpriteSheet 经项目脚本转出（2026-09-02） |
| `duelyst/units/eigrem/attack.webm` | 攻击动画（512×512 VP9+alpha，10fps） | CC0 1.0 | 原型：Duelyst `Sworn Defender`；同上 |
| `duelyst/units/eigrem/hit.webm` | 受击动画（512×512 VP9+alpha，10fps） | CC0 1.0 | 原型：Duelyst `Sworn Defender`；由官方 SpriteSheet 经项目脚本转出（2026-09-01） |
| `duelyst/units/eigrem/death.webm` | 死亡动画（512×512 VP9+alpha，10fps） | CC0 1.0 | 原型：Duelyst `Sworn Defender`；同早期批次 |
| `duelyst/units/eigrem/neutral_mercsworndefender.png` | 艾格雷姆官方单位 SpriteSheet | CC0 1.0 | 官方内部资源名：`neutral_mercsworndefender`；原型卡牌：`Sworn Defender` |
| `duelyst/units/eigrem/neutral_mercsworndefender.plist` | 艾格雷姆 SpriteSheet 帧定义 | CC0 1.0 | 与同名官方 PNG 配套；包含 breathing/idle/run/attack/hit/death 帧 |
| `duelyst/units/eigrem/sfx_neutral_sunseer_attack_swing.m4a` | 攻击挥击音效 | CC0 1.0 | `Sworn Defender` 官方卡牌配置引用的原始音效，暂未接入 |
| `duelyst/units/eigrem/sfx_neutral_sunseer_attack_impact.m4a` | 攻击命中音效 | CC0 1.0 | `Sworn Defender` 官方卡牌配置引用的原始音效，暂未接入 |
| `duelyst/units/eigrem/sfx_neutral_sunseer_hit.m4a` | 受击音效 | CC0 1.0 | `Sworn Defender` 官方卡牌配置引用的原始音效，暂未接入 |
| `duelyst/units/eigrem/sfx_neutral_sunseer_death.m4a` | 死亡音效 | CC0 1.0 | `Sworn Defender` 官方卡牌配置引用的原始音效，暂未接入 |
| `duelyst/units/blaze-hound/preview.png` | 余烬猎犬静态预览图（512×512，idle 首帧） | CC0 1.0 | 由官方 SpriteSheet 经项目脚本转出（2026-09-01） |
| `duelyst/units/blaze-hound/idle.webm` | 待机动画（512×512 VP9+alpha，10fps） | CC0 1.0 | 由官方 SpriteSheet 经项目脚本转出（2026-09-01） |
| `duelyst/units/blaze-hound/run.webm` | 奔跑动画（512×512 VP9+alpha，10fps） | CC0 1.0 | 由官方 SpriteSheet 经项目脚本转出（2026-09-02） |
| `duelyst/units/blaze-hound/attack.webm` | 攻击动画（512×512 VP9+alpha，10fps） | CC0 1.0 | 由官方 SpriteSheet 经项目脚本转出（2026-09-01） |
| `duelyst/units/blaze-hound/hit.webm` | 受击动画（512×512 VP9+alpha，10fps） | CC0 1.0 | 由官方 SpriteSheet 经项目脚本转出（2026-09-01） |
| `duelyst/units/blaze-hound/death.webm` | 死亡动画（512×512 VP9+alpha，10fps） | CC0 1.0 | 由官方 SpriteSheet 经项目脚本转出（2026-09-01） |
| `duelyst/units/blaze-hound/neutral_beastphasehound.png` | 余烬猎犬官方单位 SpriteSheet | CC0 1.0 | 官方内部资源名：`neutral_beastphasehound`；原型卡牌：`Blaze Hound` / `Phase Hound` |
| `duelyst/units/blaze-hound/neutral_beastphasehound.plist` | 余烬猎犬 SpriteSheet 帧定义 | CC0 1.0 | 与同名官方 PNG 配套；含 breathing/idle/run/attack/hit/death 帧 |
| `duelyst/units/blaze-hound/sfx_neutral_beastphasehound_attack_swing.m4a` | 攻击挥击音效 | CC0 1.0 | 官方原始音效，暂未接入 |
| `duelyst/units/blaze-hound/sfx_neutral_beastphasehound_attack_impact.m4a` | 攻击命中音效 | CC0 1.0 | 官方原始音效，暂未接入 |
| `duelyst/units/blaze-hound/sfx_neutral_beastphasehound_hit.m4a` | 受击音效 | CC0 1.0 | 官方原始音效，暂未接入 |
| `duelyst/units/blaze-hound/sfx_neutral_beastphasehound_death.m4a` | 死亡音效 | CC0 1.0 | 官方原始音效，暂未接入 |
| `duelyst/units/blue-sting-scorpion/preview.png` | 蓝刺蝎静态预览图（512×512，idle 首帧） | CC0 1.0 | 由官方 SpriteSheet 经项目脚本转出（2026-09-02） |
| `duelyst/units/blue-sting-scorpion/idle.webm` | 待机动画（512×512 VP9+alpha，10fps，14 帧） | CC0 1.0 | 由官方 SpriteSheet 经项目脚本转出（2026-09-02） |
| `duelyst/units/blue-sting-scorpion/run.webm` | 奔跑动画（512×512 VP9+alpha，10fps，8 帧） | CC0 1.0 | 由官方 SpriteSheet 经项目脚本转出（2026-09-02） |
| `duelyst/units/blue-sting-scorpion/attack.webm` | 攻击动画（512×512 VP9+alpha，10fps，12 帧） | CC0 1.0 | 由官方 SpriteSheet 经项目脚本转出（2026-09-02） |
| `duelyst/units/blue-sting-scorpion/hit.webm` | 受击动画（512×512 VP9+alpha，10fps，3 帧） | CC0 1.0 | 由官方 SpriteSheet 经项目脚本转出（2026-09-02） |
| `duelyst/units/blue-sting-scorpion/death.webm` | 死亡动画（512×512 VP9+alpha，10fps，11 帧） | CC0 1.0 | 由官方 SpriteSheet 经项目脚本转出（2026-09-02） |
| `duelyst/units/blue-sting-scorpion/neutral_monsteronyxscorpion.png` | 蓝刺蝎官方单位 SpriteSheet | CC0 1.0 | 官方内部资源名：`neutral_monsteronyxscorpion`（原型卡牌 `Bluetip Scorpion` 复用 Onyx Scorpion 的单位资源）；拉取自 OpenDuelyst 提交 main 分支（2026-09-02） |
| `duelyst/units/blue-sting-scorpion/neutral_monsteronyxscorpion.plist` | 蓝刺蝎 SpriteSheet 帧定义 | CC0 1.0 | 与同名官方 PNG 配套；含 breathing/idle/run/attack/hit/death 帧（官方 frameDelay 0.08s/帧） |

### 已下载的 UI 参考素材

以下文件来自 OpenDuelyst `app/resources/ui/`，统一放在
`game/public/assets-runtime/duelyst/ui/`，用于评估战斗实体附近的血条、目标和面板表现。

| 文件组 | 用途 | 结论 |
|---|---|---|
| `bracket_enemy` / `bracket_friendly` | 敌我标识装饰 | 可作为实体阵营标识参考 |
| `target_ring_enemy` / `target_ring_friendly` | 目标选择环 | 可复用于选中/受击目标反馈 |
| `status_panel` / `status_highlight_enemy` | 状态面板和敌方高亮 | 可作为血条容器或状态提示的视觉参考 |
| `unit_shadow` | 单位脚下阴影 | 可增强角色与战斗场景的落地感 |
| `matchmaking_platform_enemy` / `matchmaking_platform_friendly` | 敌我平台 | 可评估是否适合作为战斗实体底座 |
| `bottom_bar_background` / `card_background` / `frame_modal` | 通用 UI 背景和边框 | 可拆取纹理语言，需避免原品牌布局 |

来源仓库：<https://github.com/open-duelyst/duelyst/tree/main/app/resources/ui>

来源版本：`main`，树 SHA `2843f2400854136598631288c2e8dfb8f5173de7`

> 当前目录中没有直接命名为 health bar 的成品素材。血条填充、当前/最大生命数字、受伤闪烁和掉血数字仍应由本项目表现层实现；上述 UI 资源主要用于边框、阵营、目标和场景装饰。

### 已下载的战斗特效帧

| 项目路径 | 原始用途 | 文件形态 |
|---|---|---|
| `duelyst/fx/fx_impact` | 通用冲击 | PNG SpriteSheet + PLIST |
| `duelyst/fx/fx_impactred` | 红色受击冲击 | PNG SpriteSheet + PLIST |
| `duelyst/fx/fx_heal` | 治疗 | PNG SpriteSheet + PLIST |
| `duelyst/fx/fx_damagedecal` | 受击痕迹 | PNG SpriteSheet + PLIST |
| `duelyst/fx/fx_animalslash` | 兽类抓咬攻击特效（30 帧，单帧 150×100） | PNG SpriteSheet + PLIST |
| `duelyst/fx/fx_clawslash` | 爪击攻击特效（5 帧，单帧 56×48） | PNG SpriteSheet + PLIST | 已接入：蓝刺蝎尾击命中特效（`visuals.js` fx.impact，偏移爪痕） |
| `duelyst/fx/fx_crossslash` | 剑气斩（23 帧，单帧 180×150；含银白单道剑刃光痕 + 星芒/碎片组合） | PNG SpriteSheet + PLIST | 备用未接线：M3 武器攻击伴随层候选——单手剑「剑气」形态 / 素色单道剑痕（需挑帧子序列） |
| `duelyst/fx/fx_collision` | 碰撞火花（白 14 帧 + 蓝 14 帧，单帧 80×56） | PNG SpriteSheet + PLIST | 白 14 帧已接入（烬雾魔精落点反馈）；蓝 14 帧经 `fx-sheets.js` `fx_collisionblue`（file 指向同一 png）接入艾格雷姆专属命中层 |
| `duelyst/fx/fx_collisionsparkred` | 碰撞火花·红（14 帧，单帧 80×56） | PNG SpriteSheet + PLIST |
| `duelyst/fx/fx_collisionsparkgreen` | 碰撞火花·绿（14 帧，单帧 80×56） | PNG SpriteSheet + PLIST | 备库未接线：#18 元素接线时按攻击元素选色 |
| `duelyst/fx/fx_collisionsparkpurple` | 碰撞火花·紫（14 帧，单帧 80×56；上游帧前缀拼写 `sparksrpurple`） | PNG SpriteSheet + PLIST | 备库未接线：#18 元素接线时按攻击元素选色（烬雾魔精紫色候选） |
| `duelyst/fx/fx_impact2` | 白色冲击（中，6 帧 50×50；同图集含橙色小冲击 5 帧未收录） | PNG SpriteSheet + PLIST | 已接入：艾格雷姆专属命中层（原版 `Sworn Defender` UnitAttackedFX = 蓝火花 + `fxImpactWhiteMedium`，fx.js:8422） |

来源目录：<https://github.com/open-duelyst/duelyst/tree/main/app/resources/fx>

> 素材库页面目前展示这些特效的原始帧图；正式战斗表现接入前，需要依据 PLIST 裁帧并转换为可播放动画。

### 原型对应关系

| 项目字段 | 记录 |
|---|---|
| 项目内部英雄 ID | `eigrem` |
| 项目公开名称 | 艾格雷姆（铁砧） |
| Duelyst 原始单位 | `Sworn Defender` |
| Duelyst 原始分类 | Neutral / Epic / Core Set |
| 原卡能力 | Whenever your General takes damage, fully heal this minion. |
| 原作背景资料 | Sworn Defenders 是 Consular Draug 的精锐护卫，在 Monolith 战场以誓约和塔盾保护 Draug。 |
| 卡牌资料 | https://duelyst.fandom.com/wiki/Sworn_Defender |
| 背景故事资料 | https://madquills.medium.com/commission-duelyst-lore-1b04613276aa |
| 原始素材仓库 | https://github.com/open-duelyst/duelyst |
| 动画转换参考 | https://github.com/Jordyfel/duelyst-animated-sprites-godot |
| 当前使用边界 | 视觉素材直接对应原型；世界观采用轻改写远古史，艾格雷姆的现世名字、职业、性格、台词和具体人生经历为本项目原创 |

首区怪物素材的项目名称与来源映射如下：

- 余烬猎犬 → Duelyst `Blaze Hound`（官方资源内部名 `neutral_beastphasehound`）
- 蓝刺蝎 → Duelyst `Bluetip Scorpion`

> 余烬猎犬追溯记录：OpenDuelyst 官方仓库提交 `2843f2400854136598631288c2e8dfb8f5173de7`，资源路径为 `app/resources/units/neutral_beastphasehound.{png,plist}` 与 `app/resources/sfx/sfx_neutral_beastphasehound_*.m4a`，拉取日期 2026-09-01。2026-09-01 已用项目转换脚本 `game/scripts/convert-duelyst-unit.mjs` 从官方 SpriteSheet 转出 preview.png + idle/attack/hit/death.webm（512×512、10fps、VP9 yuva420p 透明通道；帧前缀 `neutral_beastphasehound_*`，breathing/run 帧未使用），已接入播放层（`game/src/ui/MonsterVisual.vue`）。

> 艾格雷姆原始资源追溯记录：OpenDuelyst 官方仓库提交 `2843f2400854136598631288c2e8dfb8f5173de7`，资源路径为 `app/resources/units/neutral_mercsworndefender.{png,plist}`；`Sworn Defender` 卡牌配置引用的音效路径为 `app/resources/sfx/sfx_neutral_sunseer_*.m4a`，拉取日期 2026-09-01。现有 idle/attack/death.webm 已可用于运行时，但其历史转换批次仍未记录；hit.webm 与 preview.png 由同一转换脚本从官方 SpriteSheet 补齐/重制（帧前缀 `neutral_mercsworndefender_*`）。

### 转换脚本（保留可复现）

- 位置：`game/scripts/convert-duelyst-unit.mjs`
- 依赖：`sharp`（裁帧/最近邻缩放）+ `ffmpeg-static`（VP9 编码），均为 devDependencies
- 用法：`node scripts/convert-duelyst-unit.mjs <unitDir> <framePrefix> [--actions idle,attack,hit,death] [--fps 10] [--scale 6] [--canvas 512]`
- 统一输出规格：512×512、10fps、VP9（yuva420p 透明通道）、80×80 源帧 ×6 最近邻放大居中
- 重制既有文件：`node scripts/convert-duelyst-unit.mjs eigrem neutral_mercsworndefender --actions idle,attack,hit,death`

**已知缺口：** 上述文件的确切下载来源 URL 与转换工具版本未在导入当时记录，
此处仅能确认上游为 OpenDuelyst（CC0）。后续新增素材应保留原始下载版本、
来源 URL 与授权文件，避免再次出现追溯缺口。

## 使用注意事项（引自 §2）

- CC0 不包含商标权；不使用 `Duelyst` 名称、Logo 和品牌 UI。
- Duelyst 原角色名、阵营名、卡牌名和剧情作为远古史考据及素材追溯；现世内容采用灾后语境和轻改写。
  内部 ID 仍用 `unit_xxx` 类编号，原始名称记录在来源映射中。
- 不让玩家误以为本项目是 Duelyst 官方作品或续作。
- 音乐、音效、字体等后续引入的第三方内容需单独检查授权并登记于此。
