# 使用说明

[English](SCAFFOLD.md) | 中文

这是一个以“文档先行、契约词表、质量门禁 CI、跨机协同预览”为核心的技术中立项目脚手架。它从 AxialMuseWebsite 项目抽象而来，不预设具体前端或后端技术栈。

## 起步步骤

1. 用这个仓库的内容作为新项目起点：可以 clone 后替换远端，也可以直接下载归档。
2. 运行 `node scripts/init.mjs` 或 `npm run init`，按提示填写项目名、品牌名和 GitHub 信息。若需要可选的跨机预览工作流（本地渲染端 + 远端托管端），选择启用并填写远端主机设置。脚本会替换全部占位符，最后运行 `npm run quality`。
3. 运行 `git config core.hooksPath .githooks` 启用本地 pre-commit 质量门禁和提交信息门禁。后者以零依赖方式强制 `<type>(<scope>): <English subject>` Conventional Commit 格式，无需 husky 或 commitlint。
4. 如果启用了跨机预览工作流，按 `docs/architecture/dev-workflow-zh.md` 的“远程重启”一节生成 SSH 密钥，并安装到远端 `~/.ssh/authorized_keys`。
5. 确认初始化后的项目正常后，同时删除 `SCAFFOLD.md` 与 `SCAFFOLD-zh.md`。这两份文件只适用于初始化前阶段；此后 `README.md` 与 `README-zh.md` 成为项目的常规入口。

## 包含内容

- 基于 `AGENTS.md` / `CLAUDE.md` 与 `codex-rules/` 的分层 Agent 规则。语言、安全隐私、工具失败和 Git 工作流等通用规则可直接复用；内容、产品和前端规则需按项目实际情况调整，但应保留文档先行、区分事实与计划的原则。
- `docs/` 设计文档骨架，覆盖架构、术语、待决策事项、内容路线和跨机预览。这些都是需要用项目事实补全的占位模板。英文文件是规范真相源，配对的 `-zh.md` 文件是持续维护的中文译本。
- `docs/contracts/`，其中 `check-contracts.mjs` 提供可复用的契约词表机制。`contract-terms.json` 与 `contract-rules.json` 中的词条和检查只是示例，需要替换成项目真实的品牌名、禁用旧名和跨层约束。`site-checks.json` 配置可选的静态入口检查；若项目没有 `public/index.html` 一类入口，检查会自动跳过。
- `scripts/quality/` 下的零依赖 Node.js 质量门禁：JavaScript 语法、Markdown 链接与双语索引、契约词表、密钥形态、静态入口、便携文档、CI/CD 契约和生成图表。CI 在 Ubuntu 与 Windows 上运行同一条基础命令。
- `scripts/docs/`，使用本机 Pandoc 2.12 或更高版本把带本地图片的 Markdown 导出为 `build/portable-docs/` 下的便携 HTML。图片会被内嵌，相对链接会变成路径提示，输出不提交仓库。
- 互补图表工作流：`.claude/skills/archify/` 中固定版本的 Archify 负责精美交互产物，`.claude/skills/plantuml-in-markdown/` 负责内联、易 diff 的技术图。选型、真相源、导出与组合 CI 契约见 `docs/architecture/diagram-system-zh.md`。
- `scripts/dev/` 下跨平台的 `sync.sh` / `sync.ps1`，以及可选的 `preview.sh`、`restart-remote.ps1` 和 `serve.py` 工作流。运行时设置位于已忽略的 `scripts/dev/dev-workflow.env`，初始化器可自动生成。

## 不包含内容

这不是预先配置 React、Vue、Express 或数据库的 starter。它提供协作、文档一致性、验证与预览这一层。实际前端、后端和数据库技术栈应按 `docs/architecture/open-decisions-zh.md` 中的方法选择并记录。
