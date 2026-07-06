# __PROJECT_NAME__ - 项目规范

## 核心原则

**先定位，后实现；先内容可信，后视觉表现。** 任何信息架构、产品服务、内容栏目、路由结构、公开文案、数据采集、用户交互和部署方式相关改动，必须先更新 `docs/` 中的设计文档或说明，再进入代码实现。

__PROJECT_NAME__ 是__PROJECT_TAGLINE__。所有对外展示内容必须可追溯、可维护、可演进，避免为了短期展示引入难以解释的结构和过度包装。

这是一个用 `scripts/init.mjs` 初始化过的项目脚手架产出物。首次使用请先跑 `npm run init`（或 `node scripts/init.mjs`）完成占位符替换——如果文档里还能看到"两个下划线包裹的大写标记"这种文本，说明还没初始化。

## 工作流程

1. 阅读 `docs/README.md` 和任务相关设计文档。
2. 明确改动是否影响定位、信息架构、内容模型、路由、SEO、部署、用户数据或产品服务边界。
3. 影响上述范围时，先更新设计文档、契约词表或待决策问题。
4. 再进行代码、样式、内容或 CI 修改。
5. 完成后运行相关质量门禁，并汇报验证结果。

## 项目规范入口

Codex 执行任务时，除本文件外还必须参考 `codex-rules/`：

- `codex-rules/global-AGENTS.md`：Codex 全局入口和规则索引。
- `codex-rules/known-issues.md`：已知工具、仓库状态和网站开发注意事项。
- `codex-rules/rules/codex-workflow.md`：通用工作流程。
- `codex-rules/rules/issue-workflow.md`：Issue 编写与拆解规范（新模块先对齐 API、自测证据、复杂任务拆子 issue）。
- `codex-rules/rules/content-product-rules.md`：内容、产品服务和公开表达规则。
- `codex-rules/rules/frontend-web-rules.md`：网站前端与交互规范。
- `codex-rules/rules/markdown-docs.md`：Markdown 设计文档规范。
- `codex-rules/rules/language.md`：语言、注释和解释规范。
- `codex-rules/rules/security-privacy.md`：密钥、隐私和公开内容安全规范。
- `codex-rules/rules/tool-failure.md`：工具失败处理规范。
- `codex-rules/rules/git-workflow.md`：Git 工作流规范。

## 目录职责

具体目录结构以你项目实际情况为准，下面是脚手架起步时的默认示例：

- `public/`：起步阶段的占位静态入口，一旦有了真正的前端应用会被替换或删除。
- `docs/`：定位、架构、内容模型、产品服务演进和契约词表的真相源。
- `codex-rules/`：Agent 执行任务时的操作规范，**不替代** `docs/` 设计真相源。
- `scripts/quality/`：CI 与本地共用的质量门禁（Node.js ESM，零第三方依赖）。
- `scripts/dev/`：双向同步与跨机协同预览工作流脚本，见 [docs/architecture/dev-workflow.md](docs/architecture/dev-workflow.md)。
- `.github/`：CI、CODEOWNERS 和 PR 模板。

演进原则：引入框架（前端框架、后端框架、数据库、CMS、搜索等）前，先在 [docs/architecture/open-decisions.md](docs/architecture/open-decisions.md) 记录"框架解决什么问题"的决策，再改实现；不为短期展示引入难以解释的结构和过度包装。

## 技术栈（首版）

- 本脚手架不预设你的技术栈。起步阶段默认提供一个占位的零依赖静态入口（`public/index.html`），如果你还没决定前端框架，可以先用它占位展示，也可以直接删掉。
- 质量脚本：Node.js ESM，位于 `scripts/quality/`。
- CI：GitHub Actions，运行 `npm run quality`。
- 一旦确定了实际的前端框架、后端框架、数据库等技术选型，必须先在 `docs/architecture/open-decisions.md` 记录决策（解决什么问题、为什么选它），再动手实现；不得先写代码后补文档；确定 Python/TypeScript 技术栈后可参考 [docs/architecture/stack-recipes/](docs/architecture/stack-recipes/README.md) 里的现成配置。

## 常用命令

