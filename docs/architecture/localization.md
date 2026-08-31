# Language and Localization

English | [Chinese](localization-zh.md)

Status: active

Last updated: 2026-08-31

Applies to: repository-facing documentation, Agent instructions, first-party source comments and messages, public UI copy, and generated diagrams

## Decision

English is the project's default and primary maintenance language. The default GitHub repository entry point is `README.md`; Chinese readers can switch to `README-zh.md`. The same convention applies throughout the repository: an English document keeps its existing filename, while its maintained Chinese translation uses the `-zh.md` suffix in the same directory.

Every language pair links to its counterpart near the top of the document. English documents link to other English documents by default; Chinese translations link to the corresponding `-zh.md` document whenever one exists. Commands, identifiers, paths, protocol names, trademarks, and historical facts keep their exact technical spelling. Chinese translations of automatically loaded `.claude/rules/*.md` files live under `.claude/rules-zh/` so Claude does not load two equivalent rule sets into every session.

## Source and synchronization contract

- The English document is the canonical source for current behavior, design, and public wording.
- A change to a paired document must update both languages in the same change. The Chinese file is a maintained translation, not an archive.
- Existing Chinese project documents are preserved by copying their current meaning into `*-zh.md` before the default path is rewritten in English.
- New first-party documentation should be authored in English and must include a Chinese counterpart unless its content is generated, vendored, or explicitly recorded as language-neutral.
- `docs/README.md` indexes the canonical English documents and links to `docs/README-zh.md`. The Chinese entry point indexes the corresponding Chinese documents without duplicating every translation in the English index.

## Code, UI, and generated artifacts

- First-party code comments, CLI prompts, diagnostics, fixture descriptions, PR templates, and public UI copy use English.
- Branch names and Conventional Commit subjects use English. The commit hook validates `<type>(<scope>): <English subject>` and no longer requires a duplicated Chinese subject.
- `public/index.html` declares English and presents English placeholder copy by default.
- Archify Typed JSON uses English authored content and `meta.locale: "en"`; PlantUML blocks and generated SVG labels also use English. Generated HTML, PNG, and SVG artifacts therefore present English diagram text.
- Chinese documents share the English diagram artifacts. The repository does not maintain a second Chinese topology or a duplicate set of generated diagram artifacts.

## Boundaries

Vendored third-party implementation files remain byte-compatible with their pinned upstream contract unless a separately reviewed vendor update is required. Locale dictionaries, brand catalogs, multilingual parser fixtures, Chinese contract terms that validate `-zh.md` content, and generated HTML may therefore contain Chinese as functional data for an optional locale or test boundary; they are not first-party prose or comments and do not change the English default. First-party comments added around vendored behavior still use English. Historical records are translated faithfully rather than rewritten to imply a different past state.

This localization change introduces no user data collection, telemetry, third-party runtime service, or network dependency.
