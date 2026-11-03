# Contributing

This file collects entry points for contributors. Detailed rules remain in their designated sources of truth and are not duplicated here.

## Before you start

1. For a new project, follow the initialization boundary in [AGENTS.md](AGENTS.md); scaffold maintenance preserves placeholders.
2. Enable the local commit gates after cloning: `git config core.hooksPath .githooks`. The pre-commit hook mirrors CI by running `npm run quality`.
3. Use the [documentation index](docs/README.md) and [rule index](codex-rules/global-AGENTS.md) to find task-relevant guidance; a small edit does not require loading unrelated designs.

## Non-negotiable: design before implementation

Changes to positioning, information architecture, content sections, routes, public copy, SEO, deployment, user data, or product and service boundaries require a prior update to the corresponding [design document](docs/README.md). See [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md).

## Branches and commits

- Keep `main` stable and do not commit to it directly. Use `dev` as the development trunk and `feature/description` or `bugfix/description` for focused branches.
- Use an English Conventional Commit subject: `<type>(<scope>): <English subject>`. Do not add `Co-Authored-By` trailers.
- See the complete [Git workflow](codex-rules/rules/git-workflow.md).

## Pre-commit verification

- Run `npm run quality` and ensure it passes. CI runs the same baseline on Ubuntu and Windows.
- Verify UI changes with an actual render or screenshot. For a static page, check at least the entry file, asset references, and critical links.
- After file-changing tasks, update both [docs/progress.md](docs/progress.md) and [docs/progress-zh.md](docs/progress-zh.md). Read-only reviews do not write progress logs. Record reusable bug guidance in [known-issues.md](codex-rules/known-issues.md).

## Infrastructure not yet selected

The test framework, dependency policy, and lockfile policy are still undecided. See [open decisions](docs/architecture/open-decisions.md). Record a decision before adding a third-party framework or dependency.
