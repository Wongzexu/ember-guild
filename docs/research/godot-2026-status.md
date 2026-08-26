# 《挂机远征》调研笔记：Godot 引擎 2026 年现状（GODOT-2026-STATUS）

> ⚠️ **调研笔记 · 仅陈述事实，不做推荐**
> 本文件为「留 Vue 还是换 Godot」架构决策提供事实输入，每条发现标注来源。结论与取舍另行在 ADR 中讨论。
>
> 调研日期：2026-08-26（对应 Godot 4.7.x 时期）。`/godotengine/godot` 分支、文档快照随版本更新，阅读时留意版本号。
> 信息来源优先级：官方（godotengine.org / docs.godotengine.org / GitHub releases）→ 高可信社区来源。

---

## 1. 当前版本、发布节奏、LTS 政策

### 最新稳定版

- **Godot 4.7.2-stable**（2026-08-18 发布），是 4.7 系列第二个维护版（57 个 bug 修复、39 位贡献者），官方明确维护版与旧版兼容、推荐采用。
  - 来源：GitHub releases https://github.com/godotengine/godot/releases/tag/4.7.2-stable ；维护版说明 https://godotengine.org/article/maintenance-release-godot-4-7-2/
- 官网下载页（Windows x86_64 · .NET 4.7.2 · 2026-08-18）https://godotengine.org/download/windows/
- 3.x 分支仍在发布维护版（3.6.3-stable）。

### 发布节奏

- 官方文档（Release policy）：4.0 之后转向「快速迭代」——4.1 在 4.0 之后 4 个月、4.2 在 4.1 之后 4 个月，目标是**一年约 3 次 minor 发布**；维护（patch）版按需、周期很短。
  - 来源：https://docs.godotengine.org/en/stable/about/release_policy.html ；发布管理计划 https://godotengine.org/article/release-management-4-1/
- 近况佐证（2026 年时间线，官方 release policy 表）：4.6 = 2026-01，4.7 = 2026-06，4.8 (master) 预估 Q4 2026。

### 支持 / LTS 政策

- **没有商业意义上的「LTS」品牌**。官方支持模型是「滚动的稳定分支」：
  - 稳定分支至少支持到「下一个 stable 分支发布并出了第一个 patch」为止；之后**best-effort** 继续修，只要还有活跃用户。
  - 同一 minor 系列内**只维护最新 patch**。
  - 4.5（2025-09）已进入 partial（只修安全和平台问题）；4.4 及更早 EOL。
  - 3.x 按 best-effort 维护；3.6（2024-09）**可能是 3.x 最后一个稳定分支**。
  - 来源：https://docs.godotengine.org/en/stable/about/release_policy.html

> 对决策的意义（事实）：选 4.7.x 有约 1 年左右的活跃支持窗口，之后通常建议跟随升级；Godot 升级 minor 大版本是有破坏性变更的（需要做迁移）。

---

## 2. 2D 挂机/放置类游戏可行性 + Control 节点成熟度

### Control 节点系统（官方）

- `Control` 是所有 UI 节点的基类，官方继承者包括：`Container`、`GridContainer`、`ItemList`、`Label`、`RichTextLabel`、`LineEdit`、`TextEdit`、`Tree`、`TabBar`、`MenuBar`、`Panel`/`NinePatchRect`、`Range`/`ProgressBar` 等——物品格、滚动列表、表格、富文本提示所需的节点类型官方都有。
  - 来源：官方类引用 https://docs.godotengine.org/en/stable/classes/class_control.html
- Control 内置能力对数据密集 UI 直接相关：
  - **拖放**：`_get_drag_data` / `_can_drop_data` / `_drop_data`（物品格搬移、合并、拆分）。
  - **tooltip**：`tooltip_text` 属性 + `_make_custom_tooltip()` 自定义悬浮提示。
  - **主题**：`Theme` 资源统一皮肤/字体/颜色，可作用到整棵子树（词缀颜色、稀有度配色）。
  - **多分辨率自适应**：锚点（anchor）+ 容器（Container）自动布局，官方有 multiple resolutions 指南。
  - 来源：Control 类引用 + 官方 UI 索引 https://docs.godotengine.org/en/stable/tutorials/ui/index.html 、https://docs.godotengine.org/en/stable/tutorials/rendering/multiple_resolutions.html
