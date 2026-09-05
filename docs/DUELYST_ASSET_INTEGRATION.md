# Duelyst 美术与动画素材接入架构

本文档说明如何在《挂机远征》中使用 OpenDuelyst 的角色美术、动画和特效素材。

核心目标是：**使用 Duelyst 的视觉资源和技能设计参考，但不让项目依赖 Duelyst 的原始游戏代码、品牌或内容。**

---

## 1. 接入原则

Duelyst 只作为一个可替换的视觉资源包：

```text
游戏引擎决定发生了什么
        ↓
产生 CombatEvent
        ↓
表现层决定如何显示
        ↓
文字描述 / 数值变化 / Duelyst 动画
```

动画不能参与战斗计算。这样可以保证：

- 挂机结算不依赖动画播放。
- 离线收益可以直接计算。
- 动画加载失败时游戏仍然可以运行。
- 未来可以替换为其他素材包或纯文字模式。

## 2. 授权与素材前提

OpenDuelyst 仓库的 `LICENSE` 文件声明使用 **CC0 1.0 Universal**。按该授权声明，素材可以：

- 复制和修改。
- 用于个人项目和商业项目。
- 转换格式和裁剪。
- 放入闭源项目。
- 再分发修改后的版本。

CC0 不要求署名，但项目应保留素材来源记录，建议建立 `THIRD_PARTY_ASSETS.md`：

```md
## OpenDuelyst assets

Source:
https://github.com/open-duelyst/duelyst

License:
CC0 1.0 Universal

Animated sprite conversion:
https://github.com/Jordyfel/duelyst-animated-sprites-godot

License:
CC0 1.0 Universal
```

使用时仍需注意：

- CC0 不包含商标权。
- 不使用 `Duelyst` 名称、Logo 和品牌 UI 作为本项目内容。
- 原角色名、阵营名、卡牌名和剧情只作为远古史考据与素材追溯；进入本作时采用灾后语境和轻改写，不把原卡直接当作现世角色。
- 不让玩家误以为本项目是 Duelyst 官方作品或续作。
- 音乐、音效、字体和第三方依赖需要单独检查授权。
- 对外发布前保留原始下载版本、来源 URL 和授权文件。

推荐使用的主要资源目录：

- `app/resources/units`
- `app/resources/generals`
- `app/resources/fx`
- `app/resources/particles`
- `app/resources/icons`
- `app/resources/maps`
- `app/resources/tiles`

## 3. 推荐目录结构

在现有 `game/src` 规划下增加素材和表现层：

```text
src/
├── engine/
│   ├── combat.js              # 战斗结算
│   ├── skills.js              # 技能执行
│   ├── effects.js             # 通用效果执行器
│   └── events.js              # 战斗事件生成
├── data/
│   ├── heroes.json            # 角色定义
│   ├── skills.json            # 技能定义
│   ├── effects.json           # 状态和效果配置
│   └── animations.json        # 动画资源映射
├── assets/
│   ├── duelyst/
│   │   ├── units/
│   │   ├── effects/
│   │   ├── frames/
│   │   └── audio/
│   └── manifest.json          # 资源清单
├── presentation/
│   ├── textRenderer.js        # 文字表现
│   └── animationRenderer.js   # 动画表现
└── ui/
    └── CombatLog.vue           # 战斗日志
```

## 4. 角色数据与素材分离

角色定义不应直接绑定图片路径，而是绑定稳定的资源 ID：

```json
{
  "id": "ember_knight",
  "name": "余烬骑士",
  "class": "guardian",
  "skills": ["shield_bash", "ember_guard"],
  "visual": {
    "portrait": "duelyst_unit_042",
    "animationSet": "duelyst_unit_042"
  }
}
```

这样可以在不修改战斗逻辑的情况下更换角色图片、动画或整个素材包。

资源 ID 由运行时资源清单映射到 `public/` 下的实际 URL：

```json
{
  "duelyst_unit_042": {
    "portrait": "/assets-runtime/duelyst/units/unit_042/preview.webp",
    "animations": {
      "idle": "/assets-runtime/duelyst/units/unit_042/idle.webm",
      "attack": "/assets-runtime/duelyst/units/unit_042/attack.webm",
      "death": "/assets-runtime/duelyst/units/unit_042/death.webm"
    }
  }
}
```

存档只保存业务 ID，不保存实际素材路径：

```json
{
  "heroId": "ember_knight",
  "skillIds": ["shield_bash"],
  "level": 4
}
```

不要在存档中保存 `assets/duelyst/...` 这样的路径。

### 4.1 角色与技能不是固定绑定

