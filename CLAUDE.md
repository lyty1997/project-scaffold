# CLAUDE.md

本文件为 Claude Code（claude.ai/code）在本仓库工作时提供指引。它与面向 Codex 的 [AGENTS.md](AGENTS.md) 是同一套工程规范的两个入口，共享同一真相源 [docs/](docs/README.md)，不重复设计细节。

## 项目性质

这是一个用 `scripts/init.mjs` 初始化过的项目脚手架产出物。首次使用请先跑 `npm run init`（或 `node scripts/init.mjs`）完成占位符替换——如果你还能在文档里看到"两个下划线包裹的大写标记"这种文本，说明还没初始化。

本脚手架不预设具体前端/后端技术栈：起步阶段默认给一个占位的零依赖静态入口（`public/index.html`），一旦确定了实际的技术选型，先在 [docs/architecture/open-decisions.md](docs/architecture/open-decisions.md) 记录决策，再进入实现。

**铁律：先定位、设计，后编码。** 任何涉及定位、信息架构、内容栏目、路由结构、公开文案、SEO、部署、用户数据、评论、订阅、产品服务边界的改动，必须先更新 [docs/](docs/README.md) 对应设计文档并经确认，再写代码。改动前先读 [docs/README.md](docs/README.md) 确认当前真相源，绝不能凭代码现状推断设计意图——代码落后于文档。

## 内容与产品边界（最高优先级，覆盖一切展示诉求）

这是本项目的核心约束，不是可选项：

- 对尚未发布的产品能力，使用"计划""探索"等表达，**不写成已交付事实**；不写夸张营销承诺。
- 引入用户交互（评论/订阅/表单/分析）前，先明确隐私边界、滥用风险、数据字段、用途、存储与删除策略，并记入 [docs/architecture/open-decisions.md](docs/architecture/open-decisions.md)。
- 公开内容要区分事实、观点、计划和尚未确认的事项；引用外部资料优先官方文档或原始出处，并保留链接。
- 不写入、不打印、不提交 API Key、Secret、token、密码、真实账户、真实联系方式隐私、未公开商业计划或客户数据。

完整规则见 [codex-rules/rules/content-product-rules.md](codex-rules/rules/content-product-rules.md) 与 [codex-rules/rules/security-privacy.md](codex-rules/rules/security-privacy.md)。

## 架构

目录职责（详见 [docs/architecture/overview.md](docs/architecture/overview.md)，具体目录结构以你项目实际情况为准，下面是脚手架起步时的默认示例）：

- `public/`：起步阶段的占位静态入口，一旦有了真正的前端应用会被替换或删除。
- `docs/`：定位、架构、内容模型、产品服务演进和契约词表的真相源。
- `codex-rules/`：Agent 执行任务时的操作规范，**不替代** `docs/` 设计真相源。
- `scripts/quality/`：CI 与本地共用的质量门禁（Node.js ESM，零第三方依赖）。
- `scripts/dev/`：双向同步与跨机协同预览工作流脚本，见 [docs/architecture/dev-workflow.md](docs/architecture/dev-workflow.md)。
- `.github/`：CI、CODEOWNERS 和 PR 模板。

演进原则：引入框架（前端框架、后端框架、数据库、CMS、搜索等）前，先在 [docs/architecture/open-decisions.md](docs/architecture/open-decisions.md) 记录"框架解决什么问题"的决策，再改实现；不为短期展示引入难以解释的结构和过度包装。

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
```

首版不依赖任何第三方 npm 包，`quality` 全部走 Node.js 内置能力（要求 Node ≥ 22）。

## 工程约定

- 语言：对话与 `docs/` 用简体中文；代码注释中文为主，标准英文术语/协议名/API 名保留原文；用户可见 UI 文案默认简体中文。详见 [codex-rules/rules/language.md](codex-rules/rules/language.md)。
- 分支：`main` 稳定不直接提交，`dev` 开发主干，特性分支 `feature/描述` / `bugfix/描述`。提交信息中文，格式 `<type>(<scope>): <主题>`，不带 Co-Authored-By。
- `.env`、`node_modules/`、构建产物、日志、`scripts/dev/dev-workflow.env` 不进 Git（见 `.gitignore`）。
- UI 改动必须做实际渲染或截图验证；纯静态页面至少检查入口文件、资源引用和关键链接。
- 每次任务结束更新 [docs/progress.md](docs/progress.md)（时间戳/主题/完成/遗留）；解决 bug 后把原因和方案追加到 [codex-rules/known-issues.md](codex-rules/known-issues.md)，动手前先查阅它避免重复踩坑。

## 规则文件分层

操作规范在 [codex-rules/](codex-rules/global-AGENTS.md)（不替代 `docs/` 设计真相源）：`global-AGENTS.md` 是入口与索引，`known-issues.md` 是已知坑点，`rules/` 下按主题拆分（content-product / frontend-web / markdown-docs / language / security-privacy / tool-failure / git-workflow）。任务开始前按类型读取相关规则。根目录 [AGENTS.md](AGENTS.md) 是项目级最高规范，Claude Code 与 Codex 共同遵守。

## 文档一致性门禁现状

`npm run quality` 由四个门禁串联，任一失败即 CI 失败（`.github/workflows/ci.yml` 在 PR 与推送 `main` 时运行同一命令）：

- `check:docs`（`scripts/quality/check-markdown.mjs`）：校验所有 `*.md` 的内部链接不断链、不逃逸仓库；并强制 **`docs/` 下每个 `.md` 都被 `docs/README.md` 索引**。新增 `docs/` 文档后必须在 `docs/README.md` 补索引，否则门禁失败。
- `check:contracts`（`scripts/quality/check-contracts.mjs`）：真相源是 [docs/contracts/contract-terms.json](docs/contracts/contract-terms.json)（稳定契约名/枚举）与 [docs/contracts/contract-rules.json](docs/contracts/contract-rules.json)（`forbidden_terms` 防旧名回潮、`scoped_terms` 防契约词跨层误用）。扫描范围由 `contract-rules.json` 的 `scan.roots` 决定，脚手架默认值只是全栈项目的常见示例，请按你项目实际的顶层目录调整。改契约名先动这两个 JSON。
- `check:secrets`（`scripts/quality/check-secrets.mjs`）：扫描常见密钥形态，防止 token/密钥误入库。
- `check:site`（`scripts/quality/check-static-site.mjs`）：读取 [docs/contracts/site-checks.json](docs/contracts/site-checks.json) 里配置的入口文件路径和必需片段；如果配置的入口文件还不存在（比如你还没搭建前端），这一项门禁会打印提示并直接跳过，不会因为"还没有前端"而报错。一旦有了真正的入口文件，改动它的结构或必需片段时同步改 `site-checks.json`。

本地提交前会由 `.githooks/pre-commit` 自动跑 `npm run quality`（首次克隆后执行 `git config core.hooksPath .githooks` 启用）；它是 CI 的本地镜像，别绕过。
