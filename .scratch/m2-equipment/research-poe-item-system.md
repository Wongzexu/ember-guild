# PoE 装备系统研究：物品实例 ID 与双手武器占槽

> 面向《挂机远征》M2 装备系统的研究子代理报告。目的一：确认 PoE 掉落装备的"唯一实例 id"到
> 底是什么、怎么生成、是否持久化；目的二：确认 PoE 双手武器"占两槽"的底层实现与 UI 呈现。
> **只做研究，不写产品代码。** 证据严格区分【确证事实】【社区旁证】【合理推断】。

---

## 一、PoE 掉落装备的唯一实例 ID

### 1.1 物品对象有唯一实例 id —— 存哪、什么字段

**确证事实：PoE 的 `Item` 类型有一个 `id` 字段，官方注明为"唯一的 64 位十六进制字符串"。**

来源（GGG 官方开发者文档，定义 Item／Character／PublicStashChange 三处一致）：

> `pathofexile.com/developer/docs/reference` → `### object Item`：
> `id | ?string | a *unique* 64 digit hexadecimal string`

> `### object PublicStashChange`：`id | string | a *unique* 64 digit hexadecimal string`
> `### object Character`：`id | string | a *unique* 64 digit hexadecimal string`

- 这个 `id` 是**物品实体层面**的字段，出现在 `Item` 顶层（与 `name`、`baseType`、`explicitMods`
  等并列），不是某个子对象。
- 字符长度=64 hex = 256 bit。这**不是**自增整型，而是"看起来随机"的长哈希（见 1.3）。
- 注意：**GGG 的公开 API 没有给物品暴露"槽位字段"**。`Character.equipment` 是 `array of Item`
  （`pathofexile.com/developer/docs/reference` → `equipment | ?array of Item`），API 层面只有
  "这堆物品属于该角色"，**没有**"这个物品装在哪个槽"。槽位归属是客户端/服务端内部的装备规则
  （见问题二）。`Item` 里的 `inventoryId`/`socket`/`colour` 属于 `ItemSocket`（镶嵌物），
  与装备槽无关（`### object ItemSocket`）。

### 1.2 这个 id 是稳定持久化的，还是运行时/会话级的

**确证事实（id 存在且被 API 反复作为"同一件物品"的句柄返回）。**

`pathofexile.com/developer/docs/reference` → `Public Stashes` 一节：
> "You can track stashes as they re-appear in the stream by comparing their
> PublicStashChange's `id` property. If a stash has been unlisted all details aside
> from the `id` and `public` parameters will be omitted."

以及 Trade API 中 search 与 fetch 两阶段用同一物品 id 关联（`nodejs`示例）：

> `GET /api/trade/search/{league}` 返回 `result: ["3dbcf983...", "ae6733f8..."]`，
> 之后 `GET /api/trade/fetch/ae6733f833...?query=yYJLQXOcR` 返回同一 `id`。
> —— `github.com/wgnodejsstudy/nodejs/issues/7`

这证明 **`id` 是稳定句柄**：同一次 listing 期间，物品在 stash 变更流 / trade 搜索 / fetch 三处
用的是同一个值，可用来跨 API 指向"这一件"。

**关于"是否跨交易/跨登录保持" —— GGG 未公开承诺，社区旁证指向"随所有权变化"。**

社区（r/pathofexiledev）观察：
> "[Question] PoE's Item ID. How does it work?"：
> "If it's the latter, I believe that Item ID is likely a hash of both the unique
> identifier for that item, and the unique identifier for the player."
> —— `reddit.com/r/pathofexiledev/comments/avpayh/`

> "PoE item Id question"：
> "From what I remember, the old ID is abandoned and a new ID is created when an item
> is traded to someone else. Another new ID will be used even if the same item is
> traded back to the first user again."
> —— `reddit.com/r/pathofexiledev/comments/57fzza/`

**判断**：`id` 作为"游戏内实例的唯一句柄"是稳定、可复用的（同一次 stash/listing 期间）；
但**是否跨玩家所有权永久不变，GGG 没有官方声明**，社区观察倾向于是"物品身份 + 所有者"的
哈希，因此换主人会变。**对我们的借鉴意义有限**——我们自己服务器是唯一所有者，这条不必纠结。

### 1.3 生成方式：自增 / 随机哈希 / 服务器ID+计数器

**确证事实：不是自增整型，而是 64-hex 的"指纹/哈希"外观。**

