# CLAUDE.md

本文件为 Claude Code（claude.ai/code）在本仓库工作时提供指引。为避免与 [AGENTS.md](AGENTS.md) 重复维护同一份规范、日久产生漂移，本文件正文直接导入 AGENTS.md（Claude Code 原生的 `@路径` 导入语法），只在下方补充 Claude Code 专属的部分——AGENTS.md 才是 Codex 与 Claude Code 共享的操作规范唯一真相源。

@AGENTS.md

## 导入内容里的 Codex 侧写法

AGENTS.md 约束所有 Agent，但个别条目沿用了 Codex 的工具名。Claude Code 按下面的对应关系执行，同一条目的其余要求照常适用：

- 「编辑与验证」的「手工编辑使用 `apply_patch`」：Claude Code 用 Edit/Write 完成同一件事；同条的「修改前检查工作区、保留用户已有改动」不变。

AGENTS.md 之后再出现只有 Codex 能执行的表述时，补进本节，不要为此把 AGENTS.md 分叉成两套规范。

## Claude Code 专属配置

除上方 AGENTS.md 的规范外，本仓库还有一层只对 Claude Code 生效的项目级配置（Codex 不读取），与 `codex-rules/` 是并行的两层：

- `.claude/rules/*.md`：随仓库自动加载的编码规范（Python/TypeScript 质量、并发与资源安全、Git 工作流、工具失败处理、Markdown 绘图、Issue 拆解等），比 `codex-rules/rules/` 更细致、偏工具链落地细节。两套规则同一主题可能并存，内容不完全一致，冲突按下方「规则优先级」处理。
- `.claude/skills/`：`plantuml-in-markdown`（PlantUML 绘图闭环校验）、`sync-shared-rules`（把本仓库的通用规则同步到台账登记的并行个人仓库）、`view-gel-image`（大图/非常规格式图片安全预览）。
- `.claude/hooks/` + `.claude/settings.json`：`pre-edit-validate.py`（Write/Edit 前参数校验）、`post-edit-safety.py`（Write/Edit 后按扩展名自动跑 mypy/ruff/tsc/eslint/typos），随仓库自动生效；若个人全局 `~/.claude/settings.json` 也配置了同名 hook，两者会合并运行，不是互相覆盖。

## 规则优先级

与 [Codex 规则索引](codex-rules/global-AGENTS.md) 是同一条链，`.claude/rules/` 挂在最末一级：

1. 系统、开发者、用户的显式指令。
2. 根 [AGENTS.md](AGENTS.md)。
3. `docs/` 的设计真相源。
4. `.claude/rules/` 与 `codex-rules/rules/`，两者同级。

第 4 级内部冲突时不自行裁决，也不默认取更保守的一方：先查证哪一方符合仓库现状（命令和 CI 的实现真相源是 `package.json` 与 `.github/workflows/`，门禁职责见 [质量门禁](docs/architecture/quality-gates.md)）；查证不出就说明冲突点、可选方案及影响，请用户决定，在此期间只推进不依赖该冲突的工作。
