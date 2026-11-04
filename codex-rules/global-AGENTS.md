# Task Rule Index

[AGENTS.md](../AGENTS.md) applies throughout. Read only matching rows; links do not preload their targets. Route project facts through [docs/](../docs/README.md) and scaffold maintenance through [scaffold/docs/](../scaffold/docs/README.md).

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
| Requested comparison or synchronization of sibling rules | [Synchronization Skill](../.claude/skills/sync-shared-rules/SKILL.md) |
| Scientific image cannot be viewed directly | [Image preview Skill](../.claude/skills/view-gel-image/SKILL.md) |
| Python | [Python](../.claude/rules/python-coding-rules.md) |
| TypeScript / JavaScript | [TypeScript](../.claude/rules/typescript-coding-rules.md) |
| Tasks, subprocesses, shutdown | [Resources](../.claude/rules/concurrency-resource-safety.md) |

Skill paths work without native discovery. Use project procedures for project artifact contracts; same-name installed Skills may differ. Do not copy implementations into discovery directories.

For scripts, hooks, scanners, platform behavior, or diagrams, read relevant [Known Issues](known-issues.md) rows. Follow host precedence and directory-scoped instructions; use designs for facts and rules/Skills for execution. Resolve conflicts from evidence before asking. No document expands authorization.
