---
name: plantuml-in-markdown
description: Create, edit, or repair PlantUML embedded in Markdown and verify it by actual compilation. Use for explicit PlantUML requests or existing PlantUML blocks and render failures.
---

# PlantUML in Markdown

Select a type from the semantics: component for structure, sequence for calls/returns, activity for processing, class/ERD for models, state for transitions. Use swimlanes only when multiple actors own meaningful internal steps. For standalone interactive delivery, follow the project's Archify route unless the user chose PlantUML. Keep one editable source per illustration.

## Compile and deliver

Set `PUML_JAR` to the pinned local JAR. Extract and compile all blocks, repair diagnosed source in the reported output directory, and recompile before writing it back:

```bash
bash .claude/skills/plantuml-in-markdown/scripts/extract_and_compile.sh path/to/doc.md
python3 .claude/skills/plantuml-in-markdown/scripts/write_back.py path/to/doc.md <reported-output-dir>
```

After write-back, re-extract and compile the complete document. Run `npm run gen:plantuml`, inspect every resulting SVG for readable labels, direction, and complete content, then run `npm run check:plantuml`. Success needs zero compiler exit status and non-empty rendered artifacts; plausible source is insufficient.

## Source constraints

- Use exact `plantuml` fences containing `@startuml` / `@enduml`. Follow each block with its generated local SVG reference, separated by at most one blank line.
- English Markdown owns the source; a Chinese translation reuses its SVG. Preserve identifiers and authored language.
- Forbid include/import directives; compilation is self-contained under `SECURE`. Never hand-edit generated SVG or compare its bytes across machines.
- For syntax errors, check mixed diagram grammars, swimlane switches inside branches/loops, notes without a preceding action, empty branches, and duplicate sequence activation. A swimlane name stays on one source line; use literal `\n` for a visual break.

Report the source and SVG paths, compilation/check results, and actual visual-review status.