- 社区教程验证的成熟模式：物品数据放 `Resource`（不挂在场景树上、可序列化/存档），UI 用 `Control`/`GridContainer` + `ScrollContainer` 作为「视图」，靠信号（inventory_changed）驱动刷新；拖放零插件。
  - 来源：Coding Quests《How to Build an Inventory System in Godot 4》https://codingquests.io/blog/godot-4-inventory-system-tutorial ；StraySpark《Building a Complete Inventory and Crafting System in Godot 4》https://www.strayspark.studio/blog/godot-4-inventory-crafting-system-complete-guide
- **已知边界（社区）**：仓库几百格时「每格一个节点」的简单做法浪费，需自己实现虚拟滚动（教程明示 20–50 格没问题、500+ 要优化）。来源：上一条 StraySpark 教程。

### 挂机/放置类先例（社区）

- **Brotato**（2022，UE 风格的肉鸽生存，武器/物品/商店 UI 很密）：MobyGames 标注 Godot Engine。来源：https://www.mobygames.com/game/192086/brotato/
- **Cassette Beasts**（2023，Godot 3，官方 showcase，收集/图鉴/战斗菜单繁重的 RPG）：来源：https://godotengine.org/article/godot-showcase-cassette-beasts/
- **Godot 增量游戏指南**（2026，Melvor Idle 风格完整教程：技能/制作/自动战斗/离线进度/商店经济/自定义 UI/模组）：https://github.com/Sasani-Likes-Penguins/Godot-Incremental-Game-Guide
- **Road of War**（开源增量 RPG，Godot 4.x，装备系统/掉落表/装备管理 UI/存档）：https://github.com/Mahinika/Road-to-War
- **Froggee Toadems**（2024，Godot 4.3 增量沙盒制作游戏）：https://github.com/NotTom31/FroggeeToadems
- **网格背包插件先例**（Godot 4，自定义形状/旋转/堆叠/稀有度/拖放）：https://github.com/ape1121/Godot-4-Grid-Inventory-with-Patterns

> 结论性事实：社区已有多个与《挂机远征》同类（数据密集 + 放置）的开源项目和完整教程，Control 系统覆盖本项目的 UI 需求（背包/词缀/图鉴/tooltip/滚动列表），但大列表虚拟滚动需自研。

---

## 3. Web 导出

### 官方文档要点

- 官方 Web 导出页（4.x）：https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html
- **存档（localStorage/IndexedDB）**：Godot Web 用 `user://` 文件系统持久化，**底层是 IndexedDB**（官方文档称需允许 cookies 中的 IndexedDB；iframe 里需第三方 cookies；隐身模式不持久）。可用 `OS.is_userfs_persistent()` 运行时检测。
- **安全上下文要求**：4.x Web 导出强制用 `SharedArrayBuffer`（线程/低延迟音频），要求 HTTPS 安全上下文 + 特定 CORS/COOP/COEP 头，否则运行受限。
- **压缩**：官方明确建议服务端 gzip/Brotli 预压缩 `.wasm` 和 `.pck`；**wasm 用 gzip 可压到约 1/4**，Brotli 更佳。来源：同上 + https://docs.godotengine.org/cs/4.x/engine_details/development/compiling/optimizing_for_size.html

### 包体 / 加载实测（社区）

- 默认模板 wasm 约 **25–33 MB 未压缩**（2025 实测，`disable_3d` + `optimize=size` 可降到 ~19MB，全裁剪 ~15MB，wasm-opt 再压）。来源：https://amann.dev/blog/2025/godot_web_size/
- 最小空项目 + 预压缩（gzip/Brotli）+ wasm-opt 后约 **6 MB**（4.6.2 = 6.33 MB，4.3 = 5.34 MB，且 4.3→4.4 体积增 ~15%）。来源：https://github.com/JohannesDeml/Godot-WebGL-LoadingTest
- 论坛实测：默认模板 wasm 40MB → 自编译模板 20MB → Brotli 压缩 4MB（加载可跑手机端）。来源：https://forum.godotengine.org/t/wasm-de-compression-is-this-really-working-or-am-i-getting-it-wrong/71728
- 移动端性能大头在资源管线：纹理用 VRAM 压缩（Basis Universal/ETC2/ASTC）、贴图图集化、按需加载（`load_threaded_request`）；2026-08 实测把全加载 22s → 4.2s、内存 612MB → 152MB。来源：https://forum.godotengine.org/t/godot-4-web-export-stutters-on-mobile-its-probably-your-art-pipeline-not-your-code-31fps-to-60fps-benchmarks-inside/143268 ；2026 优化指南 https://best-games.io/blog/godot-web-export-optimization-guide