```bash
# 首次使用本脚手架：替换占位符，按提示填写项目信息
npm run init

# 全量质量门禁（与 CI 对齐）
npm run quality

# 单项门禁
npm run check:docs        # Markdown 内部链接 + docs/README 索引完整性
npm run check:contracts   # 契约词表：禁用旧名回潮 + 契约词跨层误用 + canonical/枚举来源
npm run check:secrets     # 常见密钥形态扫描
npm run check:site        # 静态站点入口和资源引用（如果还没有静态入口会自动跳过）
npm run check:js          # 质量脚本自身语法自检（node --check）

# 不在 quality 聚合链路里，需要本机装 Java 并设置 PUML_JAR 才能跑
PUML_JAR=/path/to/plantuml.jar npm run check:diagrams   # 编译校验所有 Markdown 里的 plantuml 图表
PUML_JAR=/path/to/plantuml.jar npm run gen:diagrams     # 改完图表源码后，重新渲染 docs/diagrams/ 下的 SVG
```

首版不依赖任何第三方 npm 包，`quality` 全部走 Node.js 内置能力（要求 Node ≥ 22）；`check:diagrams` 依赖外部 Java + `plantuml.jar`，是刻意排除在 `quality` 之外的例外，CI 由专属 job 负责装好依赖后执行，见下方"文档一致性门禁现状"。

## 文档一致性门禁现状

`npm run quality` 由五个步骤串联（先 `check:js` 做脚本自检，再跑四道内容门禁），任一失败即 CI 失败（`.github/workflows/ci.yml` 在 PR、推送 `main`/`dev` 时于 Ubuntu 与 Windows 上运行同一命令）：

- `check:js`（`node --check`）：对 `scripts/init.mjs`、`scripts/quality/lib/` 下的共享模块及所有门禁/图表脚本（含不属于 `quality` 聚合链路的 `check-diagrams.mjs`、`render-diagrams.mjs`）做语法自检，防止脚本自身语法错误在运行时才暴露。
- `check:docs`（`scripts/quality/check-markdown.mjs`）：校验所有 `*.md` 的内部链接不断链、不逃逸仓库（跳过围栏/行内代码里的示例链接）；并强制 **`docs/` 下每个 `.md` 都被 `docs/README.md` 以链接形式索引**。新增 `docs/` 文档后必须在 `docs/README.md` 补索引，否则门禁失败。
- `check:contracts`（`scripts/quality/check-contracts.mjs`）：真相源是 [docs/contracts/contract-terms.json](docs/contracts/contract-terms.json)（稳定契约名/枚举）与 [docs/contracts/contract-rules.json](docs/contracts/contract-rules.json)（`forbidden_terms` 防旧名回潮、`scoped_terms` 防契约词跨层误用）。扫描范围由 `contract-rules.json` 的 `scan.roots` 决定，脚手架默认值只是全栈项目的常见示例，请按你项目实际的顶层目录调整。改契约名先动这两个 JSON。
- `check:secrets`（`scripts/quality/check-secrets.mjs`）：扫描常见密钥形态，防止 token/密钥误入库。
- `check:site`（`scripts/quality/check-static-site.mjs`）：读取 [docs/contracts/site-checks.json](docs/contracts/site-checks.json) 里配置的入口文件路径和必需片段；如果配置的入口文件还不存在（比如你还没搭建前端），这一项门禁会打印提示并直接跳过，不会因为"还没有前端"而报错。一旦有了真正的入口文件，改动它的结构或必需片段时同步改 `site-checks.json`。

本地提交前会由 `.githooks/pre-commit` 自动跑 `npm run quality`、`.githooks/commit-msg` 校验提交信息格式（首次克隆后执行 `git config core.hooksPath .githooks` 启用）；它们是 CI 的本地镜像，别绕过。

另有两道独立于 `quality` 之外、围绕 PlantUML 图表的机制，共享 `scripts/quality/lib/plantuml.mjs` 的提取/编译逻辑：

