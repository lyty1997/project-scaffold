# Git Workflow

The root rules cover worktree safety. Keep changes focused; exclude dependency directories, caches, build output, logs, and local environment files.

- Keep `main` stable; use `dev` and focused `feature/description` or `bugfix/description` branches.
- Subjects use `<type>(<scope>): <English subject>`, with `feat|fix|docs|style|refactor|test|chore`. No `Co-Authored-By` trailers.
- `.githooks/commit-msg` owns exact validation and Git-generated subject exemptions. Enable hooks after cloning with `git config core.hooksPath .githooks`; pass applicable gates before committing.
- Commit, push, and merge within the session's authorized scope. A rule alone does not request these actions.
- After a push or merge, find CI for that commit SHA and verify expected checks. Use `gh pr checks <PR-number> --watch` or `gh run watch <run-id>`, then inspect the actual conclusions.
- Diagnose failures, fix locally, and observe the repair run. Missing runs or unknown status cannot establish completion; use the [CI/CD evidence criteria](cicd-workflow.md#verified-remote-completion).
