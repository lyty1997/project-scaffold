# Markdown Diagram Rules

English | [Chinese](../rules-zh/markdown-diagrams-zh.md)

## 1. Complementary tools

Use Archify and PlantUML together. Select the tool from the delivery contract:

| Need | Tool |
| --- | --- |
| Architecture overview, complex workflow/swimlane, data flow, lifecycle, presentation | Archify |
| Interactive viewer, themes, search, route tracing, high-resolution canonical PNG | Archify |
| Markdown-inline source, fast edits, readable text diff | PlantUML |
| ERD/class, precise state machine, focused sequence/activity diagram | PlantUML |
| Fast CI compilation of many technical diagrams | PlantUML |

Respect an explicit user choice. When both tools can express the type, Archify owns presentation and exploration; PlantUML owns compact inline precision and batch verification.

Never maintain equivalent Archify JSON and PlantUML for the same illustration. Different focused views in one document may use different tools.

Do not introduce Mermaid, hand-written SVG, or screenshots without editable source. A minimal directory tree may remain ASCII.

## 2. Archify workflow

For an Archify diagram, invoke the project `archify` Skill and complete its type → schema/example → Typed JSON → validate → deliver → visual-check → human review loop.

The artifact triplet is:

```text
<name>.<type>.json
<name>.archify.html
<name>.archify.png
```

- Typed JSON is the only editable source.
- HTML is the interactive artifact.
- PNG must use the Viewer-native canonical export and exclude Viewer chrome.
- Markdown links all three artifacts.
- Acceptance requires showcase 9/9, 0 errors, 0 warnings, four desktop containment checks, both-theme visual review, and `canonical=true` PNG evidence.

Use `npm run check:archify`, `npm run gen:archify`, and `npm run review:archify -- <source>`.

## 3. PlantUML workflow

For an inline PlantUML diagram, invoke `.claude/skills/plantuml-in-markdown/SKILL.md` and complete select → extract → compile → repair → write back → compile-all.

- Use the exact Markdown fence language `plantuml`.
- Include `@startuml` and `@enduml`.
- Follow every block, with at most one blank line, by its generated local `.svg` image reference.
- The Markdown block is the only editable source; do not hand-edit the SVG.
- Only canonical English Markdown owns the block in a bilingual pair; the Chinese translation reuses the SVG.
- Forbid include/import directives so compilation is self-contained and secure.
- Set `PUML_JAR=/absolute/path/to/plantuml.jar`, then run `npm run gen:plantuml` and `npm run check:plantuml`.
- Inspect the final SVG. Do not compare SVG bytes across machines because layout depends on the JAR, JVM, Graphviz, and fonts.

Choose the specific PlantUML type before authoring. Do not default to swimlanes: use component diagrams for static structure, sequence diagrams for calls and returns, activity diagrams for branching pipelines, ERD/class diagrams for models, and state diagrams for state transitions.

## 4. CI and portability

`npm run check:diagrams` aggregates Archify and PlantUML checks. The CI `diagrams` job uses vendored Archify plus a checksum-verified pinned PlantUML JAR. PlantUML and Chrome-based visual review stay outside the Node-only `npm run quality` baseline.

Archify-backed Markdown can use `npm run export:portable-docs -- <source.md>`. PlantUML SVG is a generated repository artifact and remains linked from its Markdown source.
