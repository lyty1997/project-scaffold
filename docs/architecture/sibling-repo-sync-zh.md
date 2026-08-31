# 并行项目规则同步台账

[English](sibling-repo-sync.md) | 中文

状态：active
最近更新：2026-07-09
适用范围：本仓库所有者名下并行开发的其他仓库之间，git-workflow 等通用工程规则的同步记录与操作方式。**这份文档描述的是仓库所有者自己的一组私人项目，不是给所有拿本脚手架初始化新项目的用户的通用建议**——如果你是把本脚手架用于自己独立的新项目，这份文档对你没有意义，可以直接删除。

## 背景

project-scaffold 是下列并行项目的规则源头（有的直接用 `npm run init` 初始化而来，有的是独立仓库但共用同一套个人工程规范）。当 project-scaffold 新增或修改一条通用规则（如提交格式、CI 观察要求）时，理论上应该同步到这些仓库，但**机械字节复制会出错**：各仓库的规则文件结构、CI job 名称、commit 格式的机器校验机制完全不同（shell 正则 / Python 脚本 / commitlint 配置），必须先读现状、按各自机制适配、并实测验证后再落地。

## 工程量判断

判定为**刚刚好**：不引入 git submodule/subtree 或跨仓库 CI dispatch 自动分发（对 4 个个人仓库而言维护成本超过收益，且解决不了"机制不同不能字节复制"这个根本问题）；只维护一份人可读的台账 + 一个固化流程的 skill。加规则时照台账过一遍，比每次从零探查全部仓库现状快得多，但仍保留人工适配这一步——因为差异是真实存在的机制差异，不能跳过，跳过就是制造新的漂移。

## 仓库清单

| 仓库 | 路径（相对本仓库上级目录） | 规则文件位置 | commit 格式机器校验 | CI |
|---|---|---|---|---|
| Augur_Maestro | `../AxiomMind/Axial_Muse/Augur_Maestro` | `CLAUDE.md`（约定详情）+ `codex-rules/rules/git-workflow.md`（通用操作规则，无 `.claude/rules/` 拆分） | `src/scripts/quality/commit_msg_check.py`，走 pre-commit 的 commit-msg 阶段，Python 正则 | `.github/workflows/ci.yml`：`python-quality`（ruff/mypy/pytest 等）、`diagrams` |
| AxialMuseWebsite | `../AxiomMind/Axial_Muse/AxialMuseWebsite` | `CLAUDE.md` + `codex-rules/rules/git-workflow.md`（无 `.claude/rules/`） | `.githooks/commit-msg`，shell 正则，需 `git config core.hooksPath .githooks`（2026-07-09 补齐此文件并启用） | `.github/workflows/ci.yml`：`Website quality gates`（`npm run quality`），无 diagrams job |
| Narrative_Maestro | `../AxiomMind/Axial_Muse/Narrative_Maestro` | `codex-rules/rules/git-workflow.md`（无 `.claude/rules/`） | `.husky/commit-msg` → `commitlint`（`commitlint.config.cjs`；注意 `header-max-length` 上限 100 字符） | `.github/workflows/ci.yml`：`quality` / `dependency-audit` / `database`；`stability.yml` 是每日 cron + 手动触发，不参与 push/merge 即时观察 |
| DocRestore-pro | `../DocRestore/DocRestore-pro` | `AGENTS.md`（单文件承载全部规范，无 `codex-rules`/`.claude` 拆分） | 无（`.pre-commit-config.yaml` 存在但 commit-msg hook 未安装/启用） | 无 `.github/workflows`，暂无 CI |

## 同步记录

| 日期 | 规则 | 同步到 | 备注 |
|---|---|---|---|
| 2026-07-09 | 提交信息中英双语（英文在前）+ push/merge 后必须观察 CI | 上述 4 仓库 | Augur_Maestro 顺带把过于宽松的校验正则（`.+` 放行任何内容）收紧为真正强制双语结构，实测双语通过/纯中文拦截；AxialMuseWebsite 补齐缺失的 `.githooks/commit-msg` 并执行 `git config core.hooksPath .githooks` 启用；Narrative_Maestro 先用 `pnpm exec commitlint` 实测双语主题能通过再落规则；DocRestore-pro 因无 CI，观察 CI 条款标注"待接入 CI 后生效"，未强行编造门禁 |

## 下次加规则时怎么做

不要凭记忆直接改各仓库文件，也不要把 project-scaffold 的规则文案整段照抄过去。调用 skill `sync-shared-rules`（或手动照下面步骤）：

1. 先在 project-scaffold 自己的 `.claude/rules/*.md`、`codex-rules/rules/*.md` 里把新规则定下来。
2. 对上表每个仓库：重新确认规则文件现状是否与台账一致（可能已被仓库所有者手动改过，台账会滞后）；按该仓库的实际机制（CI job 名、commit 校验方式）适配新规则的具体表达。
3. 如果改动涉及机器校验逻辑（如收紧正则、改 commitlint 配置），先构造一对"应通过/应拒绝"的示例，实测校验脚本本身，再把改动落到仓库里。
4. 改完先只在各仓库本地提交，**不要自动 push**；把这次同步追加到上面的"同步记录"表格，方便下次核对哪些仓库已经跟上。
