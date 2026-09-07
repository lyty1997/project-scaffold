# Markdown and Diagrams

- Explain relevant purpose, boundaries, contracts, risks, and acceptance without empty template sections. Important designs include status, scope, and update date.
- Index new `docs/**/*.md` in the matching language index; keep local links valid. Prefer primary external sources.
- Keep pending decisions in Open Decisions. Archive long immutable history as `*.archive.md`, linking it from the active document and matching language index.

## Diagram routing

Respect an explicit tool choice. Use Archify for standalone interactive overviews and presentation artifacts; use PlantUML for compact Markdown-inline, diff-friendly technical models and batch compilation. Keep one editable source per illustration. Repository diagrams use these tools rather than Mermaid, handwritten SVG, or source-less screenshots; simple directory trees may remain ASCII.

- **Archify:** read the [pinned Skill](../../.claude/skills/archify/SKILL.md). Codex's tracked `.agents/skills/archify/SKILL.md` bridges there. Typed JSON owns HTML and Viewer-native canonical PNG; Markdown links all three. Preserve showcase 9/9, four desktop containment checks, and both-theme visual review. Screenshots are temporary evidence.
- **PlantUML:** read the [project Skill](../../.claude/skills/plantuml-in-markdown/SKILL.md). English Markdown owns the block and generated SVG; its Chinese pair reuses the SVG. Complete actual compilation and visual review.

Commands and artifact boundaries: [Diagram System](../../docs/architecture/diagram-system.md). For standalone document export, read [Portable Documents](../../docs/architecture/portable-documents.md). Load only the selected capability.