> 对决策的意义（事实）：Web 存档机制存在（IndexedDB），但**引擎本体 wasm 至少数 MB 起、默认更大**，与「Vue + Vite 打包后几百 KB + 秒开」的加载体验不是一个量级；需要用预压缩 + 裁剪模板 + 按需加载来控制。

---

## 4. 桌面导出 / 小窗形态

- **Windows 官方导出**：导出为 `data.pck` + 去编辑器/调试器的优化二进制；支持 x86_64 / x86_32 / arm64 三架构、代码签名、图标、PCK 内嵌（上限 ~3.75GB）。来源：https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_windows.html
- **Linux 导出**有官方独立页面（同目录下一节 exporting_for_linux），原生二进制无额外运行时。
- **小窗形态**：Godot 窗口尺寸由项目设置控制（display/window/size），UI 用锚点/容器做分辨率自适应（见第 2 节 multiple resolutions 文档）；原生窗口没有 Electron/Chromium 那套内存与启动开销，适合常驻小窗。
  - 来源（窗口/分辨率官方文档）：https://docs.godotengine.org/en/stable/tutorials/rendering/multiple_resolutions.html
- 未找到专门针对「桌面小窗」的官方基准测试——此为架构性支持，无官方性能数字。

---

## 5. 测试生态

- **官方没有内置测试框架**；Godot 官方文档有 Unit Testing 指南（testing 相关章节），社区事实标准是 **GUT**。
  - 官方脚本调试/测试文档入口：https://docs.godotengine.org/en/stable/tutorials/scripting/debug/index.html
- **GUT（bitwes/Gut）现状**：
  - GUT 9.x 对应 Godot 4.x；最新 9.7.1（godot_4_7 分支，匹配 4.7.x），9.6.1 在官方 Asset Library（要求 Godot 4.6）。
  - 能力：断言/工具方法、setup-teardown、参数化测试、全量/部分 double + stub + spy、单例 double、参数化、**JUnit XML 导出**、CLI、编辑器内运行、**headless 运行（命令行）**、VSCode 扩展、孤儿节点/内存泄漏检测。
  - 来源：https://github.com/bitwes/Gut 、https://gut.readthedocs.io/ 、官方 Asset Library https://godotengine.org/asset-library/asset/1709
- **对纯逻辑层（无 UI）友好度**：GDScript 的 `class_name` 全局类 / `RefCounted` 无场景树依赖即可被测；数据层放 Resource、UI 解耦的模式（见第 2 节）天然可测；GUT 支持 headless CLI，适合 CI。来源：GUT 文档 + 第 2 节社区教程的架构模式。

> 对决策的意义（事实）：「纯函数引擎」在 Godot 里可等价为「无节点依赖的 RefCounted/Resource 逻辑类」，用 GUT headless 测试可行；但测试框架、CI 接入都是社区方案，无官方标准，生态成熟度低于 Vitest + npm 那套。

---

## 6. GDScript 学习成本（vs JS）

- **官方定位**：GDScript 是专为 Godot 设计的「渐进类型」语言——默认动态类型、可选类型标注（`static typing in GDScript` 官方文档可强类型化以提性能/捕错）；面向对象、命令式、**缩进语法（类 Python，但完全独立于 Python）**。官方推荐新手用 GDScript。
  - 来源：https://docs.godotengine.org/en/latest/getting_started/step_by_step/scripting_languages.html 、https://docs.godotengine.org/en/latest/tutorials/scripting/gdscript/gdscript_basics.html
- **官方语言家族**：GDScript / C# / C、C++（GDExtension）四门官方语言；C# 需要外部编辑器、资料少于 GDScript。
- **与 JS 的关键差异**（社区对比 + 官方文档综合）：
  - `var` ≈ JS `let`；`const` 类似；但 **GDScript 无变量提升**（必须先用后声明）。
  - **区分 int 与 float**：`5/2 = 2`，`5.0/2.0 = 2.5`（JS 全是 double，无此坑）。
  - **缩进代替花括号**；`func` 声明函数；`elif` 代替 `else if`；`for` 只有 `for...of/in` 风格；无展开参数（spread），用 `callv()`。
  - `Dictionary` ≈ JS Object/Map，但键可为任意类型且保序；内建 `Vector2/3` 等数学类型。
  - **无 npm/构建链**：脚本在编辑器内直接跑，官方称编译/加载「极快」；GDScript 自身执行比 C#/C++ 慢，但多数调用落到引擎 C++ 实现，对挂机逻辑影响通常可忽略。
  - 来源：DEV 社区《JavaScript → GDScript》https://dev.to/mekhim540/confirm-reclass-javascript-developer-gdscript-developer-3020 ；官方 https://docs.godotengine.org/en/latest/tutorials/scripting/gdscript/gdscript_advanced.html
