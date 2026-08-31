# Codex 规则索引

[English](global-AGENTS.md) | 中文

根目录 [AGENTS-zh.md](../AGENTS-zh.md) 是本规范的中文译本，英文 [AGENTS.md](../AGENTS.md) 始终生效。本文件只负责路由：先判断任务类型，再读取对应规则；不要预加载整个 `codex-rules/`。设计事实仍以 [docs/README-zh.md](../docs/README-zh.md) 索引的文档为准。

| 任务触点 | 读取规则 |
| --- | --- |
| 复杂实现、跨层改动、需求存在待决策项 | [Codex 工作流](rules/codex-workflow-zh.md) |
| 编写或拆解 issue、跨模块契约 | [Issue 工作流](rules/issue-workflow-zh.md) |
| 内容栏目、公开表达、产品或反馈能力 | [内容与产品](rules/content-product-rules-zh.md) |
| 页面、交互、样式、前端依赖 | [网站前端](rules/frontend-web-rules-zh.md) |
| `docs/`、Markdown、Archify 或 PlantUML 图表 | [Markdown 文档](rules/markdown-docs-zh.md) |
| 用户沟通、公开文案、注释风格 | [语言与解释](rules/language-zh.md) |
| 凭证、个人数据、外部内容 | [安全与隐私](rules/security-privacy-zh.md) |
| 命令、工具、权限或网络失败 | [工具失败处理](rules/tool-failure-zh.md) |
| 分支、提交、push、PR 或 CI | [Git 工作流](rules/git-workflow-zh.md) |
| 搭建或修改 CI/CD、部署、发版、回滚 | [CI/CD 工作流](rules/cicd-workflow-zh.md) |

任务触及脚本、跨平台、Git hooks、扫描器、Archify 或 PlantUML 时，再查 [已知注意事项](known-issues-zh.md)。规则冲突按“系统 / 开发者 / 用户显式指令 → 根 `AGENTS.md` → `docs/` 设计 → 本目录执行细则”处理；同级冲突无法查证时请用户决定。
