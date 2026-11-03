# Language and Localization

English | [Chinese](localization-zh.md)

Status: active

Last updated: 2026-09-06

Applies to: repository-facing documentation, Agent instructions, first-party source comments and messages, public UI copy, and generated diagrams

## Decision

English is the project's default and primary maintenance language. Maintained Chinese translations are limited to project explanations and design documentation: `README.md`, `SCAFFOLD.md`, and Markdown under `docs/`. Each English document keeps its existing filename, while its Chinese translation uses the `-zh.md` suffix in the same directory.

Agent instructions and contributor workflow guidance have one English version only: `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `codex-rules/` (including its index and known issues), `.claude/rules/`, first-party Skill instructions, and the PR template. Do not create translated copies or a separate translated rules directory. This keeps duplicate instructions out of model context and avoids maintaining equivalent prompt sets.

Every retained language pair links to its counterpart near the top of the document. English documents link to other English documents by default; Chinese translations link to the corresponding `-zh.md` document whenever one exists and to the canonical English file for instructions maintained only in English. Commands, identifiers, paths, protocol names, trademarks, and historical facts keep their exact technical spelling.

## Source and synchronization contract

- The English document is the canonical source for current behavior, design, and public wording.
- A change to a paired project document must update both languages in the same change. The Chinese file is a maintained translation, not an archive.
- Preserve existing Chinese project explanations and design documents within the paired scope above. Remove Chinese instruction and workflow copies, their language-switch links, and requirements to recreate them.
- New first-party documentation uses English. A Chinese counterpart is required only within the paired project-document scope above; generated, vendored, and explicitly language-neutral content retain their existing exceptions.
- `docs/README.md` indexes the canonical English documents and links to `docs/README-zh.md`. The Chinese entry point indexes the corresponding Chinese documents without duplicating every translation in the English index.
- `check:localization` validates reciprocal links for the retained project-document pairs and rejects Chinese copies of English-only instructions, including uppercase `-ZH.md` variants. English-default text scanning and functional-data exceptions remain in effect.

## Code, UI, and generated artifacts

- First-party code comments, CLI prompts, diagnostics, fixture descriptions, PR templates, and public UI copy use English.
- Branch names and Conventional Commit subjects use English. The commit hook validates `<type>(<scope>): <English subject>` and no longer requires a duplicated Chinese subject.
- `public/index.html` declares English and presents English placeholder copy by default.
- Archify Typed JSON uses English authored content and `meta.locale: "en"`; PlantUML blocks and generated SVG labels also use English. Generated HTML, PNG, and SVG artifacts therefore present English diagram text.
- Chinese documents share the English diagram artifacts. The repository does not maintain a second Chinese topology or a duplicate set of generated diagram artifacts.

## Boundaries

Vendored third-party implementation files remain byte-compatible with their pinned upstream contract unless a separately reviewed vendor update is required. Locale dictionaries, brand catalogs, multilingual parser fixtures, Chinese contract terms that validate `-zh.md` content, and generated HTML may therefore contain Chinese as functional data for an optional locale or test boundary; they are not first-party prose or comments and do not change the English default. First-party comments added around vendored behavior still use English. Historical records are translated faithfully rather than rewritten to imply a different past state.

This localization change introduces no user data collection, telemetry, third-party runtime service, or network dependency.