- `check:diagrams`（`scripts/quality/check-diagrams.mjs`）：扫描所有 Markdown 里的 ` ```plantuml ` 代码块并用 `java -jar $PUML_JAR` 真实编译，仓库里一个 plantuml 块都没有时直接跳过；一旦有块但没设置 `PUML_JAR` 则报错退出（不静默跳过，因为确实有东西要校验）。只认编译退出码，不比较字节内容——不同 PlantUML 版本渲染同一份源码字节不同，本地用任意版本的 jar 跑这个检查都该稳定通过。
- `gen:diagrams`（`scripts/quality/render-diagrams.mjs`）：把每个 plantuml 块编译结果写入紧跟其后的 `![](path.svg)` 图片引用指向的文件，实现"改源码 → 自动重新渲染 `docs/diagrams/` 下的 SVG"，不用再手工 `java -jar` + 复制文件。这是**本地生成器、不是门禁**——CI 不校验已提交 SVG 与源码是否字节一致。原因：PlantUML 的 SVG 字节不仅依赖版本，还依赖运行环境的 JVM 字体度量（`textLength`/坐标/整图尺寸都按字体 metrics 反推），同一份源码在不同机器上渲染字节不同，任何"字节相等"的新鲜度门禁都无法跨机器稳定通过。真相源是 markdown 里的 plantuml 源码（由 `check:diagrams` 保证能编译）；SVG 只是给 GitHub 这类不渲染内嵌 plantuml 代码块的平台看的产物，改完源码本地跑一次 `gen:diagrams` 刷新并提交即可。

CI 里由 `.github/workflows/ci.yml` 的独立 `diagrams` job（只跑 ubuntu-latest）负责下载校验过 SHA256 的 PlantUML 官方 release jar，跑 `check:diagrams`（只校验 plantuml 源码能编译，不比较 SVG 字节），不需要本地贡献者都装 Java 才能跑主 `quality` 门禁。

## 工程约定

- 分支：`main` 稳定不直接提交，`dev` 开发主干，特性分支 `feature/描述` / `bugfix/描述`。提交信息主题行采用中英双语、英文在前，格式 `<type>(<scope>): <English 主题> / <中文主题>`（用 ` / ` 分隔英文与中文），不带 Co-Authored-By；`.githooks/commit-msg` 会机器校验此格式。
- `.env`、`node_modules/`、构建产物、日志、`scripts/dev/dev-workflow.env` 不进 Git（见 `.gitignore`）。
- 每次任务结束更新 [docs/progress.md](docs/progress.md)（时间戳/主题/完成/遗留）；解决 bug 后把原因和方案追加到 [codex-rules/known-issues.md](codex-rules/known-issues.md)，动手前先查阅它避免重复踩坑。

## Codex 工作约束

- 任务开始前先读 `docs/README.md`、`codex-rules/global-AGENTS.md` 和本次任务相关规则。
- 涉及定位、信息架构、内容模型、路由结构、SEO、部署、用户数据、评论、订阅、产品服务的改动，先更新 `docs/`，再编码。
- 手工编辑文件使用 `apply_patch`；不得回滚用户已有改动。
- 代码改动后运行相关格式化、lint、typecheck、test 或 `npm run quality`；无法运行时说明原因。
- UI 改动必须做实际渲染或截图验证；纯静态页面至少检查入口文件、资源引用和关键链接。
- 工具失败后先分析原因再换方式处理，禁止重复同一失败调用。
- 不提交、不打印、不写入文档或代码中的 API Key、Secret、token、密码、真实账户、真实联系方式隐私、未公开商业计划或客户数据。
- 不执行破坏性命令，除非用户明确要求并确认风险。
- 任务结束时汇报改动摘要、验证结果和遗留问题。

## 内容与产品边界

- 内容和产品描述必须清晰、可信，不做夸张营销承诺。
- 产品服务上线前必须明确：目标用户、核心问题、服务边界、隐私边界、收费或商业化假设、支持与反馈入口。
- 公开文章、案例和讨论材料应区分事实、观点、计划和待确认事项。
- 对尚未发布的产品能力，使用"计划""探索""待确认"等表达，不写成已交付事实。
- 如引用外部资料，优先引用官方文档或原始出处，并保留链接。

## 文档语言规范

- 与用户对话：中文。
- `docs/` 文档：简体中文，标准英文术语可保留英文。
- 代码注释：中文为主，标准英文术语、协议名、API 名保持原文。
- 用户可见 UI 文案：默认简体中文。
