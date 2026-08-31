# Markdown Documentation Rules

English | [Chinese](markdown-docs-zh.md)

## Content and structure

- Explain the purpose, boundaries, model or interface, risks, and acceptance criteria when they are relevant; do not add empty template sections.
- Mark unresolved decisions consistently and keep them in `docs/architecture/open-decisions.md`.
- Important design documents maintain status, scope, and last-updated metadata.
- Index every new `docs/**/*.md` file from the matching language index.
- Internal links must resolve inside the repository. Prefer official documentation and primary sources for external links.

## Diagram tool selection

Archify and PlantUML are complementary. Choose by delivery and maintenance needs, not by a blanket diagram-type rule.

| Need | Tool |
| --- | --- |
| Architecture overview, complex workflow/swimlane, data flow, lifecycle, or presentation diagram | Archify |
| Interaction, light/dark themes, search, route tracing, or canonical high-resolution PNG | Archify |
| Markdown-inline source, quick edits, and clear text diffs | PlantUML |
| ERD/class model, precise state machine, or focused sequence/activity diagram | PlantUML |
| Fast CI compilation of many technical diagrams | PlantUML |

An explicit user tool choice takes precedence. For overlapping types, use Archify when the standalone viewer or presentation quality is part of the deliverable; use PlantUML when inline ownership, precision, and reviewable source are primary.

Never maintain equivalent Archify JSON and PlantUML for the same illustration. A document may use both tools for genuinely different views.

## Archify contract

- Codex discovers `archify` from `.agents/skills/archify/SKILL.md`; the canonical implementation is [the vendored Archify Skill](../../.claude/skills/archify/SKILL.md).
- Typed JSON is the only editable source. The matching `.archify.html` is the interactive artifact and `.archify.png` is a Viewer-native canonical export without Viewer chrome.
- Markdown links the PNG, HTML, and JSON. Full-page screenshots are temporary visual evidence only.
- New or changed diagrams require showcase 9/9 validation, deterministic HTML delivery, four desktop containment checks, and human review in both themes.

## PlantUML contract

- Use the project [PlantUML in Markdown Skill](../../.claude/skills/plantuml-in-markdown/SKILL.md) and its select → extract → compile → repair → write back → compile-all loop.
- The fenced Markdown block is the only editable source. Each block must be followed by its generated local SVG reference for GitHub.
- In a bilingual pair, only canonical English Markdown owns the block; the Chinese translation reuses the SVG without duplicating the source.
- Run `npm run gen:plantuml` after source changes and `npm run check:plantuml` before handoff. `PUML_JAR` must identify the local pinned JAR.
- Do not use remote/local include directives or hand-edit generated SVG. Inspect the final SVG, but do not compare its bytes across machines.

Keep every diagram simple, readable, and accompanied by prose that states its factual boundary. Portable Archify-backed documents follow [Portable Single-File Documents](../../docs/architecture/portable-documents.md).

## Archiving

When an append-only progress or decision document becomes too long, move completed immutable history into a read-only `*.archive.md`. Keep a link in the active document and add the archive to both documentation indexes.
