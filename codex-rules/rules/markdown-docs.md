# Markdown 文档规范

## 语言与结构

- `docs/` 文档使用简体中文，标准英文术语可保留原文。
- 文档应说明目的、边界、内容模型、接口、风险和验收标准。
- 对不确定事项使用“待确认”，并集中记录在 `docs/architecture/open-decisions.md`。
- 修改设计时同步检查 `docs/architecture/open-decisions.md`。

## 图表

- 统一使用 PlantUML，禁止 Mermaid、ASCII art、截图贴图或直接贴 SVG/PNG 二进制（无源不可维护）；极简目录树可保留 ASCII。
- 新增/修改图表必须真实编译验证（`java -jar plantuml.jar`），不能只凭"看起来对"交付；细则、图类型选择速查表和常见坑点见 `.claude/rules/markdown-diagrams.md` 与 `.claude/skills/plantuml-in-markdown/`。
- GitHub 不原生渲染 PlantUML：每个 ` ```plantuml ` 代码块下方应紧跟一张渲染好的图片引用（`![](../diagrams/<name>.svg)`），源码块保留用于编辑与 diff，渲染产物落在 `docs/diagrams/`。改完图源码后跑 `PUML_JAR=/path/to/plantuml.jar npm run gen:diagrams` 自动重新渲染并覆盖对应 SVG，不用手工跑 `java -jar` 再复制文件。
- CI 有一道独立门禁（不在 `npm run quality` 聚合链路里，需要本机装 Java + 设置 `PUML_JAR` 才能跑）：`check:diagrams` 校验所有 ` ```plantuml ` 块能编译通过。**不校验已提交 SVG 是否与源码一致**——PlantUML 的 SVG 字节依赖运行环境的字体度量、跨机器不可复现，字节相等的新鲜度门禁无法稳定通过，所以 `gen:diagrams` 只是本地生成器。细则见 `.claude/rules/markdown-diagrams.md`。
- 图表应保持简单、可读，不能用图替代文字说明。

## 链接与索引

- 新增 `docs/` Markdown 文件必须在 `docs/README.md` 建立索引。
- 内部链接必须可解析，不能跳出仓库。
- 外部链接应优先指向官方文档或原始出处。

## 变更记录

重要设计文档应维护最近更新时间、状态和适用范围。对定位、信息架构、内容模型、产品服务和部署方式的变更，需要说明影响和待验证项。

## 大文档的归档拆分

`docs/progress.md`、`docs/architecture/open-decisions.md` 这类按时间持续追加的文档，增长到难以通读（例如显著超出正常阅读长度，或跨越多个季度/里程碑）时，应拆出一份只读的 `*.archive.md`：

- 归档文件只承接"已经尘埃落定、不会再变"的历史内容（已解决的待决策问题、已过去的进度时间线）。
- 主文件顶部保留一条指向归档文件的链接，只留活跃/仍然有效的内容。
- 拆分本身是一次性操作，不需要为它建立自动化门禁；发现主文件已经膨胀到难读时手动拆一次即可。

