# Markdown 内的 PlantUML

[English](SKILL.md) | 中文

PlantUML 适合源码直接放在 Markdown 中、便于 diff 的局部技术图。需要独立精美 Viewer、丰富交互、引导探索、深浅主题或 canonical 高清位图导出时，改用项目的 `archify` Skill。

不得为同一张图同时维护等价的 PlantUML 与 Archify 源。同一文档可以用两种工具表达不同视角。

## 强制闭环

每次新增或修改 PlantUML 块都必须完成：

1. 选择与信息匹配的图类型。
2. 把 Markdown 中每个 PlantUML 块提取为独立 `.puml`。
3. 用本地固定 JAR 逐图编译并检查真实错误。
4. 只修复诊断指出的源码，再次编译。
5. 把验证后的源码写回 Markdown。
6. 重新提取并全量编译整份文档。
7. 运行 `npm run gen:plantuml`，实际查看 SVG，再运行 `npm run check:plantuml`。

辅助命令：

```bash
export PUML_JAR=/absolute/path/to/plantuml.jar
bash .claude/skills/plantuml-in-markdown/scripts/extract_and_compile.sh path/to/doc.md
python3 .claude/skills/plantuml-in-markdown/scripts/write_back.py path/to/doc.md <命令输出的目录>
```

只有退出码为 0 且生成非空图片才算成功；“看起来应该能编译”不算验证。

## 图类型选择

| 要表达的信息 | 首选 PlantUML 类型 |
| --- | --- |
| 静态结构、分层、组件依赖 | 组件图 |
| 参与者之间的请求、返回或消息 | 时序图 |
| 单向处理或数据转换 | 带 `partition` 的活动图 |
| 含循环和条件分支的算法 | 活动图 |
| 实体关系或类结构 | ERD/Class 图 |
| 状态转移和请求生命周期 | 状态图 |
| 多参与者且每方都有多个内部步骤 | 泳道活动图 |

不要默认使用泳道图。只有多个参与者各自确有内部步骤时才适合泳道。A → B → C 这类接力通常适合活动图；调用并等待返回通常适合时序图。

## 仓库契约

- Markdown 围栏语言必须写成 `plantuml`。
- 每个块必须包含 `@startuml` 和 `@enduml`。
- 每个块后至多隔一个空行，必须紧跟非空的本地 `.svg` 图片引用，供 GitHub 展示。
- Markdown 代码块是唯一可编辑真相源；SVG 由 `npm run gen:plantuml` 生成。
- 禁止 `!include`、`!includeurl`、`!import` 等指令。图必须自包含，并能在 PlantUML `SECURE` profile 下编译。
- 作者文字使用文档主语言；标识符、协议、命令和产品名保持原样。
- 不手改生成 SVG，也不跨机器比较其字节；布局会受到 JAR、JVM、Graphviz 和字体影响。

## 收工检查

- 图类型与信息匹配。
- 每份提取源码退出码为 0。
- 写回后再次全量编译通过。
- `npm run gen:plantuml` 为每个块生成非空 SVG。
- 已实际查看 SVG 的标签、方向与完整性。
- `npm run check:plantuml` 通过。
