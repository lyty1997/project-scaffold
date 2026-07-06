# CLAUDE.md

本文件为 Claude Code（claude.ai/code）在本仓库工作时提供指引。为避免与 [AGENTS.md](AGENTS.md) 重复维护同一份规范、日久产生漂移，本文件正文直接导入 AGENTS.md（Claude Code 原生的 `@路径` 导入语法），只在下方补充 Claude Code 专属的部分——AGENTS.md 才是 Codex 与 Claude Code 共享的操作规范唯一真相源。

@AGENTS.md

## Claude Code 专属配置

除上方 AGENTS.md 的规范外，本仓库还有一层只对 Claude Code 生效的项目级配置（Codex 不读取），与 `codex-rules/` 是并行的两层：

- `.claude/rules/*.md`：随仓库自动加载的编码规范（Python/TypeScript 质量、并发与资源安全、Git 工作流、工具失败处理、Markdown 绘图、Issue 拆解等），比 `codex-rules/rules/` 更细致、偏工具链落地细节。两套规则同一主题可能并存，内容不完全一致，出现冲突时以更保守、更贴合本仓库实际质量门禁的一方为准，发现明显冲突应提出来对齐而不是默认二选一。
- `.claude/skills/`：`plantuml-in-markdown`（PlantUML 绘图闭环校验）、`view-gel-image`（大图/非常规格式图片安全预览）。
- `.claude/hooks/` + `.claude/settings.json`：`pre-edit-validate.py`（Write/Edit 前参数校验）、`post-edit-safety.py`（Write/Edit 后按扩展名自动跑 mypy/ruff/tsc/eslint/typos），随仓库自动生效；若个人全局 `~/.claude/settings.json` 也配置了同名 hook，两者会合并运行，不是互相覆盖。
