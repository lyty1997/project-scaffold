# 图表系统：Archify + PlantUML

[English](diagram-system.md) | 中文

状态：active

最近更新：2026-08-31

适用范围：仓库文档中的架构图、工作流图、时序图、数据流图、生命周期/状态图、ERD/Class 图及其他技术图

## 决策

本脚手架采用 Archify 与 PlantUML 互补方案。Archify 不能全面取代 PlantUML，PlantUML 也不是 Archify 的简化渲染器；应按交付形态和维护方式选择工具。

| 场景 | 更适合 |
| --- | --- |
| 架构总览、复杂流程/泳道、数据流、生命周期或演示图 | Archify |
| 需要交互、深浅主题、搜索、路径追踪或 canonical 高清 PNG | Archify |
| Markdown 内联、快速修改和清晰文本 diff | PlantUML |
| ERD/Class、精确状态机或局部时序/活动图 | PlantUML |
| 用 CI 快速验证大量技术图 | PlantUML |

用户明确指定工具时优先遵守。时序、工作流、状态等重叠类型按以下原则选择：

- 交付物包含独立 Viewer、探索能力、展示质量或原生位图导出时选 Archify；
- 图源应内联在正文旁，且精确、紧凑、易审查更重要时选 PlantUML。

同一张图只能有一份可编辑真相源。不得同时维护等价的 Archify JSON 与 PlantUML。只有表达真正不同视角时，一份文档才可同时使用两种工具，例如交互式系统总览与局部请求时序。

Mermaid、手写 SVG 和没有可编辑源的截图不属于当前契约。极简目录树可继续使用 ASCII。

## 现有 Archify 评估结论

仓库当前 7 张文档图继续保留为 Archify 产物。迁移评估已经确认：

- showcase 门禁会拒绝穿节点、歧义走廊、标签遮挡和桌面不可读，而不只证明语法可解析；
- 交互 Viewer 支持主题、引导视图、搜索/聚焦、可达范围、有向路径、语义透镜、缩放、演示与导出，且不会推断未写入的运行时事实；
- 每份交互 HTML 有数百 KB，GitHub 不会执行，因此仍需提交 Viewer 原生 canonical PNG；
- 视觉质量必须用真实浏览器人工复核，确定性回执不能代替感知验收。

高密图可能需要拆分。这是 Archify 的已知成本，不能靠把文字压到可读阈值以下规避。

## Archify 真相源与产物契约

经过审查的实现 vendored 在 `.claude/skills/archify/`：

- 上游仓库：`https://github.com/tt-a1i/archify`
- 固定提交：`4ac500a498267f18bda42b3c82b51edb8f9c1baf`
- 包版本：`2.16.0-dev.0`
- 许可证：MIT，正文位于 `.claude/skills/archify/LICENSE`
- 机器契约：`docs/contracts/archify.json`

Claude 入口为 `.claude/skills/archify/SKILL.md`，Codex 发现桥接为 `.agents/skills/archify/SKILL.md`。项目删除远程 Google Fonts、禁用自动更新检查、强制 Viewer 原生 canonical PNG，并把明确的 PlantUML 请求路由到互补 Skill。升级必须显式审查上游、重放 `LOCAL_CHANGES.md`、刷新 vendored 摘要并重跑全部验收。

同一张 Archify 图在 `docs/diagrams/` 使用相同 basename：

```text
<name>.<type>.json    # 唯一可编辑真相源
<name>.archify.html   # 确定性的交互产物
<name>.archify.png    # Viewer 原生 canonical 完整图
```

Markdown 用 PNG 预览链接 HTML，并另行链接 Typed JSON。`visual-check` 的整页截图只作临时验收证据，不能成为提交的文档 PNG。

验收要求：

1. Archify 类型与信息匹配；
2. `meta.quality_profile` 为 `showcase`，`meta.locale` 与作者内容一致；
3. 校验回执为 9/9、0 error、0 warning；
4. 原子交付记录规格与 HTML 的 SHA-256；
5. 1440×900、1600×1000、1920×1080、2048×1320 四档桌面无溢出；
6. 人工查看最小/最大视口的深浅主题证据；
7. 原生 PNG 回执为 `format=png`、`canonical=true`，尺寸符合安全倍率且不含 Viewer chrome。

## PlantUML 真相源与产物契约

项目工作流位于 `.claude/skills/plantuml-in-markdown/SKILL.md`。官方 JAR 不进入仓库；本地设置：

```bash
export PUML_JAR=/absolute/path/to/plantuml-1.2026.1.jar
```

CI 从 PlantUML 官方 GitHub release 下载 1.2026.1，并在执行前校验 SHA-256 `89c116168a2a0f7cf5292e11617ba22abd743f891914f1fec5bc9c7d257b3092`。

生产文档图采用：

```text
docs/path/to/document.md              # PlantUML 围栏块是唯一可编辑真相源
docs/diagrams/<name>.plantuml.svg     # 供 GitHub 阅读的生成产物
```

每个 `plantuml` 围栏必须：

- 包含 `@startuml` 与 `@enduml`；
- 后面至多隔一个空行，紧跟非空的本地 `.svg` 图片引用；
- 完全自包含，禁止 `!include`、`!includeurl`、`!import` 等指令；
- 能在 PlantUML `SECURE` profile 下编译；
- 完成 Skill 的“选类型 → 提取 → 编译 → 修复 → 写回 → 全量编译”闭环。

提交的 SVG 必须存在，是非 symlink 的普通文件，并经过人工查看。CI 不做跨机器字节比较，因为输出几何和元数据受 PlantUML JAR、JVM、Graphviz 和字体影响。编译成功与非空产物是稳定门禁，跨机器字节一致不是。

对一组双语文档，只由规范英文 Markdown 持有 PlantUML 围栏块。中文译本引用同一份英文 SVG，并可链接到英文源文档；不复制第二份可编辑图源。

## 命令

| 命令 | 职责 |
| --- | --- |
| `npm run check:archify` | 校验 vendored 集成、逐份执行 showcase 9/9、确认 HTML 新鲜度与原生 PNG 边界 |
| `npm run gen:archify` | 原子刷新全部 Archify HTML |
| `npm run review:archify -- <source>` | 交付单图、收集四档视口证据并刷新 Viewer 原生 PNG |
| `npm run check:plantuml` | 安全编译所有 Markdown PlantUML 块，并要求提交非空 SVG |
| `npm run gen:plantuml` | 编译全部 PlantUML 块并原子刷新引用的 SVG |
| `npm run check:diagrams` | 聚合两套检查 |
| `npm run gen:diagrams` | 同时刷新 Archify HTML 与 PlantUML SVG |

PlantUML 与浏览器视觉复核不进入纯 Node 的 `npm run quality`。独立 Linux `diagrams` CI job 安装 Java、校验固定 JAR 并运行聚合门禁。

## 便携、隐私与外部服务

仓库 Markdown 保留可维护的本地源和产物。带 Archify 图的 Markdown 可按[便携单文件文档](portable-documents-zh.md)导出。当前便携导出器把 SVG 视为主动内容并明确拒绝，因此暂不导出带 PlantUML SVG 的 Markdown；若必须单文件交付，应优先选择 Archify PNG，或等待另行设计 SVG 清洗/栅格化契约，不能绕过包装器。

两种工具都不新增运行时分析、遥测、用户数据收集或读者侧第三方服务。Archify 产物完全离线；PlantUML 唯一网络步骤是 CI 校验摘要后下载固定官方 JAR，编译过程禁止外部 include。
