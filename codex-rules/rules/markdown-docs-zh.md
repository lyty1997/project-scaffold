# Markdown 文档规范

[English](markdown-docs.md) | 中文

## 内容与结构

- 按需说明目的、边界、模型或接口、风险和验收标准，避免套用空章节。
- 待决策事项统一集中记录到 `docs/architecture/open-decisions-zh.md`。
- 重要设计文档维护状态、适用范围和最近更新时间。
- 新增 `docs/**/*.md` 后必须在对应语言索引建立链接。
- 内部链接不得断开或逃逸仓库；外部链接优先使用官方文档或原始出处。

## 图表工具选择

Archify 与 PlantUML 是互补关系。按交付和维护需求选择，不能按图类型一刀切。

| 需求 | 工具 |
| --- | --- |
| 架构总览、复杂流程/泳道、数据流、生命周期或演示图 | Archify |
| 交互、深浅主题、搜索、路径追踪或 canonical 高清 PNG | Archify |
| Markdown 内联、快速修改和清晰文本 diff | PlantUML |
| ERD/Class、精确状态机或局部时序/活动图 | PlantUML |
| 用 CI 快速验证大量技术图 | PlantUML |

用户明确指定工具时优先遵守。对两者都能表达的类型：交付物包含独立 Viewer 或展示质量时选 Archify；内联归属、精确建模和源码审查更重要时选 PlantUML。

不得为同一张图同时维护等价的 Archify JSON 与 PlantUML。一个文档可以用两种工具表达真正不同的视角。

## Archify 契约

- Codex 从 `.agents/skills/archify/SKILL.md` 发现 `archify`；规范实现为项目 vendored 的 [Archify Skill](../../.claude/skills/archify/SKILL.md)。
- Typed JSON 是唯一可编辑真相源；同名 `.archify.html` 是交互产物，`.archify.png` 是不含 Viewer chrome 的原生 canonical 导出。
- Markdown 同时链接 PNG、HTML 和 JSON；整页截图只作临时视觉证据。
- 新增或修改图必须完成 showcase 9/9、HTML 确定性交付、四档桌面包含性检查和深浅主题人工复核。

## PlantUML 契约

- 使用项目 [PlantUML in Markdown Skill](../../.claude/skills/plantuml-in-markdown/SKILL-zh.md)，遵守“选类型 → 提取 → 编译 → 修复 → 写回 → 全量编译”闭环。
- Markdown 围栏代码块是唯一可编辑真相源；每个块后必须引用生成的本地 SVG，供 GitHub 展示。
- 双语文档中只由规范英文 Markdown 持有围栏块；中文译本复用 SVG，不复制源码。
- 修改源码后运行 `npm run gen:plantuml`，交付前运行 `npm run check:plantuml`；`PUML_JAR` 必须指向本地固定 JAR。
- 禁止远程/本地 include 指令，不手改生成 SVG。实际查看最终 SVG，但不跨机器比较字节。

每张图都应简单可读，并用正文说明事实边界。带 Archify 图片的便携文档遵循[便携单文件文档](../../docs/architecture/portable-documents-zh.md)。

## 归档

持续追加的进度或决策文档过长时，把已完成且不再变化的历史移入只读 `*.archive.md`；主文件保留链接，并把归档加入两种语言索引。
