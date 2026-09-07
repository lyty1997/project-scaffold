# Task Rule Index

[AGENTS.md](../AGENTS.md) applies throughout. Read only matching rows; a link is a route, not a request to preload its targets. Design facts remain under [docs/](../docs/README.md).

| Task | Rule |
| --- | --- |
| Complex or cross-module implementation | [Workflow](rules/codex-workflow.md) |
| Issue decomposition or interface contracts | [Issues](rules/issue-workflow.md) |
| Public content, products, feedback | [Content](rules/content-product-rules.md) |
| Pages, interaction, styling | [Frontend](rules/frontend-web-rules.md) |
| Markdown or diagrams | [Documentation](rules/markdown-docs.md) |
| Explanations or comments | [Language](rules/language.md) |
| Credentials, data, external material | [Security](rules/security-privacy.md) |
| Tool, permission, network failure | [Tool failures](rules/tool-failure.md) |
| Branches, commits, push, PR, CI | [Git](rules/git-workflow.md) |
| CI/CD setup, deployment, release, rollback | [CI/CD](rules/cicd-workflow.md) |
| Python | [Python](../.claude/rules/python-coding-rules.md) |
| TypeScript / JavaScript | [TypeScript](../.claude/rules/typescript-coding-rules.md) |
| Tasks, subprocesses, shutdown | [Resources](../.claude/rules/concurrency-resource-safety.md) |

For scripts, hooks, scanners, cross-platform behavior, or diagrams, read relevant [Known Issues](known-issues.md) rows. Resolve conflicts by system/developer/user instruction, root rules, design, then execution guidance; verify same-level conflicts before asking for a user decision.
