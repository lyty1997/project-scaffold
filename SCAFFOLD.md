# Project Scaffold

English | [Chinese](SCAFFOLD-zh.md)

This is the scaffold's README. The root [README](README.md) and [docs/](docs/README.md) describe the target project; scaffold design, maintenance history, examples, and initialization live under `scaffold/`.

## Ownership

```text
README.md                 Target-project placeholders and labeled examples
SCAFFOLD.md               Scaffold usage and maintenance entrypoint
docs/                     Target-project design, contracts, and progress
scripts/                  Ongoing project engineering tools
build/                    Ignored project output
scaffold/
  docs/                   Scaffold design, references, diagrams, and history
  scripts/                Initialization and framework regression checks
  examples/               CI/CD and compiler fixtures
  build/                  Ignored scaffold output
```

Agent discovery entries, hooks, workflows, reusable rules, and Skills keep their standard locations. Their presence does not imply that an application stack or business capability has been implemented.

## Initialize a project

1. Clone/download the repository and set the intended project remote.
2. Run `npm run init` (or `node scaffold/scripts/init.mjs`) and supply confirmed project identity. Initialization validates the explicit [project-file list](scaffold/project-files.json) before replacing identity tokens.
3. Enable local gates with `git config core.hooksPath .githooks`.
4. Fill in the project README, design, decisions, roadmap, and progress using real facts. Select a stack in [project Open Decisions](docs/architecture/open-decisions.md).
5. Run `npm run quality`. A failed check makes initialization exit unsuccessfully; fix its diagnostics before committing.

Initialization leaves this guide and all files under `scaffold/` unchanged. Project progress starts empty; scaffold history is in [its own progress log](scaffold/docs/progress.md). Keep the scaffold directory while supplied commands and references depend on it.

Optional preview settings use the [cross-machine workflow](scaffold/docs/architecture/dev-workflow.md). CI/CD setup uses declared commands and the [setup guide](scaffold/docs/architecture/cicd-autosetup.md); deferred decisions remain in project Open Decisions. Neither option authorizes remote changes by itself.

## Supplied tools

`npm run quality` is the Node.js-only baseline for syntax, links/indexes, localization, portable-document invariants, contracts, secret patterns, static entrypoints, and CI/CD safety. Hooks and the Ubuntu/Windows CI matrix run the baseline. Framework fixtures live under `scaffold/examples/`; their runners live under `scaffold/scripts/`.

- [Quality gates](scaffold/docs/architecture/quality-gates.md)
- [Agent prompt design](scaffold/docs/architecture/agent-prompts.md)
- [Archify and PlantUML](scaffold/docs/architecture/diagram-system.md)
- [Language and localization](scaffold/docs/architecture/localization.md)
- [Stack reference recipes](scaffold/docs/architecture/stack-recipes/README.md)

For diagram validation, set a local checksum-pinned PlantUML JAR and run `npm run check:diagrams`. Archify's reviewed implementation remains in `.claude/skills/archify/`. Diagram tools and optional Pandoc are outside the Node-only baseline.

## Export documentation

With local Pandoc 2.12 or later:

```bash
npm run export:portable-docs -- scaffold/docs/sharing/ai-coding-scaffold.md
```

Project sources under `docs/` export to `build/portable-docs/`; scaffold sources under `scaffold/docs/` export to `scaffold/build/portable-docs/`. Generated files are ignored and never become editable sources.

## Maintain the scaffold

Start from the [scaffold documentation index](scaffold/docs/README.md) and [ownership design](scaffold/docs/architecture/scaffold-layout.md). Update scaffold history for maintenance tasks and project history for project tasks. The scaffold does not prescribe React, a backend, a database, or deployment infrastructure.

Run `npm run quality`, `npm run check:scaffold`, `npm run check:workflows`, `npm run check:workflows:fixtures`, and the applicable diagram checks when maintaining these capabilities. Workflow checks require the pinned actionlint described in Quality Gates.
