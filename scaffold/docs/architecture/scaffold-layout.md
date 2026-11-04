# Scaffold and Project Ownership

English | [Chinese](scaffold-layout-zh.md)

Status: active
Last updated: 2026-11-04
Applies to: layout, initialization, documentation, fixtures, and generated outputs

## Decision

Keep clone-and-initialize. Root README contains target-project placeholders and labeled examples; root SCAFFOLD is the scaffold's README. All scaffold design, maintenance history, initialization, framework fixtures, and maintenance output belong under the top-level `scaffold/` directory.

| Location | Owner |
| --- | --- |
| `README.md`, `docs/`, `scripts/`, `build/` | Target-project introduction, design/progress, ongoing engineering tools, and project output |
| `SCAFFOLD.md` | Scaffold usage and maintenance entrypoint |
| `scaffold/docs/` | Scaffold design, tool references, diagrams, technical articles, vendor contract, and complete maintenance history |
| `scaffold/scripts/` | Initialization and framework regression checks |
| `scaffold/examples/` | CI/CD and compiler fixtures, explicitly identified as examples |
| `scaffold/build/` | Ignored scaffold documentation exports and maintenance output |

Agent discovery files, hooks, workflows, reusable rules/Skills, and ongoing engineering checks retain standard root paths. Shared tools handle both scopes through explicit roots without duplicate implementations or obsolete-path wrappers.

## Migration and initialization

- Preserve existing local edits and move all scaffold progress history. Root project progress contains a labeled entry template with no inherited history.
- Relocate diagram source/HTML/PNG bytes unchanged when only paths change. Rebase links and validate references; no new visual review is claimed for unchanged artifacts.
- Keep project decisions and contracts in `docs/`; move the Archify vendor pin to `scaffold/docs/contracts/`.
- Initialize only files explicitly listed in `scaffold/project-files.json`. Validate every path before writing; exclude all scaffold content and SCAFFOLD, preserving example variable spellings in reference documents.
- Run layout initialization fixtures only while `package.json` still has the `__PROJECT_SLUG__` name token. Initialized projects explicitly skip this maintenance suite; normal quality gates still run, and project names, documentation, and dated progress may evolve independently. Example tokens in documentation do not select maintenance mode.
- Exclude the entire `scaffold/` tree from project-source extension counts, including reference HTML and maintenance runners.
- Index and maintain Chinese pairs independently under `docs/` and `scaffold/docs/`. Agent/contributor instructions remain English only.
- Export project documents to `build/portable-docs/` and scaffold documents to `scaffold/build/portable-docs/`, retaining path, symlink, and content validation. Move existing ignored scaffold exports as historical output until regenerated.

## Acceptance

Run configured quality, workflow checks/fixtures, and diagram checks. Initialize a disposable copy: project values change, scaffold bytes remain identical, preview defaults and CI/CD deferral work, and the initialized copy passes quality. Run its layout gate again after adding project progress and customizing its README; it must explicitly skip maintenance fixtures without rewriting project files. Cover source-probe ownership, missing translations, cross-scope export paths, invalid initializer paths, and propagated failures. Removing scope isolation must fail the same negative cases.

No dependency, third-party service, user-data collection, or new generator/package architecture is introduced.
