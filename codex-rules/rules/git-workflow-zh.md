# Git 工作流

[English](git-workflow.md) | 中文

## 工作区安全

- 修改前检查状态，不回滚用户已有改动。
- 不执行 `git reset --hard`、`git checkout --` 等破坏性操作，除非用户明确要求并确认风险。
- 提交聚焦一个目的；相关文档、实现、质量脚本和 CI 保持同步。
- 不提交依赖目录、缓存、构建产物、日志或本地环境文件。

## 分支与提交

- `main` 保持稳定且不直接提交；开发主干为 `dev`；特性与修复分支使用 `feature/description`、`bugfix/description`，分支名使用英文。
- 主题格式：`<type>(<scope>): <English subject>`；type 限 `feat|fix|docs|style|refactor|test|chore`，不添加 `Co-Authored-By`。
- `.githooks/commit-msg` 机器校验上述格式；merge、revert、Reapply 及 `fixup!`、`squash!`、`amend!` 等 Git 自动主题豁免。
- 克隆后运行 `git config core.hooksPath .githooks` 启用本地 hooks；提交前运行相关质量门禁。

## push、PR 与 CI

执行 push 或合并后必须观察 `.github/workflows/ci.yml` 结果。有 PR 时用 `gh pr checks <PR-number> --watch`；直接 push 时用 `gh run list --branch <branch>` 找到 run，再用 `gh run watch <run-id>`。

CI 失败时定位根因、本地复现并修复、重新推送后继续观察；不得在失败或状态未知时把已 push 或已合并的任务报告为完成。
