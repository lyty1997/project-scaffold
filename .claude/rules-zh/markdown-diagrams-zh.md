# Markdown 绘图规范

[English](../rules/markdown-diagrams.md) | 中文

## 一、互补工具

Archify 与 PlantUML 配合使用，按交付契约选择：

| 需求 | 工具 |
| --- | --- |
| 架构总览、复杂流程/泳道、数据流、生命周期、演示图 | Archify |
| 交互 Viewer、深浅主题、搜索、路径追踪、canonical 高清 PNG | Archify |
| Markdown 内联、快速修改、清晰文本 diff | PlantUML |
| ERD/Class、精确状态机、局部时序/活动图 | PlantUML |
| 用 CI 快速验证大量技术图 | PlantUML |

用户明确指定工具时优先遵守。两者都能表达的类型中，Archify 负责展示与探索，PlantUML 负责紧凑内联、精确建模和批量验证。

不得为同一张图同时维护等价的 Archify JSON 与 PlantUML；同一文档中真正不同的局部视角可以选不同工具。

不新增 Mermaid、手写 SVG 或没有可编辑源的截图。极简目录树可用 ASCII。

## 二、Archify 闭环

调用项目 `archify` Skill，走完“选类型 → Schema/示例 → Typed JSON → validate → deliver → visual-check → 人工复核”。

产物三联为：

```text
<name>.<type>.json
<name>.archify.html
<name>.archify.png
```

- Typed JSON 是唯一可编辑源。
- HTML 是交互产物。
- PNG 必须由 Viewer 原生 canonical 导出，且不包含 Viewer chrome。
- Markdown 必须同时链接三件产物。
- 验收要求 showcase 9/9、0 errors、0 warnings、四档桌面端包含性检查、深浅两种主题人工复核，以及 `canonical=true` 的 PNG 证据。

使用 `npm run check:archify`、`npm run gen:archify` 和 `npm run review:archify -- <source>`。

## 三、PlantUML 闭环

调用 `.claude/skills/plantuml-in-markdown/SKILL-zh.md`，走完“选类型 → 提取 → 编译 → 修复 → 写回 → 全量编译”。

- 围栏语言固定为 `plantuml`，源码包含 `@startuml` 与 `@enduml`。
- 每个块后至多隔一个空行，必须引用生成的本地 `.svg`。
- Markdown 块是唯一可编辑源，不手改 SVG。
- 双语文档只由规范英文 Markdown 持有源码块；中文译本复用 SVG。
- 禁止 include/import 指令，保证自包含、安全编译。
- 设置 `PUML_JAR=/absolute/path/to/plantuml.jar` 后运行 `npm run gen:plantuml` 与 `npm run check:plantuml`。
- 实际查看最终 SVG；JAR、JVM、Graphviz 和字体会影响布局，因此不跨机器比较 SVG 字节。

不要默认使用泳道图。静态结构用组件图，调用与返回用时序图，分支管线用活动图，数据模型用 ERD/Class，状态转移用状态图。

## 四、CI 与便携导出

`npm run check:diagrams` 聚合两套检查。CI 的 `diagrams` job 使用 vendored Archify 与校验 SHA256 的固定 PlantUML JAR。PlantUML 和 Chrome 视觉复核不进入纯 Node 的 `npm run quality` 基线。

由 Archify 提供图片的 Markdown 可以运行 `npm run export:portable-docs -- <source.md>`。PlantUML SVG 是仓库中的生成产物，并继续由其 Markdown 源文档链接。
