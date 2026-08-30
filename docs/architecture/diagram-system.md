# Archify 图表系统

状态：active

最近更新：2026-08-30

适用范围：`docs/` 中的架构图、工作流图、时序图、数据流图和生命周期图

## 决策

本脚手架使用 Archify 替代 PlantUML 作为现行图表系统。图表由可审查的 Typed JSON 描述，经过本地校验后生成自包含的交互式 HTML；Markdown 同时引用 Viewer 原生导出的完整图 PNG、交互成品和 JSON 源，兼顾 GitHub 阅读、浏览器探索与后续维护。整页 Viewer 截图只能作为临时视觉验收证据，不得充当文档主图。

PlantUML 源码、Java/JAR 依赖和旧 SVG 生成链路不再属于当前实现。历史进度中的 PlantUML 记录保留为当时事实，不据此恢复旧工具链。

## 评估结论

替换前以仓库现有 PlantUML 图为基线，先确认全部 7 张旧图能够真实编译，再用同一语义制作 Archify 样本。

| 维度 | 结论 | 验证证据 |
| --- | --- | --- |
| 描述准确性 | Archify 的 Schema 和稳定 ID 能把节点、关系、边界与引导视图变成可检查数据；`showcase` 门禁会拒绝穿节点、交叉、歧义走廊、标签遮挡和桌面不可读，而不是只证明语法可解析 | “架构概览”样本保留原图 6 个节点和 8 条关系，9/9 artifact checks 通过，composition 为 0 error / 0 warning；一张 11 节点高密候选因 1440px 桌面文字仅 5.894px 而被明确拒绝，证明门禁不会为交付放宽事实 |
| 视觉 | 深浅主题的层级、留白、节点语义色和关系标签均优于原始 PlantUML SVG；视觉质量仍须以真实浏览器截图为准，不能由确定性检查代替 | Chrome 在 1440×900、1600×1000、1920×1080、2048×1320 四档桌面完成无溢出检查；对最小/最大视口的深浅主题截图做了人工复核 |
| 交互 | 交互成品支持主题、预设、引导视图、搜索/聚焦、上下游可达范围、有向路径、语义透镜、缩放、演示和导出；这些能力只探索作者写入的拓扑，不推断真实运行时影响 | 选择性上游交互回归覆盖 Finder、Guided Views、Route Probe、Relationship Lens 与 i18n，31 项通过、1 项真实浏览器用例先按条件跳过；设置 Chrome 后中文 Finder、Route、Export 与无障碍界面回归 9/9 通过 |

评估同时确认两个代价：Archify 的创作与验收约束比 PlantUML 严格，高密单图可能需要拆分；每张交互 HTML 约数百 KB，GitHub 仓库页不会直接执行它，因此仍需提交一张由同一 HTML 的 Viewer 原生导出链路生成、并经浏览器复核的完整图 PNG。

## 固定版本与本地修改

- 上游仓库：`https://github.com/tt-a1i/archify`
- 固定提交：`4ac500a498267f18bda42b3c82b51edb8f9c1baf`
- 上游标识版本：`2.16.0-dev.0`
- 许可证：MIT；版权与许可正文保留在 `.claude/skills/archify/LICENSE`
- 唯一 vendored 实现：`.claude/skills/archify/`
- Claude 原生入口：`.claude/skills/archify/SKILL.md`
- Codex 原生入口：`.agents/skills/archify/SKILL.md`；该跨平台轻量入口只负责原生发现，并要求 Codex 完整读取前述唯一实现，不复制 5.9 MB 渲染器与资源
- 完整目录摘要：由 `docs/contracts/archify.json` 的 `vendored_tree_sha256` 固定，`check:diagrams` 会按相对路径与文件字节重新计算并拒绝静默漂移

两个入口共享 `name: archify` 和同一触发范围，但仓库只有一份可执行实现。Codex 入口使用普通 `SKILL.md` 文件而不是目录符号链接，避免 Git 在未启用 symlink 的 Windows 环境把链接退化成普通文本文件。`check:diagrams` 同时检查 Claude 入口、Codex 入口及其 canonical 目标；缺任一入口都视为集成不完整。

