# 攻速调度模型（nextAttackAt）

Type: grilling
Status: resolved
Blocked by: 02

## Question

战斗循环从「固定 dt 每步打一下」改成**下一击时间戳调度**（GDD §15：`nextAttackAt` 调度，无粒度天花板）。单个英雄起步，留多英雄接口。

要答清的：

- **调度粒度**：`nextAttackAt` 存 hero 上（毫秒时间戳）。`stepExpeditions(dt)` 每步推进时做什么——检查 `now >= nextAttackAt` 即出手？出手后 `nextAttackAt += 1000 / 攻速`（BPS 换算成 interval，还是直接用 BPS×dt 累计充能）？
- **单次出手动作**：命中(已定) → 伤害(已定) → 敌反击——这些动作在一步内发生一次还是按攻速可能发生多次？怪的反击也走 `nextAttackAt` 吗（目前怪反击是英雄出手后固定反击）？
- **攻速与 DPS 关系**：攻击值 = 武器伤害区间 × (1+STR/100) × (1+Σ增伤%)；攻速乘进去后单次伤害不变、出手频率变——那"变强可见"的 DPS 提升 = 伤害×攻速，这个怎么呈现给玩家（面板显示 DPS 还是两次攻击间隔）？
- **与 rng 契约**：攻速调度后，一次 `stepExpeditions` 里英雄可能出手 0/1/多次——命中 roll 消耗的 rng 序列随出手次数变化。这会改变 #12 定的 rng 消耗序列吗（#12 契约=命中 roll→伤害 roll，顺序没变，变的是每步出手次数）？确定性还保得住吗？
- **多英雄接口**：`nextAttackAt` 是 per-hero。M2 只 1 英雄，但字段/循环要能扛多英雄（留 `party.heroIds[]` 将来的循环）。

## Notes

- 上游：`docs/GDD.md` §15（M2 战斗附注原文）、`docs/NUMBERS.md` §4.1（攻速公式=武器BPS×(1+DEX/100+Σ攻速词缀%)）、#12 已定的 rng 契约（命中→伤害）。引擎现状 = `expedition.js`（stepExpeditions 单步出手，怪固定反击）。
- 依赖 #02：攻速公式（含词缀%）必须先定接线，本票才能定义调度要输出什么。
- 产出物：蓝图中的「攻速调度」章节 + `expedition.js` stepExpeditions 重构伪代码 + rng 消耗序列说明。
- 优先：先 grilling（这是"应该如何行为"的问答，防御/架构权衡重），可先 prototype 一把再 grill 收口。

## Answer

2026-08-30 解决（grilling 拍板）。核心定调：**Arknights 式独立节奏**——无回合、无「英雄出手→怪反击」耦合；每个英雄和每只怪都带自己的攻击时钟，到点即出手（可 burst），**整体各自独立判定**。

**已定：**

- **① 时间模型 = 相对倒计时**：`attackCountdown`(ms) 每步 `-= dt`；归零开火、`+= interval`。保 `% interval` 余量，不丢时间。这是「nextAttackAt 时间戳」的纯函数安全编码（引擎无墙钟、时间仅以 dt 到达，快照可复现）。
- **② interval 换算**：`interval = 1000 / attackSpeed`；`attackSpeed = 武器bps × (1 + DEX/100 + Σ攻速词缀% + 基底implicit攻速%)`（#02 已定）。M2 初始艾格雷姆 = 1.0×(1+12/100) = 1.12/s → interval ≈ 893ms。
- **③ 英雄与怪物纯时间驱动**：到点即出手，命中率/伤害 roll 照 #12 契约（hit roll→dmg roll），与「本单位是否在打/是否命中」无关——整体独立节奏。
- **④ 怪物攻速数据**：每个 `region.monster` 加 `attackInterval`(ms)，默认 1000（1 bps 基线）；首区雾林 = 1000。**非「全区一张」而是「每怪个体一张」**——未来可下放到 spawn 个体（与 dodgeTier 同款落位）；M2 只做「每区一 interval」最小形态，口子开好。
- **⑤ 死亡即取消本次未出手**：每步固定轮转序（`party.heroIds[]` → monster 最后）；怪若在轮到它前已死，跳过其出手、结算击杀/掉落→换新怪。与 Arknights「目标死在自己攻击间隔前=攻击取消」一致，无必出手耦合。
- **⑥ 单步内多击 = 一次性打满**：`while countdown<=0` 循环开火 + 累计余量（无粒度天花板本体；默认 dt=500 至多一两击，接口扛大 dt/离线结算）。
- **⑦ 多英雄接口**：每个英雄各自 `attackCountdown`；`stepExpeditions` 循环 `party.heroIds[]`（现 [0] 生效）。怪物计时挂 `party.monster`。英雄计时**不**在换怪时重置（持续输出），新怪计时重新初始化。
- **⑧ rng 确定性**：固定轮转序（heroIds 数组序 → 怪物最后），rng 消耗成为 dt/攻速的确定性函数 → #12 契约每次出手内不破。

**关键廓清（近远程）**：**不引入射程/距离判定**。family 轴（melee/ranged）只影响已实现的 **multiplier**（hero.js:130 `heroDamageModifiers` 的 `meleePct`，仅近战武器下非 0），永不进 timer。全战斗体统一一个 countdown；family 只决定时钟到点后交给哪个伤害/命中数。**无额外复杂度。**

**范围约束**：M2 单英雄对单怪（`party.monster` 单实例）。schedule 模型支持一队对一列怪（monster 可数组、各怪 own-clock），M2 只留口子不铺。

**挂钩**：依赖 `#02`（攻速公式已供）；供 `#05`（DPS 汇总归面板，scheduler 只暴露 `attackSpeed`/`interval`）。