- 另外存在社区 JS 绑定 GodotJS（可将 JS 作为脚本语言），但官方推荐路线仍是 GDScript。来源：https://godotjs.github.io/documentation/godot-js-scripts/bindings/

> 对决策的意义（事实）：对 JS 开发者，GDScript 语法上手成本低（缩进 + 动态类型 + 无构建步骤），但类型语义（int/float、无提升、无 spread）和「编辑器即工具链」的模式需要适应；现有「纯函数引擎」代码不能直接迁移，需用 GDScript 重写。

---

## 7. 热更新 / 开发迭代

- **官方能力**：编辑器「运行中同步脚本/场景改动」——勾选 **Debug > Synchronize Script Changes** 后，编辑器里保存脚本会重载到正在运行的项目（远程设备也支持，配合网络文件系统）。来源：https://docs.godotengine.org/en/stable/tutorials/scripting/debug/overview_of_debugging_tools.html
- **限制（社区/issue 确认）**：
  - 内置编辑器：保存即同步；**外部编辑器（VSCode）只在 Godot 编辑器重新获得焦点时才同步**，且存在已知 bug（issue #72825，外部编辑器热重载不生效）。
  - **没有针对 Resource 改动的同步**；GDExtension（C++）在「运行中的游戏」内热重载 4.5 前后仍未完全落地（PR #97991 讨论中）。
  - 社区普遍区分两层含义：「不用重启编辑器」已实现；「不用重启游戏、保留状态」只对脚本/场景部分实现，且热重载会重启受影响实例（状态可能丢）。
  - 来源：https://forum.godotengine.org/t/hot-reload-in-godot-instantly-see-changes-without-reloading-a-game/66089 ；https://github.com/godotengine/godot/issues/72825 ；https://gamedev.stackexchange.com/questions/211717/how-can-i-perform-hot-reload-in-godot
- **相对 web HMR**：Vue+Vite 是「改模块→毫秒级热替换且保留状态」的 HMR；Godot 是「保存后重载脚本/场景、编辑器与游戏双窗口」，**无保留状态的热替换**。但 Godot 编辑器内一键运行、GDScript 编译/启动快，冷启动迭代成本低。来源：第 6 节官方「Blazing fast compilation」+ 上列热重载资料。

> 对决策的意义（事实）：Godot 的开发循环（编辑器内运行 + 同步脚本重载）可用，但与 web 生态的「毫秒级、保状态」HMR 有明确差距，密集 UI 微调迭代会慢一些。

---

## 8. 中文社区 / 教程资源（2026）

- **官方文档中文版**：简体中文文档存在且活跃维护，但**非 100% 翻译**（部分页面仍为英文），通过 Weblate 社区翻译，只有 stable 分支有本地化。
  - 来源：https://docs.godotengine.org/zh-cn/4.x/ （首页明示「可能发现部分段落、甚至整个页面还是英文」）
- **Bilibili 教程**：资源量持续增长，覆盖入门到进阶：
  - siki 学院《Godot4.5 零基础小白入门教程 2026 最新》 https://www.bilibili.com/video/BV1KuDzB7E6f/
  - 凉鞋的笔记《Godot 4.5 入门教程：跟着示例学 Godot & GDScript》 https://www.bilibili.com/video/BV14NWFzpENR/
  - 大量 2D 平台/RPG/卡牌/背包类实战合集（B 站检索「Godot 教程」即有）。来源：https://www.bilibili.com/video/BV14Ljm6xEmJ/ 等
- **社区组织 / 聚集地**：
  - GodotHub（腾讯频道）：https://pd.qq.com/g/godot
  - Godot 新手村（教程站 + 友链博客）：https://godotvillage.github.io/
  - LiGameAcademy（B 站 + QQ 群 752388002 + 知识星球 + itch.io；含《仿杀戮尖塔》《类背包乱斗背包管理》等 UI 向中文教程）：https://github.com/LiGameAcademy/LiGameAcademy
