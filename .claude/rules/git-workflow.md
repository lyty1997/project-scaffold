# Git Workflow

English | [Chinese](../rules-zh/git-workflow-zh.md)

## Branches

- `main`: stable releases; do not commit directly.
- `dev`: development trunk.
- `feature/s{N}-description`, `bugfix/description`, or `release/version`.

## Commit format

```text
<type>(<scope>): <English subject>
```

Use an English subject. Allowed types are `feat|fix|docs|style|refactor|test|chore`; choose a scope that names the project module (`scaffold` is common in this repository). `.githooks/commit-msg` enforces a non-empty scope and English subject but does not restrict the scope vocabulary.

- Do not add `Co-Authored-By` trailers.

## Before committing

- Run formatting checks and tests and confirm no sensitive information is present.
- This repository enforces the subject format through `.githooks/commit-msg` after `git config core.hooksPath .githooks` is enabled.

## After push or merge: observe CI

- After pushing to `main` or `dev`, or merging a PR, actively observe `.github/workflows/ci.yml`; a successful push or merge is not task completion by itself.
- For a PR, use `gh pr checks <PR-number> --watch`. For a direct branch push, use `gh run watch`, locating the run first with `gh run list --branch <branch>` when needed.
- If any OS in the `quality` matrix or the `diagrams` job fails, identify the cause, fix it locally, rerun `npm run quality`, and for diagram changes also run `npm run check:diagrams` plus `npm run review:diagrams -- <source-file>`. Push the repair and observe CI again until every required job is green.
- Never report completion while CI is red or its state is unknown.