Duelyst 的角色素材和技能素材不是一对一的完整绑定关系，通常分为三层：

1. 角色素材：角色图片、待机、攻击、移动、死亡动画，以及部分角色专属音效。
2. 技能和特效素材：技能效果、通用攻击特效、元素特效、召唤特效和音效。
3. 游戏数据映射：通过单位 ID、卡牌 ID 和效果 ID 将角色、技能与表现组合起来。

因此，不是每个角色都有一套完全专属的技能动画。许多技能会复用通用动作、粒子特效和音效。本项目也不应把角色固定绑定到一组技能动画，而应由表现映射器在运行时组合：

```text
角色 → 提供角色动作
技能 → 提供技能效果
表现映射器 → 将角色动作、技能特效和音效组合起来
```

例如：

```text
余烬骑士
├── animationSet: unit_042
│   ├── idle
│   ├── attack
│   └── death
└── skills
    └── shield_bash
        ├── effect: impact_shield
        └── sound: shield_hit
```

技能可以声明通用表现提示，而不直接绑定角色文件：

```json
{
  "heroId": "ember_knight",
  "skillId": "shield_bash",
  "presentation": {
    "actorAnimation": "attack_melee",
    "effect": "impact_shield",
    "sound": "shield_hit"
  }
}
```

这种设计允许：

- 同一个技能被多个角色使用。
- 同一个角色拥有多个复用通用特效的技能。
- 根据角色武器、职业或元素选择不同动作和特效。
- 没有专属动画时回退到通用动画。
- 纯文字模式跳过全部视觉和音频表现。

## 5. 技能数据模型

技能需要拆分为三个部分：

1. 玩家可读的名称和描述。
2. 引擎执行的效果。
3. 表现层使用的动画和特效。

示例：

```json
{
  "id": "shield_bash",
  "name": "盾击",
  "description": "攻击敌人，并有概率使其眩晕。",
  "cost": 20,
  "target": "enemy",
  "effects": [
    { "type": "damage", "amount": 35, "element": "physical" },
    { "type": "apply_status", "status": "stun", "duration": 2 }
  ],
  "presentation": {
    "animation": "attack_melee",
    "effect": "impact_shield"
  }
}
```

引擎只处理通用效果，例如：

- `damage`
- `heal`
- `apply_status`
- `summon`
- `move`
- `knockback`
- `modify_stat`

引擎不应该直接调用 Vue、图片、GIF 或动画播放器。

## 6. 战斗事件层

技能执行后应产生事件，而不是直接操作界面：

```json
{
  "type": "skill_used",
  "actorId": "ember_knight",
  "skillId": "shield_bash",
  "targetIds": ["enemy_01"],
  "results": [
    { "type": "damage", "amount": 35 },
    { "type": "status_applied", "status": "stun", "duration": 2 }
  ]
}
```

Vue 根据事件显示：

- 战斗日志。
- 伤害和治疗数字。
- 技能名称。
- 角色动画。
- 技能特效。

挂机或离线结算时，可以跳过逐帧动画，只生成汇总结果。

## 7. 动画映射层

角色动画使用独立映射表：

```json
{
  "duelyst_unit_042": {
    "idle": "units/042/idle",
    "attack": "units/042/attack",
    "move": "units/042/run",
    "death": "units/042/death"
  }
}
```

技能只引用通用动作名：

```json
{
  "animation": "attack_melee"
}
```

动画渲染器再根据角色的 `animationSet` 找到实际动画帧。技能代码不应直接写入 PNG、GIF 或 SpriteSheet 路径。

## 8. 音效与音乐

Duelyst 仓库也包含音频资源：

- `app/resources/sfx`：攻击、命中、死亡、装备、部署和 UI 等音效。
- `app/resources/music`：菜单、战斗和场景音乐。

音频应作为独立的表现层，不参与战斗计算：

```text
CombatEvent
├── TextRenderer       → 战斗文字
├── AnimationRenderer  → 角色动画和特效
└── AudioRenderer      → 音效和音乐
```

技能可以声明声音提示，但不直接绑定具体文件路径：

```json
{
  "id": "shield_bash",
  "presentation": {
    "animation": "attack_melee",
    "effect": "impact_shield",
    "sound": "shield_hit"
  }
}
```

音效映射表负责关联实际文件：

```json
{
  "shield_hit": "audio/sfx/shield_hit.ogg",
  "unit_death": "audio/sfx/unit_death.ogg"
}
```

建议将 Duelyst 的 `.m4a` 音频转换为项目自己的格式：

- `.ogg`：适合大多数浏览器和游戏场景。
- `.webm`：适合网页压缩。
- `.m4a`：可以保留，用于 Safari 或移动设备兼容。