- 官方文档只说它是"unique 64 digit hexadecimal string"（`pathofexile.com/developer/docs/reference`）。
- GGG **从未公开**服务端物品实例 id 的生成算法（字段名、存储表结构均未公开）。反编译/数据挖掘
  工具（RePoE / PyPoE）导出的静态数据文件里**没有**实例 id 字段——它们只含基底、词缀、翻译等
  静态内容，因为实例 id 是运行时/服务端生成的，不在 GGPK 静态文件里：

> `github.com/brather1ng/RePoE`README：
> "The following data is currently available: ... base_items.json ... mods.json ..."
> —— 只列静态资源；无任何"实例/内部 id"。

**合理推断**：结合 64-hex + "随所有权变化"的社区观察，最可能是"服务端内部主键 / 内容指纹"再经
**哈希/混淆**后对外暴露（社区明确提出"obfuscate the canonical ID"这一动机，
见 1.2 的 avpayh 帖）。**不可能是自增序**（否则不会长这样、也不会被混淆）。

### 1.4 与游戏 RNG（掉落 roll / 词缀 roll）是否同一套随机源

**确证事实：物品 id 与词缀 roll 是两回事，不是同一套"随机源"能解释的。**

- 同一件物品在一次制造过程中的"哪些词缀、数值区间"由物品生成系统决定（PoE Wiki 引 GGG 帖）：
  - "On chancing / On dropping" —— `poewiki.net/wiki/Unique_item` 引用官方 forum 帖
    `pathofexile.com/forum/view-thread/485201`、`488664`。
- 而物品的"身份 id"是 1.2/1.3 说的那套：**用于跨 API 指代"这一件"，是身份句柄**，与
  "roll 出了几条什么词缀"不是一个概念。
- **推断**：二者大概率在服务端用同一套可复现 RNG 基础设施（否则无法防复制），但**语义上完全
  独立**：一条 roll 决定"这件的数值"，id 决定"这件的身份"。GGG 未公开二者是否共享种子。

**结论**：对我们而言，"掉落 roll 词缀"和"生成实例 id"应理解为**两个独立关注点**。

### 1.5 GGG 是否公开过物品实例存储/标识机制

**确证事实：GGG 公开发布的是 API 契约（Item.id 存在、64-hex、跨 API 复用），但从不公开内部
存储/主键/生成算法。** 社区对 PoE 物品数据库的公开分析：
- 物品静态数据（基底/词缀）有大量公开 dump（RePoE、exile-db、poedb），全都不含实例 id。
- 实例 id 只在**实时**的 trade / public-stash 响应里出现。
- `github.com/moepmoep12/exile-db`：README "only contains the tables and their schema without
  data ... The database is provided as a SQLite database" —— 仍是静态表。

---

## 二、PoE 双手武器占两槽的实现

### 2.1 基础槽位与"占两槽"的判定

**确证事实：双手武器是"装备在 Main Hand 与 Off Hand 两个槽位"的关键词，判定是武器自身的
类型/分类，而不是两个槽位引用同一件物品。**

来源（官方 wiki / PoE2DB 抓取）：

> `poewiki.net/wiki/Two_Handed`：
> "**Two Handed** is a keyword which applies to the use of weapons which take up both
> Main Hand and Off Hand equipment slots. Weapons which count as Two Handed: Bow /
> Staff / Two Handed Axes / Two Handed Maces / Two Handed Swords"

> `poe2wiki.net/wiki/Two-handed`：
> "Two-handed weapons take up both weapon slots when equipped." /
> "Two-Handed is a keyword that applies to weapons that can take up both the Main Hand
> and Off Hand equipment slots."

判定依据 = **武器基底自身的分类**：
> `poe2db.tw/us/Two-Handed`：`<Two-Handed>` "Two-handed weapons take up both weapon slots
> when equipped." —— 其反义词 `<One-Handed>` "One-handed weapons can be placed in the main
> weapon slot. Some one-handed weapon types can be dual wielded..."
> —— `poe2db.tw/us/One-Handed`

数据层面，单手/双手是物品基底的**固有属性**（handedness），不是运行时的槽位占用：
> `poe2ref.com/items`：每个武器基底的表格列明 `Category / Item class / Handedness / Attribute /
> Req. level`，例如 "Aberrant Sledge … Hand Two-Handed"、"Abyssal Flail … Hand One-Handed"。
> `repoe-fork.github.io/base_items/` 导出中同样把 "Two Hand Axe / Two Hand Mace / Two Hand Sword"
> 与 "One Hand Axe/..." 当作**独立的物品类（item class）**。

