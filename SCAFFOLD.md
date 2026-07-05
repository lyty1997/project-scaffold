# 使用说明

这是一个项目基础脚手架：一套"文档先行、契约词表防漂移、质量门禁 CI、跨机协同开发预览"的工程规范，从 AxialMuseWebsite 项目抽象而来，不预设具体前端/后端技术栈。

## 起步步骤

1. 用这个仓库的内容作为新项目的起点（clone 后改远端，或者直接下载解压）。
2. 运行 `node scripts/init.mjs`（或 `npm run init`），按提示填写项目名、品牌名、GitHub 信息；如果需要跨机协同预览工作流（本地渲染端 + 远端托管端），选择启用并填写远端主机信息。脚本会自动替换所有占位符标记，并在最后跑一次 `npm run quality` 自检。
3. 跑 `git config core.hooksPath .githooks` 启用本地 pre-commit 质量门禁。
4. 如果启用了跨机预览工作流，按 `docs/architecture/dev-workflow.md`"远程重启"一节生成 SSH 密钥并装到远端 `~/.ssh/authorized_keys`。
5. 确认没问题后删除这份 `SCAFFOLD.md`——它只是给"刚拿到脚手架、还没初始化"的阶段看的，初始化完成后 `README.md` 就是项目自己的正常 README 了。

## 这套脚手架包含什么

- `AGENTS.md` / `CLAUDE.md` 风格的 Agent 规则分层结构（`codex-rules/`）：语言、安全隐私、工具失败处理、Git 工作流等通用规则可以直接用；内容/产品规则、前端规则需要按你的项目实际情况调整措辞，但方法论（先设计后编码、区分事实与计划）是通用的。
- `docs/` 设计文档骨架：架构概览、术语表、待决策问题、产品路线图、跨机协同预览工作流，都是占位模板，需要你按项目实际情况填写。
- `docs/contracts/`：契约词表机制（`check-contracts.mjs`）本身是通用的，`contract-terms.json`/`contract-rules.json` 里的具体词条只是示例，需要替换成你项目自己的品牌词、禁用旧名、跨层误用检查规则。`site-checks.json` 是可选的静态入口检查配置，如果你的项目还没有 `public/index.html` 这类静态入口，对应的质量门禁会自动跳过。
- `scripts/quality/`：四个零依赖 Node.js 质量门禁（Markdown 链接与索引、契约词表、密钥扫描、静态入口检查），`npm run quality` 一键跑全部，CI（`.github/workflows/ci.yml`）跑的是同一条命令。
- `scripts/dev/`：`sync.sh`/`sync.ps1` 双向同步脚本开箱即用；`preview.sh`/`restart-remote.ps1`/`serve.py` 是跨机协同预览工作流的实现，依赖 `scripts/dev/dev-workflow.env`（本地文件，`init.mjs` 会帮你生成）。

## 不包含什么

这不是一个预置了 React/Vue/Express/数据库的全栈项目模板——它只提供"怎么协作、怎么保证文档和代码不漂移、怎么在两端预览"这一层。具体前端框架、后端框架、数据库怎么选，按 `docs/architecture/open-decisions.md` 的方法论自己决定并记录下来。