音频系统需要支持：

- 音乐音量设置。
- 音效音量设置。
- 一键静音。
- 纯文字模式不加载或不播放音频。
- 页面隐藏和离线结算时不播放音效。
- 音频加载失败时不影响战斗结算。

仓库整体声明为 CC0，但音乐、音效、语音播报等内容仍应保留来源和许可证记录。角色语音、阵营播报和原游戏品牌相关音频建议谨慎使用，第一阶段优先采用通用的攻击、命中、死亡和 UI 音效。

## 9. 素材转换流程

Duelyst 资源常见格式包括 PNG SpriteSheet、`.plist` 帧数据、GIF 和特效图片。

推荐流程：

1. 先选择少量角色进行验证。
2. 读取 SpriteSheet 和 `.plist` 帧数据。
3. 转换为项目自己的统一帧数据格式。
4. 将素材放入 `game/public/assets-runtime/duelyst`。
5. 使用 CSS Sprite、Canvas 或图片序列播放动画。
6. 用 `manifest.json` 记录资源 ID、动作和帧信息。

GIF 适合快速原型，但长期使用 SpriteSheet 和帧数据更容易控制：

- 播放速度。
- 循环次数。
- 播放完成事件。
- 动画和战斗事件同步。
- 移动端资源加载。

不建议在项目运行时依赖 Duelyst 的 Cocos2d-JS、客户端或服务端代码。

## 10. 文字模式与表现层降级

每个技能都必须拥有文字表现。动画是增强效果，不是游戏逻辑的前提。

示例文字输出：

```text
余烬骑士使用「盾击」。
敌人受到 35 点物理伤害。
敌人被眩晕 2 秒。
```

动画加载失败时，应自动回退到文字和数值显示：

```text
技能事件
├── textRenderer.render(event)
└── animationRenderer.play(event)  # 失败时忽略，不影响结算
```

这也是项目保持“文字为主”的关键设计。

## 11. 第一阶段垂直切片

不要一开始接入全部素材。第一阶段先完成一个角色的最小链路，稳定后再扩展到三个角色。当前建议只准备：

- 1 个角色（首个切片为艾格雷姆）。
- 技能先不纳入本切片，后续扩展到 3 个角色时再加入。
- 待机、攻击、死亡三类动画。
- 伤害、治疗、眩晕三种效果。
- 文字战斗日志。
- 攻击、命中、死亡三类通用音效。
- 动画播放失败时的文字回退。
- 音效关闭时不影响战斗。
- 本地存档和读取。

需要验证的完整链路：

```text
角色数据
→ 使用技能
→ 引擎结算
→ 产生战斗事件
→ 显示文字日志
→ 播放动画
→ 保存状态
→ 刷新后恢复
```

只有这条链路稳定后，才逐步扩展角色数量、技能数量和特效数量。

## 12. 架构结论

现有的“Vue 3 + 纯函数引擎 + JSON 数据 + 本地存档”方向可以继续使用，只需补充：

1. `skills.json`：技能定义。
2. `effects.js`：通用技能效果执行器。
3. `events.js`：战斗事件生成。
4. `animations.json`：角色动作映射。
5. `animationRenderer.js`：动画播放适配器。
6. `audioRenderer.js`：音效和音乐播放适配器。
7. `THIRD_PARTY_ASSETS.md`：素材来源和授权记录。

最终，Duelyst 素材应当只是表现层的一种实现。即使全部动画被移除，角色技能、挂机结算、离线收益和存档仍然应该正常工作。

## 13. 个人素材目录 / Wiki

在正式挑选素材前，建议建立一个只供自己使用的本地素材目录。它的目的不是制作公开 Wiki，而是帮助快速浏览、比较和标记角色、动画、特效与音效。

推荐工作流：

```text
获取原始素材
→ 保留授权与来源
→ 整理目录
→ 转换动画和音频
→ 生成预览文件
→ 生成 JSON 索引
→ 使用本地页面浏览和筛选
→ 标记候选资源
→ 回写到游戏数据
```

### 13.1 第一步：建立工作区

当前阶段不建立独立素材项目，直接在游戏项目中管理已采用的运行时素材：

```text
ember-guild/
├── game/
│   ├── public/assets-runtime/  # 已采用的运行时素材
│   │   └── duelyst/
│   │       ├── units/
│   │       ├── effects/
│   │       └── audio/
│   └── src/data/               # 游戏资源清单
│       └── assets.json
└── docs/                       # 来源和许可证记录
```

原始素材和中间转换文件不进入游戏仓库；只将已采用的运行时素材放入
`game/public/assets-runtime/`，并在资源清单和来源记录中保留追溯信息。

