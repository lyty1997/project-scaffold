# Markdown 绘图规范

## 一、强制工具：PlantUML

凡需要在 markdown 里绘制结构/流程/时序/状态/关系图，**统一使用 PlantUML**，禁用以下方式：

- ❌ ASCII art（`├─ │ ▼` 等字符画）—— 不可缩放、不可搜索、不可主题化、跨平台对齐易碎
- ❌ Mermaid —— 复杂图布局差，本仓库已明确统一用 PlantUML，不再按"是否约定渲染器"区分
- ❌ 截图贴图（除非外部白板原稿无源） —— 无法 diff、无法增量修改
- ❌ 直接贴 SVG/PNG 二进制 —— 源不可读，回归改图必返工

**唯一例外**：极简的目录树（`tree` 命令风格）可保留 ASCII，因为它本质是 text，不是 diagram。

## 二、强制 skill：plantuml-in-markdown

每次涉及 markdown 内 PlantUML 图的 **新增、修改、调试、报错处理**，**必须先调用 skill `plantuml-in-markdown`**。

理由：
- skill 内置"选对图类型 → 提取 → 编译 → 修复 → 写回"闭环，强制走 `java -jar plantuml.jar` 真编译验证
- skill 内置常见坑点知识库（泳道名跨行、if/else 切泳道、时序图 activate 重复、中文/特殊字符等）
- skill 自带 `extract_and_compile.sh` 与 `write_back.py`，避免手抄代码块出错

**反模式**：自己手写 PlantUML 直接交付而不编译，"看起来对就行"——PlantUML 错误是硬错误，不渲染就是不渲染。

## 三、图类型选择速查

不可"默认用泳道图"。动手前对照下表：

| 表达内容 | 正确图类型 |
|---|---|
| 静态结构 / 分层 / 组件依赖 | **组件图** `package` + `[component]` |
| 跨组件请求-响应调用 | **时序图** `participant` + `activate` |
| 单向处理流水线 / 数据变换 | **活动图 + partition** |
| 带循环/分支的算法流程 | **活动图** `while` + `if/else` |
| 状态机 / 生命周期 | **状态图** `state` + 转移 |
| 多参与者 + 每方内部多步 | **泳道图**（仅此场景） |

经验：写 `|泳道|` 前先反问"参与者真的有并行内部步骤吗？"——没有就别用。

## 四、必备约定

- 代码块围栏统一用 ` ```plantuml `（不是 `puml`/`uml`，避免平台兼容问题）
- jar 路径不写死：通过环境变量 `PUML_JAR` 指定（如 `export PUML_JAR=/path/to/plantuml.jar`），未设置时脚本会报错并提示
- 验证脚本：`bash .claude/skills/plantuml-in-markdown/scripts/extract_and_compile.sh <md> [out_dir]`
- 收工标准：每张图 `exit 0` + 生成非空 PNG/SVG，缺一不可

## 五、平台渲染情况

| 平台 | 支持 ` ```plantuml ` | 备注 |
|---|---|---|
| 语雀 / GitLab / Typora / VSCode MPE | ✓ | 默认或简单配置即可 |
| GitHub | ✗ | 需 CI 预渲染成 SVG 引用 |

若目标平台是 GitHub，写完图同时在 `docs/diagrams/` 落一份 SVG，紧跟在代码块下方用 `![](...)` 引用——这一步不用手动渲染，见下节 `npm run gen:diagrams`。

## 六、渲染产物自动生成与 CI 门禁

- **生成/刷新**：`npm run gen:diagrams`（`scripts/quality/render-diagrams.mjs`）扫描所有 ` ```plantuml ` 块，找到紧跟其后的 `![](path.svg)` 图片引用，编译并覆盖写入该路径；没有配图片引用的代码块会被跳过（只保证能编译，不强行猜文件名）。改完图源码后本地跑一次这个命令、把变化的 SVG 一并提交即可，不用再手工 `java -jar` + 复制文件。
- **`check:diagrams`**（`scripts/quality/check-diagrams.mjs`）：扫描仓库所有 plantuml 块真实编译校验，编译失败即报错退出。只认编译是否成功，不比较字节内容——不同 PlantUML 版本渲染同一份源码字节并不相同（版本号写进了 SVG 头），本地随便什么版本的 jar 都该能稳定跑这个检查。
- **不做"SVG 是否最新"的门禁**：曾经有过一道 `check:diagrams:fresh`（按字节比较"重新编译"与"已提交 SVG"），已废弃。PlantUML 的 SVG 字节不仅依赖版本，还依赖运行环境的 JVM 字体度量（`textLength`/坐标/整图尺寸都按字体 metrics 反推），同一份源码在不同机器上渲染字节不同，字节相等的新鲜度门禁无法跨机器稳定通过。所以真相源只认 plantuml 源码（`check:diagrams` 保证能编译），SVG 是给 GitHub 等平台看的产物，改完源码本地 `gen:diagrams` 刷新提交即可，CI 不再回头校验它。
- 以上都**不在** `npm run quality` 聚合链路里（`quality` 承诺零第三方依赖、纯 Node 内置能力，而这些依赖外部 Java + `plantuml.jar`），本地要跑必须先 `export PUML_JAR=/path/to/plantuml.jar`；CI 用专属的 `diagrams` job 自动装好 Java 和锁定版本的 jar，跑 `check:diagrams`，对每个 PR 强制生效。