本仓库对固定提交保留三项有意修改：

1. 删除模板中的 Google Fonts 请求，统一回退到系统字体栈。生成的 HTML 因此真正离线，不会因打开图表向第三方发送 IP、请求时间或常规 HTTP 元数据。
2. 项目级 Skill 不主动运行上游更新检查。版本升级由维护者显式克隆、审查、更新固定提交并重新执行本文验收闭环，静默状态不代表同意更新。
3. 项目级 Skill 明确区分临时 Viewer 截图和提交到文档的原生 PNG，强制后者使用 canonical **Export → PNG** 链路与尺寸回执门禁。

除本地浏览器视觉检查外，当前图表链路不新增运行时第三方服务、用户数据收集或遥测。

## 真相源与产物契约

同一张图使用相同 basename，并放在 `docs/diagrams/`：

```text
<name>.<type>.json    # 唯一可编辑真相源；type 为 architecture/workflow/sequence/dataflow/lifecycle
<name>.archify.html   # 由固定 Archify 版本原子交付的交互成品
<name>.archify.png    # Viewer 原生导出的 canonical 完整图 PNG；不含标题栏、菜单或导航控件
```

Markdown 不内嵌重复的 JSON，也不再保存另一份图表 DSL。每个图表位置必须同时提供：

- 点击预览图打开同名交互 HTML；
- “查看图表源”链接指向 Typed JSON；
- 配套文字说明事实边界，不能让视觉效果把占位、计划或推断包装成已实现能力。

HTML 与 PNG 都是生成物。HTML 可以用固定渲染器重建并做确定性新鲜度检查；PNG 必须调用交互 HTML 自带的 `Archify.exportMenu.run("png")` 原生导出链路，回执要求 `canonical=true`，像素尺寸必须等于 SVG viewBox 乘以 Viewer 选择的安全整数倍率。PNG 受浏览器和系统字体栈影响，不做跨机器字节比较。`visual-check` 的四张整页截图只留在临时证据目录供人工复核，不复制进文档目录。

## 命令与验收

| 命令 | 职责 |
| --- | --- |
| `npm run check:diagrams` | 检查 Claude/Codex 双原生 Skill 入口、vendored 摘要与离线边界、Markdown 三联引用，逐张执行 `showcase` 校验，并确认提交的 HTML 与当前 JSON/渲染器一致 |
| `npm run gen:diagrams` | 从全部 Typed JSON 原子生成或刷新交互 HTML |
| `npm run review:diagrams` | 先生成 HTML，再用 Chrome/Chromium 做四档桌面包含性检查与深浅主题临时截图，随后调用 Viewer 原生 PNG 导出并刷新 Markdown 主图 |

每张图的完成标准：

1. 图类型匹配问题：静态组件用 `architecture`，责任与分支用 `workflow`，请求/返回用 `sequence`，数据血缘用 `dataflow`，状态转移用 `lifecycle`。
2. `meta.locale` 与正文语言一致，`meta.quality_profile` 固定为 `showcase`。
3. `validate` 9/9，通过且 composition 为 0 error / 0 warning。
4. `deliver` 成功并给出规格与 HTML 的 SHA-256 回执。
5. `visual-check` 在四档桌面无横向或纵向溢出，最小节点文字满足 6px 阈值，深浅主题截图均由人实际查看。
6. 原生 PNG 导出回执为 `format=png`、`canonical=true`，文件字节数与回执一致，IHDR 尺寸与 viewBox × 安全倍率一致；人工确认图片不含 Viewer chrome。
7. 文档中的 PNG、交互 HTML 和 JSON 链接全部存在；语义节点和关系与文档事实逐项核对。

CI 保留独立 `diagrams` job，但只需要仓库固定的 Node.js 22 与 vendored Archify，不再下载 Java 或 PlantUML JAR。Chrome 视觉复核属于图表改动时的本地专项验收，不伪装成无浏览器环境也能完成的基础门禁。