### 13.2 第二步：获取素材来源

优先使用以下来源：

1. [OpenDuelyst 原始仓库](https://github.com/open-duelyst/duelyst)：获取完整原始素材、帧数据和许可证。
2. [FoundryVTT Duelyst Sprites](https://github.com/Unarekin/duelyst-sprites)：参考已转换的单位、特效、WebM 和音效目录。
3. [Godot Animated Sprites](https://github.com/Jordyfel/duelyst-animated-sprites-godot)：参考已解析的动画帧数据。
4. [Duelyst Wiki](https://duelyst.fandom.com/wiki/Duelyst_Wiki) 和 [Duelspot](https://duelspot.com/cards/)：参考原始角色和技能资料。

获取时记录：

- 来源 URL。
- 仓库或资源包版本、分支或提交号。
- 下载日期。
- 原始文件格式。
- 授权文件位置。
- 转换来源和转换工具。

### 13.3 第三步：先建立目录索引

不要先手工重命名全部文件。应先根据原始目录和帧数据生成机器可读的索引：

```json
{
  "id": "unit_042",
  "sourceName": "original_unit_name",
  "category": "unit",
  "animations": ["idle", "attack", "run", "death"],
  "effects": [],
  "sounds": ["attack", "hit", "death"],
  "preview": "/assets-runtime/duelyst/units/unit_042/preview.webp",
  "license": "CC0-1.0",
  "status": "unreviewed",
  "notes": ""
}
```

建议使用稳定的内部 ID，例如 `unit_042`，不要把原角色名当作项目 ID。原始名称可以保留在 `sourceName` 中，方便追溯。

### 13.4 第四步：生成可浏览预览

为每个资源生成低成本预览，而不是每次浏览时读取原始 SpriteSheet：

- 单张静态预览图：确认外形和比例。
- 循环 GIF 或 WebM：查看待机、攻击、移动和死亡动作。
- 特效预览：查看技能范围、元素颜色和持续时间表现。
- 音效试听按钮：播放攻击、命中、死亡和 UI 音效。

预览文件放入 `game/public/assets-runtime/duelyst/units/`，原始素材和中间文件不进入游戏仓库。

对于网页目录和游戏运行时，优先直接使用兼容的 WebM、GIF 或 WebP；只有格式、体积或浏览器兼容性不满足要求时，才转换为其他运行时格式。

### 13.5 第五步：建立本地浏览页面

目录页面可以使用项目当前的 Vue 3 + Vite 技术栈，作为游戏项目内的开发辅助页面，不参与战斗逻辑。

页面至少提供：

- 关键词搜索。
- 角色、特效、音效分类筛选。
- 阵营或原始分类筛选。
- 动作类型筛选。
- 是否有专属特效筛选。
- 是否有攻击、死亡和音效筛选。
- 收藏、候选、已采用、弃用状态。
- 备注和新名称记录。
- 一键复制内部 ID。

资源卡片建议展示：

```text
预览动画
内部 ID
原始名称
可用动作
可用音效
候选状态
备注
```

### 13.6 第六步：人工筛选和重新命名

目录中的筛选信息与游戏数据分开保存。可以在目录里记录：

```json
{
  "id": "unit_042",
  "status": "candidate",
  "projectName": "余烬骑士",
  "role": "hero",
  "preferredAnimations": ["idle", "attack", "death"],
  "notes": "适合作为近战守护者，攻击动作清晰。"
}
```

推荐状态流转：

```text
unreviewed → candidate → adopted
                      ↘ rejected
```

原始角色名、原阵营名和原技能名可作为远古史考据线索；本项目公开叙事采用轻改写后的灾后称谓和语境，并保留来源映射。

### 13.7 第七步：回写游戏资源

确定采用某个资源后，再将它登记到游戏自己的资源清单：

```json
{
  "id": "ember_knight",
  "visual": {
    "portrait": "unit_042",
    "animationSet": "unit_042"
  },
  "skills": ["shield_bash"]
}
```

游戏只读取自己的内部 ID 和处理后的运行时资源，不依赖原始 Duelyst 目录结构。

### 13.8 推荐实施顺序

第一阶段只做本地目录的最小版本：

1. 获取 10 个单位和少量特效。
2. 生成静态图和待机、攻击、死亡预览。
3. 生成 `units.json` 和 `manifest.json`。
4. 制作一个可以搜索和播放预览的 Vue 页面。
5. 增加候选、已采用和备注字段。
6. 再加入音效试听。
7. 最后扩展到完整单位、特效和音频目录。

不要一开始就手工整理全部 600 多个单位。先验证“导入、预览、筛选、标记、回写”的工具链，再批量处理完整素材。

### 13.9 素材目录的边界

素材目录和资源清单属于游戏项目的一部分：

- 只保留已采用的运行时素材和必要的预览文件。
- 原始素材和大量中间文件不进入游戏仓库。
- 不影响游戏存档格式。
- 不要求玩家安装额外工具。
- 游戏直接读取自己的内部 ID 和本地资源路径。

如果未来需要批量管理全部素材，再考虑建立独立素材项目；当前阶段不引入额外仓库、Submodule 或 npm workspace。

## 14. 原游戏实现参考：攻击动画与命中对齐（源码调研 2026-09-01）

调研对象：OpenDuelyst 客户端源码 `app/view/nodes/cards/UnitNode.js` / `EntityNode.js`（Cocos2d-JS 3.3）。

### 14.1 结算先行，动画纯播放

- 伤害在 SDK 引擎层（`SDK.AttackAction` / `SDK.DamageAction`）先行结算完毕，客户端只做演出：受击方伤害数字直接读 `action.getTotalDamageAmount()` 跳字。与本项目 §1「动画不参与战斗计算」原则一致。

### 14.2 动画 = 动作序列，无逐帧事件系统

- 单位动画从 SpriteSheet + plist 缓存进 `cc.animationCache`；攻击时拼 `cc.sequence(攻击动画 → 播完切回下一状态)`，再乘**全局攻速系数** `CONFIG.ENTITY_ATTACK_DURATION_MODIFIER` 调快慢。
- 每个 `showXxxState()` 方法**返回自身时长**，上层按返回值将「攻击 → 受击 → 死亡」的动作排队串联。

### 14.3 命中对齐是"粗对齐"

- 命中音效用素材元数据字段 `attackReleaseDelay` 做延迟触发（`cc.delayTime(releaseDelay)` 后播 release 音效）——原游戏未做帧级命中标记，而是在资源里标一个延迟值近似"挥中瞬间"。
- 受击方不等攻击方：引擎事件（DamageAction）到达即独立播 damage 动画 + 跳字，靠动作序列排时对齐。

### 14.4 对本项目的启示

- **不需要帧级命中系统**：帧号精确绑定属于可选增强；原游戏同级精度 = 事件排队 + 每个素材标一个"命中时刻"偏移（类似 `attackReleaseDelay`，可存入 `visuals.js` 的素材映射）。
- video + playbackRate 方案配合「受击表现由事件独立驱动」即可达到原游戏同级对齐精度；多单位同屏再迁移 SpriteSheet + Canvas 帧时钟（见 §9），迁移成本由事件层隔离。
- 前置工作仍是结构化 CombatEvent（§6）：`type / actorId / targetId / results`，事件驱动的表现层可随时换渲染器。

## 15. 素材库势力速查（选型参考 · 待按需修订）

> 来源：`app/resources/units/` 目录前缀（2026-09-01 查看）。仅作内部选型参考，势力名/角色原名不进本项目公开内容（§2 红线）。数量为约数，后续按需校正。

| 前缀 | 势力 | 风格关键词 | 选型备注 |
|---|---|---|---|
| `f1_` | Lyonar Kingdom 莱昂纳尔王国 | 圣光·骑士·狮子·守卫 | 人形单位多，适合英雄/近战敌人 |
| `f2_` | Songhai Empire 松海帝国 | 和风·忍者·灵狐·法术 | 动作飘逸，适合敏捷系 |
| `f3_` | Vetruvian Empire 维斯特凡帝国 | 沙漠·法老·风沙·圣甲虫 | 异域感强，适合荒漠区域 |
| `f4_` | Abyssian Host 深渊宿主 | 恶魔·暗影·亡灵·触手 | 经典"怪"来源，低级怪到 Boss 都有 |
| `f5_` | Magmar Aspects 玛格玛 | 熔岩·巨兽·恐龙·原始 | 体格大，适合重型/Boss 敌人 |
| `f6_` | Vanar Kindred 瓦纳尔亲族 | 冰雪·北欧·狼·元素 | 适合寒霜区域（frost-pass 类） |
| `neutral_` | 中立 | 石像鬼·野兽·机械·人偶 | 数量最大的一池，通用怪首选 |
| `boss_` | 特殊 Boss | 各色巨型单位 | 头目战候选 |
| `critter_` | 小动物 | 微型单位 | 装饰/低级杂鱼候选 |

每个单位为 `PNG SpriteSheet + .plist 帧数据`，常见动作含 idle / attack / run / death（不是每个单位齐全，选型时核对）。
