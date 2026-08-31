# Git Workflow

English | [Chinese](git-workflow-zh.md)

## Worktree safety

- Inspect status before editing and do not roll back the user's existing work.
- Do not run destructive commands such as `git reset --hard` or `git checkout --` unless the user explicitly requests them and confirms the risk.
- Keep each commit focused on one purpose and synchronize the related documentation, implementation, quality scripts, and CI.
- Do not commit dependency directories, caches, build output, logs, or local environment files.

## Branches and commits

- Keep `main` stable and do not commit to it directly. Use `dev` as the development trunk and `feature/description` or `bugfix/description` for focused work.
- Use `<type>(<scope>): <English subject>`, where type is one of `feat|fix|docs|style|refactor|test|chore`. Do not add `Co-Authored-By` trailers.
- `.githooks/commit-msg` enforces this format. Git-generated merge, revert, Reapply, `fixup!`, `squash!`, and `amend!` subjects are exempt.
- Run `git config core.hooksPath .githooks` after cloning and execute the relevant quality gates before committing.

## Push, PR, and CI

Observe `.github/workflows/ci.yml` after every push or merge. For a PR, run `gh pr checks <PR-number> --watch`. For a direct push, locate the run with `gh run list --branch <branch>` and then use `gh run watch <run-id>`.

When CI fails, identify the root cause, reproduce and fix it locally, push the repair, and continue observing the new run. Never report pushed or merged work as complete while CI is failing or its status is unknown.