### 2.2 底层数据：一个 item，还是两个槽位引用同一件？

**确证事实：是一件 item 实体；"占两槽"是装备规则/UI 呈现，数据模型上不存在"两个 item 实体
或两个槽位都指向同一件"的双份结构。**

- **API 不变**：`Character.equipment` 仍是扁平 `array of Item`，双手武器跟单手武器在 API 里
  **都是"一个 Item"**，只是 `baseType` 不同（`pathofexile.com/developer/docs/reference`）。
- **占两槽的实现机制有明确的内部代号**：`DisableOffhandSlot`。

> `poewiki.net/wiki/Modifier:DisableOffhandSlot`：
> "DisableOffhandSlot is the internal ID of an unnamed modifier."
> `poe2wiki.net/wiki/Modifier:DisableOffhandSlot`、`pathofexile.fandom.com/wiki/Modifier:DisableOffhandSlot`
> 同样记载。另有 `Modifier:DisableOffHandSlotUnique__1`（唯一物品专用变体）。

这条"DisableOffhandSlot"就是**把副手槽禁用的内部机制**，是给武器/物品附加的一个"禁副手槽"
效果，而非"复制出第二个物品"。**这是本问题最关键的底层发现。**

- 服务器把槽位归类为"Inventories 表"（确认存在命名槽位 id，但双手武器只挂在主武器槽上）：

> `pathofexile.com/developer/docs/game` → `### object BuildInventorySlot`：
> `inventory_id | string | an Inventories table id. Example "Weapon1"`（另有
> "BodyArmour1"、"Boots1"、"Helm1" 等范例）。

  范例里武器槽叫 `Weapon1`，说明**主武器槽是一确定的 inventory id**；双手武器 = 填这个槽，
  副手槽（weapon2/offhand）被 `DisableOffhandSlot` 禁掉。

### 2.3 装备后副手槽 UI 显示什么

**确证事实（规则层面）：副手槽在双手武器下不可用，不能被放置副手武器；只有解除限制的机制
（Giant's Blood、带入 Rain）才能让双手武器"单手使"，从而空出副手槽。**

> `poe2wiki.net/wiki/Off_Hand`：
> "Off-hands cannot normally be used with two-handed weapons, though there are some
> effects that remove this restriction: Giant's Blood and The Bringer of Rain allow
> two-handed swords, axe, or maces to be wielded with one hand, allowing for an off
> hand item to be equipped with them."

> `poe2db.tw/us/Two-Handed`（Bringer of Rain 条）：
> "Can't use Body Armour … You can wield Two-Handed Axes, Maces and Swords in one hand"

**UI 显示**：副手槽显示为禁用/空（灰态占位），放不进武器或盾。社区 DPS/UI 观察佐证：
- `reddit.com/r/pathofexile/comments/12uh3rm/`“Why can't I use a two handed axe… it's greyed out。”
- `pathofexile.com/forum/view-thread/3886674`：“I also tried moving them to the off-hand slot just
  to test, but the message still appears … not using an off-hand weapon”（玩家把副手当武器槽测试）。

**推断**：视觉上"灰态／无法放置"+ 词缀面板按手持武器计算，是客户端对"该槽位被禁用"的渲染；
**GGG 未公开精确的渲染像素实现**（无第一方 UI 源码公开），故 UI 的"具体灰态样式"属推断，
但"该槽不可用"属规则确证。

### 2.4 公开资料是否讲"占位"实现

**确证事实**：PoE 官方/社区公开了：
1. 单手/双手是**武器关键词/基底分类**（`Two_Handed`、`One-Handed`、`Two-handed` 词条）；
2. **内部机制代号 `DisableOffhandSlot`**（mod 表确证存在）；
3. **Inventories 命名槽位**（`Weapon1` 等，官方 build planner 文档范例）。

这三层足以支撑"**单手/双手由武器自身属性决定，占两槽=禁用副手槽，而非两实体**"这一结论。
GGG 未公开客户端 UI 源码（第一方源码不存在），所以"如何绘制灰态"只能由上表 + 社区观察推断。

---

## 三、对《挂机远征》M2 的启示

> 我们的数据模型应**照搬 PoE 的"武器自身 handedness + 禁用副手槽"模型**，不要去模拟
> "两个槽位引用同一件物品"这种复杂结构。8 槽位 = 主手 / 副手 / 头 / 身 / 手 / 脚 / 戒指 / 项链。

**核心建模建议（简洁）：**

