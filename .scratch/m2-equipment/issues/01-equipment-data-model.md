# 装备数据模型

Type: prototype
Status: resolved
Blocked by: —

## Question

M2 装备的**数据形态**定案：`items.json` + 状态快照里的装备存储，怎么组织到可直接实现？范围 = 白装（0 词缀）+ 蓝装（词缀池随机 1~2 条），8 槽，只穿主手+副手。

要答清的：

- **items.json 表结构**：每个基底一条记录（baseId/类型/槽位/需等级/基础伤害区间/隐含词缀/BPS）。武器 12 类但 M2 只做白装能用到的几类（铁砧=单手锤+盾），其它类字段留空还是先不建？
- **词缀池表**（affixes.json 还是并入 items.json）：蓝装从 §5.2 武器池（物理%/附加点伤/攻速/力量/暴击率/暴击伤）+ §5.3 防具池（护甲/生命上限/物减%/元抗/敏捷）+ 饰品池（全局伤/攻速/经验）随机 roll——M2 需要这几张池吗？还是只做武器池（铁砧只穿武器）？
- **掉落物实例**（一份掉落装备的唯一记录）：含 baseId + 稀有度 + 随机到的词缀数组 + 数值 roll。随机时的 rng 从哪来（复用 hero/战斗的 rngState 还是独立掉落 rng 流？掉rocks rng 消耗序列在战斗的哪一步，保已定的确定性契约）？
- **状态快照存储**：装备存哪里——`inventory.items[]`（背包未穿）+ 英雄身上的 `equipment`（8 槽对象）？穿上的装备从背包移除还是保留引用？存档 v0.2→v0.3 迁移怎么做？
- **穿戴验证**：能穿的条件（槽位匹配 + 需等级 ≤ 英雄等级）在数据模型何时校验（穿戴时拦还是掉落时匹配）？

## Notes

- 上游：`docs/WEAPONS.md` §8（8 槽）/§6（词缀结构）/§2（12 类）、`docs/NUMBERS.md` §5.1（基底阶梯）/§5.2（武器词缀池）/§5.3（防具饰品池）、`docs/PENDING.md` 存档现状（v0.2 迁移，见 ARCHITECTURE §5）。
- 本票只决定「存成什么样」，不决定「怎么进战斗公式」（那是 #03 接线票）。
- 产出物：蓝图中的「装备数据模型」章节 + `items.json`/`affixes.json` 示例 JSON + 存档迁移说明。
- 优先：先做 prototype（数据形状是「如何长这样」的问题），再 grilling 收口。

## Answer

2026-08-30 解决。四条分叉 + 研究支撑结论：

**① 双手武器占两槽 → 照搬 PoE"武器自身 handedness + 禁用副手槽"模型**
- 武器基底标 `handedness: "one" | "two"`（GDD 12 类：单手锤/短刀/短杖/单手剑=one；大锤/大剑/矛/匕首/弓/弩/长杖/法器=two；盾/防具/饰品无此字段）。
- **不复制实体、不做双槽位引用同一件**——那样反而是反模式（research 报告确证 PoE 底层是 `DisableOffhandSlot` 机制：一件 item + 装备规则禁掉副手槽）。
- 装备规则（纯函数）：主手 `handedness=two` → **副手强制为空** + UI 灰态占位（不可放置/不可拖入/不参与 combat 结算）。未来"单手使双手"= 解除该标记（PoE Giant's Blood 对应）。
- **只有 `handedness` 一个标记**；`occupiesOffHand` 为派生布尔（`handedness==="two"` 即禁副手），**不另存一份**——避免双标记 divergence。落地 `canEquip(slot, item, gear)` + `equipResult(gear, item, slot)`（不可变快照）。

**② 掉落实例 id → 单调自增整数主键（独立于词缀 roll 的身份句柄）**
- **不占 rng**（掉落 roll 已经消耗品质+词缀两段 rng，再用会污染随数流、破坏确定性契约）。
- **不用 UUID、不做混淆哈希**——research 确证 PoE 的 64-hex"随所有权变 id"是防外泄/防复制的营销性设计，我们单机自管账号不需要；一个稳定单调主键就够。
- 独立于词缀 roll：id 是"这件的身份"，词缀列表是"这件的数值"——两个关注点，分开。

