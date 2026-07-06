# Git 工作流规范

## 基本规则

- 开始修改前检查工作区状态。
- 不回滚用户已有改动，除非用户明确要求。
- 不执行 `git reset --hard`、`git checkout --` 等破坏性操作，除非用户明确要求并确认风险。
- 提交前运行相关质量门禁。

## 分支与提交规范

- 分支：`main` 稳定不直接提交，`dev` 开发主干，特性分支用 `feature/描述` / `bugfix/描述`。
- 提交信息用中文，格式 `<type>(<scope>): <主题>`（type 限定：feat / fix / docs / style / refactor / test / chore）。
- 提交信息**不带** `Co-Authored-By` 尾注。
- 这套约定与根目录 [AGENTS.md](../../AGENTS.md)、[CLAUDE.md](../../CLAUDE.md) 一致，是本仓库的唯一提交规范来源。
- 格式不再只是文档约定：`.githooks/commit-msg` 会机器校验并拒绝不合规提交（`git config core.hooksPath .githooks` 后生效）。git 自动生成主题行的提交不受此约束：merge、revert、Reapply，以及 `rebase --autosquash` 的 `fixup!`/`squash!`/`amend!` 前缀。

## 提交内容

- 提交应聚焦一个清晰目的。
- 文档、代码、质量脚本和 CI 的相关改动应一起提交，避免规范和实现脱节。
- 不提交生成缓存、依赖目录、日志或本地环境文件。