1. **实例 id：独立于词缀 roll 的身份句柄。**
   - 装备实例表（如 `ItemInstance`）用一根 `id`（我们可用单调递增整数或 UUID），纯作
     主键/引用。
   - 词缀 roll 是另一套（`前缀/后缀` 列表存数值），**不要**塞进 id 语义里。
   - 由于我们是单服务器/自管账号，**不需要 PoE 式"随所有权做混淆哈希"**；一个稳定主键就够。
     PoE 的 64-hex 和"换主人变 id"都是它防复用/防外泄的营销性设计，与我们无关。

2. **单手/双手 = 武器基底的固有属性（handedness），不是槽位占用。**
   - 在 `Weapon` 基底（或类型）上加 `handedness: 'one' | 'two'`（对应 WEAPONS.md 的 12 类型分单手/双手）。
   - **不要**让双手武器数据复制成"两件"，也不要做"两个槽位引用同一 item"。

3. **双手武器 = 禁用副手槽，用"槽位占用规则"建模。**
   - 服务器端校验：当 `mainHand` 戴上 `handedness=two` 的武器 → `offHand` 强制为空。
   - 可仿 `DisableOffhandSlot`：在武器实例/基底上记一个 `occupiesOffHand: true` 的标记，
     装备规则据此排空并锁定副手槽；若有未来"单手使双手"的机制，就是解除这个标记（PoE 的
     Giant's Blood 对应）。
   - UI 层：主手为双手武器时，副手槽渲染为"灰态占位、不可放置、不可拖入"，且不参与 combat
     结算——这纯是渲染，数据层只需"副手为空 + 主手 handedness=two"即可推出。

4. **装备校验函数化（纯函数引擎友好）。**
   - `canEquip(slot, item, currentGear)`：检查 handedness 冲突（双手 ⇒ 副手必空）、
     基础需求（等级/属性）、唯一性等。
   - `equipResult(gear, item, slot)`：返回新装备快照（不可变），副手被自动排空。
   - 这套纯函数=PoE 式装备规则的最小落地，与 ARCHITECTURE 的"纯函数引擎"一致。

---

## 四、证据分类摘要

| # | 结论 | 性质 | 来源 |
|---|------|------|------|
| 1 | Item 有唯一 `id`（64-hex） | 确证 | `pathofexile.com/developer/docs/reference` |
| 2 | id 是稳定句柄（stash/trade/fetch 同值） | 确证 | 同上 + `github.com/wgnodejsstudy/nodejs/issues/7` |
| 3 | id 非自增、外观为哈希、可能随所有权变 | 社区旁证/推断 | `reddit.com/r/pathofexiledev/comments/avpayh/`、`/57fzza/` |
| 4 | id 生成算法/存储结构 GGG 未公开 | 确证（不存在公开） | 官方文档 + `github.com/brather1ng/RePoE`（静态数据无实例id） |
| 5 | id 与词缀 roll 语义独立 | 确证/推断 | `poewiki.net/wiki/Unique_item`（w/ GGG forum 引文） |
| 6 | 双手=占 Main+Off Hand 两槽的关键词，由武器分类决定 | 确证 | `poewiki.net/wiki/Two_Handed`、`poe2wiki.net/wiki/Two-handed` |
| 7 | 底层机制代号 `DisableOffhandSlot`（禁副手槽） | 确证 | `poewiki.net/wiki/Modifier:DisableOffhandSlot` |
| 8 | 单手/双手是基底固有属性（handedness），非两实体 | 确证 | `poe2ref.com/items`、`repoe-fork.github.io/base_items/` |
| 9 | 双手武器 API 里仍是 1 个 Item | 确证 | `pathofexile.com/developer/docs/reference`（Character.equipment: array of Item） |
| 10 | 槽位存在命名 id（`Weapon1` 等） | 确证 | `pathofexile.com/developer/docs/game`（BuildInventorySlot） |
| 11 | 副手槽在双手下不可用，仅特殊机制解除 | 确证 | `poe2wiki.net/wiki/Off_Hand`、`poe2db.tw/us/Two-Handed` |
| 12 | "灰态占位"的精确渲染样式 | 推断 | 社区观察 `reddit.com/r/pathofexile/comments/12uh3rm/` |

### 查不到的（明确标注）
- GGG **服务端**物品实例 id 的具体生成算法 / 数据库主键结构（从未公开，属黑盒）。
- 双手武器副手槽"灰态"的精确 UI 实现细节（无第一方客户端源码公开）。
- "实例 id 与词缀 roll 是否共享随机种子"（GGG 未声明）。
