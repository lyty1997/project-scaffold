---
name: plantuml-in-markdown
description: Create or repair Markdown PlantUML diagrams with real compilation. Use for explicit PlantUML requests or changes to existing blocks, not surrounding prose.
---

# PlantUML in Markdown

Select a type from the semantics: component for structure, sequence for calls/returns, activity for processing, class/ERD for models, state for transitions. Use swimlanes only when multiple actors own meaningful internal steps. For standalone interactive delivery, follow the project's Archify route unless the user chose PlantUML. Keep one editable source per illustration.

## Compile and deliver

Run commands from the repository root with `PUML_JAR` set to the pinned local JAR. Extract and compile the blocks, repair diagnosed failures in the reported directory, and recompile changed sources before write-back:

```bash
bash .claude/skills/plantuml-in-markdown/scripts/extract_and_compile.sh path/to/doc.md
python3 .claude/skills/plantuml-in-markdown/scripts/write_back.py path/to/doc.md <reported-output-dir>
```

Run `npm run gen:plantuml` to compile the canonical sources and regenerate SVGs, inspect changed diagrams for readable labels, direction, and complete content, then run `npm run check:plantuml`. This also verifies the complete Markdown after any write-back. Success requires zero compiler exit status and non-empty artifacts; plausible source is insufficient.

## Source constraints

- Use exact `plantuml` fences containing `@startuml` / `@enduml`. Follow each block with its generated local SVG reference, separated by at most one blank line.
- English Markdown owns the source; a Chinese translation reuses its SVG. Preserve identifiers and authored language.
- Forbid include/import directives; compilation is self-contained under `SECURE`. Never hand-edit generated SVG or compare its bytes across machines.
- For syntax errors, check mixed diagram grammars, swimlane switches inside branches/loops, notes without a preceding action, empty branches, and duplicate sequence activation. A swimlane name stays on one source line; use literal `\n` for a visual break.

Report the source and SVG paths, compilation/check results, and actual visual-review status.