- **GitHub 中文深度资料**：《深入理解 Godot 引擎》（2026-03，64 篇系统文章 + 附录，覆盖引擎架构/渲染/脚本/编辑器扩展）：https://github.com/wangshucheng/godot-engine-book

> 对决策的意义（事实）：中文资料比 Unity 少但 2026 年已形成「官方中文文档（部分）+ B 站教程 + 社区组织/QQ群」的完整生态，UI/背包类教程尤其多（与本项目相关度高）。

---

## 附：来源清单（全部 URL）

**官方**
- GitHub releases（4.7.2-stable）：https://github.com/godotengine/godot/releases/tag/4.7.2-stable
- 维护版说明：https://godotengine.org/article/maintenance-release-godot-4-7-2/
- 下载页：https://godotengine.org/download/windows/
- Release policy：https://docs.godotengine.org/en/stable/about/release_policy.html
- 发布管理计划：https://godotengine.org/article/release-management-4-1/
- Control 类引用：https://docs.godotengine.org/en/stable/classes/class_control.html
- UI 索引：https://docs.godotengine.org/en/stable/tutorials/ui/index.html
- 多分辨率：https://docs.godotengine.org/en/stable/tutorials/rendering/multiple_resolutions.html
- Web 导出：https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html
- 体积优化：https://docs.godotengine.org/cs/4.x/engine_details/development/compiling/optimizing_for_size.html
- Windows 导出：https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_windows.html
- 脚本语言总览：https://docs.godotengine.org/en/latest/getting_started/step_by_step/scripting_languages.html
- GDScript 参考：https://docs.godotengine.org/en/latest/tutorials/scripting/gdscript/gdscript_basics.html
- GDScript 动态类型进阶：https://docs.godotengine.org/en/latest/tutorials/scripting/gdscript/gdscript_advanced.html
- 调试工具总览（热重载）：https://docs.godotengine.org/en/stable/tutorials/scripting/debug/overview_of_debugging_tools.html
- 中文官方文档：https://docs.godotengine.org/zh-cn/4.x/
- Cassette Beasts 官方 showcase：https://godotengine.org/article/godot-showcase-cassette-beasts/

**社区**
- GUT：https://github.com/bitwes/Gut 、https://gut.readthedocs.io/ 、Asset Library https://godotengine.org/asset-library/asset/1709
- 增量游戏指南：https://github.com/Sasani-Likes-Penguins/Godot-Incremental-Game-Guide
- Road of War：https://github.com/Mahinika/Road-to-War
- Froggee Toadems：https://github.com/NotTom31/FroggeeToadems
- Brotato（MobyGames）：https://www.mobygames.com/game/192086/brotato/
- 背包教程（Coding Quests）：https://codingquests.io/blog/godot-4-inventory-system-tutorial
- 背包/制作教程（StraySpark）：https://www.strayspark.studio/blog/godot-4-inventory-crafting-system-complete-guide
- 网格背包插件：https://github.com/ape1121/Godot-4-Grid-Inventory-with-Patterns
- Web 加载实测：https://github.com/JohannesDeml/Godot-WebGL-LoadingTest
- Web 体积优化：https://amann.dev/blog/2025/godot_web_size/ 、https://best-games.io/blog/godot-web-export-optimization-guide
- wasm 压缩实测：https://forum.godotengine.org/t/wasm-de-compression-is-this-really-working-or-am-i-getting-it-wrong/71728
- 移动端性能（2026-08）：https://forum.godotengine.org/t/godot-4-web-export-stutters-on-mobile-its-probably-your-art-pipeline-not-your-code-31fps-to-60fps-benchmarks-inside/143268
- 热重载讨论：https://forum.godotengine.org/t/hot-reload-in-godot-instantly-see-changes-without-reloading-a-game/66089 、https://github.com/godotengine/godot/issues/72825 、https://gamedev.stackexchange.com/questions/211717/how-can-i-perform-hot-reload-in-godot
- JS→GDScript 对比：https://dev.to/mekhim540/confirm-reclass-javascript-developer-gdscript-developer-3020
- GodotJS：https://godotjs.github.io/documentation/godot-js-scripts/bindings/
- 中文社区：GodotHub https://pd.qq.com/g/godot 、Godot 新手村 https://godotvillage.github.io/ 、LiGameAcademy https://github.com/LiGameAcademy/LiGameAcademy 、深入理解 Godot 引擎 https://github.com/wangshucheng/godot-engine-book
