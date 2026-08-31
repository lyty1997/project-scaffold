# Codex Rule Index

English | [Chinese](global-AGENTS-zh.md)

The root [AGENTS.md](../AGENTS.md) always applies. This file only routes tasks to focused rules: identify the task type first, then read the relevant rule instead of preloading all of `codex-rules/`. Design facts remain in the documents indexed by [docs/README.md](../docs/README.md).

| Task touches | Read |
| --- | --- |
| Complex implementation, cross-layer changes, or pending decisions | [Codex workflow](rules/codex-workflow.md) |
| Writing or splitting issues, or cross-module contracts | [Issue workflow](rules/issue-workflow.md) |
| Content sections, public claims, products, or feedback capabilities | [Content and product](rules/content-product-rules.md) |
| Pages, interaction, styling, or frontend dependencies | [Frontend web](rules/frontend-web-rules.md) |
| `docs/`, Markdown, Archify, or PlantUML diagrams | [Markdown documentation](rules/markdown-docs.md) |
| User communication, public copy, or comment style | [Language and explanation](rules/language.md) |
| Credentials, personal data, or external content | [Security and privacy](rules/security-privacy.md) |
| Command, tool, permission, or network failures | [Tool failure handling](rules/tool-failure.md) |
| Branches, commits, push, PR, or CI | [Git workflow](rules/git-workflow.md) |
| CI/CD setup or changes, deployment, releases, or rollback | [CI/CD workflow](rules/cicd-workflow.md) |

Also read [Known Issues](known-issues.md) when a task touches scripts, cross-platform behavior, Git hooks, scanners, Archify, or PlantUML. Resolve conflicts in this order: system / developer / explicit user instruction, root `AGENTS.md`, `docs/` design, then these execution rules. Ask the user to decide if a same-level conflict cannot be verified.