**③ 实例存储形态 → B 层叠（实例嵌英雄）**
- 掉落实例直接嵌在 `hero.equipment[槽位]`（引用实例对象）。
- `inventory.items[]` 存**未穿**的实例；穿上的从背包移走。
- 语义：一处单份（实例要么在背包、要么在装备位），换装 = 装备位引用换掉，旧的回背包。
- 存档无双份冗余，读词缀直接集合 hero.equipment 聚合。

**④ 词缀池 → 独立 `affixes.json`，按部位分池**
- 按槽位/部位分池（武器池 §5.2 / 防具池 §5.3 / 饰品池），含词缀名/统计/值域/倾向。
- **M2 实际只穿武器+盾 → 需要两张池：`weapon` 池 + `shield` 池**（铁砧=单手锤+盾）。
- **盾词缀池归属：单独一张 `shield` 池**。DECISIONS v0.13 的防具池定义是"头/身/手/脚通用"，盾是副手大类（物盾/轻盾/符盾），不在防具池内——故为它单列一池，M3 接盾形态/词缀时直接扩展。（防具 4 池、饰品池 M2 留空，M3 填。）
- items.json 只存基底目录（蓝本）；蓝装 roll 从 affixes.json 对应部位池取。
- M3 直接扩展此表（前缀/后缀/Tier/锈变/Cast点），M2 不返工。

**校验时机**：穿戴时拦 —— `canEquip` 在穿戴动作校验（槽位匹配/需等级≤英雄等级/handedness 冲突）；**掉落侧"掉出的装备等级与当前英雄匹配"归 #04 掉落票**，本票只在穿戴闸门拦。M2 掉落不需按英雄等级过滤（M1 单英雄等级即区域等级），#04 定掉落时再细化。

**存档迁移（v0.2→v0.3）——含存量 hero.weaponId 处理**：
- M1 老档 `weaponId: "copper-hammer"`（hero.js:44 起始武器）**必须铸成实例**，否则主手出现"equipment.mainhand 与 weaponId"两个真源，#02 接线被迫兼容双形态。
- 迁移动作：`hero.equipment = 8 槽空对象`，把老 `weaponId` 对应基底铸成实例 `{ id: nextItemId++, baseId, rarity:"white", affixes:[] }` 塞进 `equipment.mainhand`，**删除 `weaponId` 字段**。
- `inventory.items` 保留（老档为空）；`meta.nextItemId` 新增，初始=已用实例数+1（第一档迁移后 = 2）。
- `createHero`（新档）不再用 `weaponId`：直接建实例塞 `equipment.mainhand`（后续 `createHero` 改为在核心/迁移统一生成起始实例）。

**数据形态总览（写进蓝图）：**
```
items.json  基底目录：{ id, type(weapon|shield|armor|jewelry), handedness?, slot, reqLevel,
                damage|armor, bps, implicit }   —— immutable 蓝本
affixes.json 词缀池：{ [pool]: weapon|shield|armor|jewelry, [{affixId,name,stat?,value}] }  —— M2 只 weapon+shield 池，M3 扩
inventory    状态快照：{ gold, materials, items: [ 未穿实例对象 ] }
hero.equipment 已穿：{ mainhand|offhand|head|body|hands|feet|ring|amulet: 实例对象|null }
实例对象 = { id(自增), baseId, rarity(white|blue), affixes: [{affix, val}] }
```
- M2 实际可穿 = mainhand(单手锤) + offhand(盾)；其余 6 槽位在结构/存档/UI 就位但禁用（空+占位）。
- B 层叠：实例对象要么在背包、要么在装备位，**一处单份**；换装 = 装备位引用换掉、旧对象卸下回背包。

**原型资产**：`equipment-model-proto.mjs`（.scratch/m2-equipment/）。已重写为**演示 B 层叠**：实例对象嵌 hero.equipment、穿铁锤时旧铜锤卸下回背包（修复先前"穿铁锤未移除"的复制 bug）、迁移铸起始铜锤入 mainhand、双手武器 handedness→禁副手规则演示。原型证实"B 层叠顺 + 实例 id 不占 rng"。（proto 留在 .scratch，不进主分支。）
