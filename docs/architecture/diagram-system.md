# Diagram System: Archify + PlantUML

English | [Chinese](diagram-system-zh.md)

Status: active

Last updated: 2026-08-31

Applies to: architecture, workflow, sequence, data-flow, lifecycle, state, ERD/class, and other technical diagrams in repository documentation

## Decision

This scaffold uses Archify and PlantUML as complementary tools. Archify is not a universal replacement for PlantUML, and PlantUML is not a reduced Archify renderer. The delivery format and maintenance workflow determine the tool.

| Scenario | Better fit |
| --- | --- |
| Architecture overview, complex workflow/swimlane, data flow, lifecycle, or presentation diagram | Archify |
| Interaction, light/dark themes, search, route tracing, or canonical high-resolution PNG | Archify |
| Markdown-inline source, fast changes, and a clear text diff | PlantUML |
| ERD/class model, precise state machine, or focused sequence/activity diagram | PlantUML |
| Fast CI compilation of many technical diagrams | PlantUML |

An explicit user choice takes precedence. For an overlapping type such as sequence, workflow, or state:

- choose Archify when the standalone viewer, exploration, presentation quality, or native bitmap export is part of the deliverable;
- choose PlantUML when the diagram belongs inline with the prose and precise, compact, reviewable source is the main requirement.

One illustration has exactly one editable source. Never maintain equivalent Archify JSON and PlantUML for the same view. A document may use both tools only for genuinely different views, such as an interactive system overview and a focused inline request sequence.

Mermaid, hand-written SVG, and screenshots without editable source are outside the current contract. A minimal directory tree may remain ASCII.

## Existing Archify evaluation

The repository's seven current documentation diagrams remain Archify artifacts. Their migration evaluation established:

- showcase validation rejects node crossings, ambiguous corridors, label masking, and unreadable desktop composition rather than proving syntax alone;
- the interactive viewer supports themes, guided views, search/focus, reachability, directed paths, semantic lenses, zoom, presentation, and export without inventing runtime facts;
- each interactive HTML is several hundred KB and GitHub does not execute it, so a Viewer-native canonical PNG remains necessary for repository reading;
- visual quality still requires real-browser review; deterministic receipts never substitute for perceptual inspection.

High-density diagrams may need to be split. This is an accepted Archify cost, not a reason to compress labels below the readability gate.

## Archify source and artifact contract

The reviewed implementation is vendored at `.claude/skills/archify/`:

- upstream repository: `https://github.com/tt-a1i/archify`
- pinned commit: `4ac500a498267f18bda42b3c82b51edb8f9c1baf`
- package version: `2.16.0-dev.0`
- license: MIT, retained in `.claude/skills/archify/LICENSE`
- machine contract: `docs/contracts/archify.json`

The Claude entry is `.claude/skills/archify/SKILL.md`; the Codex discovery bridge is `.agents/skills/archify/SKILL.md`. The project removes remote Google Fonts, disables automatic update checks, requires Viewer-native canonical PNG export, and routes explicit PlantUML requests to the complementary Skill. Upgrades are explicit maintenance tasks that review upstream changes, reapply `LOCAL_CHANGES.md`, refresh the vendored digest, and rerun every acceptance gate.

An Archify diagram uses one basename in `docs/diagrams/`:

```text
<name>.<type>.json    # only editable source
<name>.archify.html   # deterministic interactive artifact
<name>.archify.png    # Viewer-native canonical full-diagram PNG
```

Markdown links the PNG preview to the HTML and separately links the Typed JSON. A full-page `visual-check` screenshot is temporary review evidence and must never become the committed documentation PNG.

Acceptance requires:

1. the selected Archify type matches the information;
2. `meta.quality_profile` is `showcase`, and `meta.locale` matches authored content;
3. validation reports 9/9 checks, 0 errors, and 0 warnings;
4. atomic delivery records specification and HTML SHA-256 receipts;
5. 1440×900, 1600×1000, 1920×1080, and 2048×1320 desktop containment passes;
6. a human reviews the smallest and largest light/dark captures;
7. the native PNG receipt reports `format=png` and `canonical=true`, dimensions match the safe export scale, and no Viewer chrome is present.

## PlantUML source and artifact contract

The project workflow lives at `.claude/skills/plantuml-in-markdown/SKILL.md`. The official JAR is not vendored. Local work sets:

```bash
export PUML_JAR=/absolute/path/to/plantuml-1.2026.1.jar
```

CI downloads PlantUML 1.2026.1 from its official GitHub release and verifies SHA-256 `89c116168a2a0f7cf5292e11617ba22abd743f891914f1fec5bc9c7d257b3092` before execution.

For a production documentation diagram:

```text
docs/path/to/document.md              # fenced PlantUML block is the only editable source
docs/diagrams/<name>.plantuml.svg     # generated GitHub-readable artifact
```

Every `plantuml` fence must:

- contain `@startuml` and `@enduml`;
- be followed, with at most one blank line, by a non-empty local `.svg` image reference;
- remain self-contained: `!include`, `!includeurl`, `!import`, and related directives are forbidden;
- compile under PlantUML's `SECURE` profile;
- complete the Skill's select → extract → compile → repair → write back → compile-all loop.

The committed SVG must exist, be a regular non-symlink file, and be visually inspected. It is not compared byte-for-byte in CI because output geometry and metadata depend on the PlantUML JAR, JVM, Graphviz, and installed fonts. Compilation success and a non-empty artifact are stable gates; cross-machine byte identity is not.

For a bilingual document pair, only the canonical English Markdown owns the PlantUML block. Its Chinese translation references the same English SVG and may link readers to the English source document; it does not duplicate a second editable diagram source.

## Commands

| Command | Responsibility |
| --- | --- |
| `npm run check:archify` | Validate the vendored integration, run showcase 9/9 on every Typed JSON source, verify HTML freshness, and check native PNG boundaries |
| `npm run gen:archify` | Atomically regenerate all Archify HTML artifacts |
| `npm run review:archify -- <source>` | Deliver one Archify diagram, collect four-viewport evidence, and refresh its Viewer-native PNG |
| `npm run check:plantuml` | Compile every Markdown PlantUML block securely and require its non-empty committed SVG |
| `npm run gen:plantuml` | Compile every PlantUML block and atomically refresh its referenced SVG |
| `npm run check:diagrams` | Run both Archify and PlantUML checks |
| `npm run gen:diagrams` | Regenerate both Archify HTML and PlantUML SVG artifacts |

PlantUML and browser visual review stay outside `npm run quality`, whose cross-platform baseline remains Node.js-only. The independent Linux `diagrams` CI job installs Java, verifies the pinned JAR, and runs the combined check.

## Portable documents, privacy, and external services

Repository Markdown keeps maintainable local sources and artifacts. Archify-backed Markdown can be exported through [Portable Single-File Documents](portable-documents.md). The current portable exporter intentionally rejects SVG as active content, so it does not export PlantUML-backed Markdown; a single-file requirement should favor an Archify PNG or wait for a separately designed SVG sanitization/rasterization contract rather than bypassing the wrapper.

Neither tool adds runtime analytics, telemetry, user-data collection, or a reader-facing third-party service. Archify artifacts are offline. PlantUML's only network step is the checksum-verified CI download of the pinned official JAR; diagram compilation itself forbids external includes.
