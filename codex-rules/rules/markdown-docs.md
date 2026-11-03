# Markdown and Diagrams

- Explain relevant purpose, boundaries, contracts, risks, and acceptance without empty template sections. Important designs include status, scope, and update date.
- Index new `docs/**/*.md` in the matching language index; keep local links valid. Prefer primary external sources.
- Keep pending decisions in Open Decisions. Archive long immutable history as `*.archive.md`, linking it from the active document and matching language index.

## Diagram routing

Respect an explicit tool choice. Use Archify for standalone interactive overviews and presentation artifacts; use PlantUML for compact Markdown-inline, diff-friendly technical models and batch compilation. Keep one editable source per illustration. Repository diagrams use these tools rather than Mermaid, handwritten SVG, or source-less screenshots; simple directory trees may remain ASCII.

- **Archify:** use the [pinned Skill](../../.claude/skills/archify/SKILL.md) for typed JSON, interactive HTML, and native PNG delivery.
- **PlantUML:** use the [project Skill](../../.claude/skills/plantuml-in-markdown/SKILL.md) for Markdown-owned source and compiled SVG.

Load only the selected capability when creating or changing a diagram; prose-only edits do not require diagram regeneration. Its detailed acceptance and artifact ownership remain in the Skill and [Diagram System](../../docs/architecture/diagram-system.md). For standalone document export, use [Portable Documents](../../docs/architecture/portable-documents.md).
