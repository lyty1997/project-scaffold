# Contributing

This file collects entry points for contributors. Detailed rules remain in their designated sources of truth and are not duplicated here.

## Before you start

1. For a new project, follow the initialization boundary in [AGENTS.md](AGENTS.md); scaffold maintenance preserves placeholders.
2. Enable the local commit gates after cloning: `git config core.hooksPath .githooks`. The pre-commit hook mirrors CI by running `npm run quality`.
3. Use the owning index: [project documentation](docs/README.md) or [scaffold documentation](scaffold/docs/README.md), then the relevant [rules](codex-rules/global-AGENTS.md). Small edits do not require unrelated designs.

## Non-negotiable: design before implementation

Changes to positioning, architecture, routes, copy, deployment, user data, or product boundaries require updating the owning design first: project designs in `docs/`, scaffold designs in `scaffold/docs/`. See [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md).

## Branches and commits

- Keep `main` stable and do not commit to it directly. Use `dev` as the development trunk and `feature/description` or `bugfix/description` for focused branches.
- Use an English Conventional Commit subject: `<type>(<scope>): <English subject>`. Do not add `Co-Authored-By` trailers.
- See the complete [Git workflow](codex-rules/rules/git-workflow.md).

## Pre-commit verification

- Run `npm run quality` and ensure it passes. CI runs the same baseline on Ubuntu and Windows.
- Verify UI changes with an actual render or screenshot. For a static page, check at least the entry file, asset references, and critical links.
- After file changes, update the owning English/Chinese progress pair: project history in `docs/`, scaffold history in `scaffold/docs/`. Read-only reviews do not write logs. Record reusable bug guidance in [known-issues.md](codex-rules/known-issues.md).

## Infrastructure not yet selected

The test framework, dependency policy, and lockfile policy are still undecided. See [open decisions](docs/architecture/open-decisions.md). Record a decision before adding a third-party framework or dependency.
