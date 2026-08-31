# Markdown 文档规范

## 内容与结构

- 按需说明目的、边界、模型或接口、风险和验收标准，避免套用空章节。
- 待决策事项统一标为“待确认”，集中记录到 `docs/architecture/open-decisions.md`。
- 重要设计文档维护状态、适用范围和最近更新时间；设计变更写明影响与待验证项。
- 新增 `docs/**/*.md` 必须在 `docs/README.md` 建立链接索引。
- 内部链接不得断开或逃逸仓库；外部链接优先使用官方文档或原始出处。

## 图表

- Codex 从 `.agents/skills/archify/SKILL.md` 原生发现 `archify`，执行内容以项目内唯一的 [Archify Skill 实现](../../.claude/skills/archify/SKILL.md) 为准；不新增 PlantUML、Mermaid、无源码截图或手写 SVG/PNG。极简目录树可用 ASCII。
- Typed JSON 是唯一可编辑真相源；同名 `.archify.html` 是交互产物，`.archify.png` 必须由 Viewer 原生导出且不含 Viewer chrome。Markdown 同时链接三者，不复制 JSON 正文；整页截图只作临时视觉证据。
- 新增或修改图表必须完成 `showcase` 9/9 校验、HTML 确定性生成、四档桌面包含性检查和深浅主题人工复核。命令、固定版本与离线边界见 [Archify 图表系统](../../docs/architecture/diagram-system.md)。
- 图表保持简单可读，并配套文字说明。
- 需要把带图 Markdown 单独移出仓库时，按[便携单文件文档](../../docs/architecture/portable-documents.md)运行 `npm run export:portable-docs -- <source.md>`；不要把仓库三联引用改成远程 URL，也不要提交 `build/portable-docs/`。

## 归档

持续追加的进度或待决策文档过长时，将已结束且不再变化的历史移入只读的 `*.archive.md`，主文件保留归档链接和仍有效内容。归档文件同样加入 `docs/README.md`，无需为拆分另建门禁。
