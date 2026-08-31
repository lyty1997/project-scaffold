# Contributing

English | [Chinese](CONTRIBUTING-zh.md)

This file collects entry points for contributors. Detailed rules remain in their designated sources of truth and are not duplicated here.

## Before you start

1. Run the placeholder initializer once: `npm run init` or `node scripts/init.mjs`.
2. Enable the local commit gates after cloning: `git config core.hooksPath .githooks`. The pre-commit hook mirrors CI by running `npm run quality`.
3. Before editing, read [docs/README.md](docs/README.md) to find the design source of truth, then load only the relevant [Codex rules](codex-rules/global-AGENTS.md).

## Non-negotiable: design before implementation

Changes to positioning, information architecture, content sections, routes, public copy, SEO, deployment, user data, or product and service boundaries require a prior update to the corresponding [design document](docs/README.md). See [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md).

## Branches and commits

- Keep `main` stable and do not commit to it directly. Use `dev` as the development trunk and `feature/description` or `bugfix/description` for focused branches.
- Use an English Conventional Commit subject: `<type>(<scope>): <English subject>`. Do not add `Co-Authored-By` trailers.
- See the complete [Git workflow](codex-rules/rules/git-workflow.md).

## Pre-commit verification

- Run `npm run quality` and ensure it passes. CI runs the same baseline on Ubuntu and Windows.
- Verify UI changes with an actual render or screenshot. For a static page, check at least the entry file, asset references, and critical links.
- Update both [docs/progress.md](docs/progress.md) and [docs/progress-zh.md](docs/progress-zh.md) when the task ends. After fixing a reusable bug, record its cause and solution in [known-issues.md](codex-rules/known-issues.md) and [known-issues-zh.md](codex-rules/known-issues-zh.md).

## Infrastructure not yet selected

The test framework, dependency policy, and lockfile policy are still undecided. See [open decisions](docs/architecture/open-decisions.md). Record a decision before adding a third-party framework or dependency.
