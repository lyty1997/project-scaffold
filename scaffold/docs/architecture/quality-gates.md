# Quality Gates

English | [Chinese](quality-gates-zh.md)

Status: active

This document defines the repository's checks and how to run them. `package.json` and `.github/workflows/ci.yml` remain the implementation sources of truth.

## Baseline

`npm run quality` requires Node.js 22 or newer and uses only built-in Node.js capabilities. CI runs it on Ubuntu and Windows for pull requests and pushes to `main` or `dev`.

| Command | Responsibility |
| --- | --- |
| `check:js` | Syntax-check the initializer, shared modules, and quality scripts |
| `check:docs` | Validate Markdown links, bilingual pairs, and language indexes |
| `check:localization` | Reject unapproved Han on English surfaces and copyable Chinese-document fences; validate pairs in both documentation roots plus root README/SCAFFOLD; reject translated Agent instructions and preserve functional-data exceptions |
| `check:portable-docs` | Exercise local-image discovery, path boundaries, input digests, byte-preserving embedding, and local-link removal |
| `check:contracts` | Scan naming contracts from `docs/contracts/contract-rules.json` and `contract-terms.json` |
| `check:secrets` | Detect common credential shapes; it does not replace human review |
| `check:site` | Validate the configured static entry point, required snippets, and relative assets |
| `check:cicd` | Enforce workflow safety and validate managed CI/CD artifacts, release fixtures, and manifest lifecycle |

When an application stack is selected, add its real formatter, lint, typecheck, tests, accessibility checks, and other relevant gates without removing this baseline.

## Scaffold maintenance checks

`npm run check:scaffold` runs disposable initialization fixtures while the `package.json` name remains `__PROJECT_SLUG__`. After project initialization it reports an explicit maintenance skip, preserving the project's identity, customized docs, and dated progress; example tokens in documentation do not select maintenance mode. It verifies that transition, identity replacement, unchanged scaffold references, preview reruns, source-probe ownership, both documentation roots, unsafe path rejection, separate export destinations, and failing-quality exit propagation. CI invokes it after the normal baseline on Ubuntu and Windows. It stays outside `npm run quality` so an initializer's own quality check cannot recursively initialize another fixture.

## Portable single-file documents

`npm run export:portable-docs` uses local Pandoc 2.12+ to export Markdown containing local raster images. Project documents export to ignored `build/portable-docs/`; scaffold documents export to ignored `scaffold/build/portable-docs/`. The wrapper rejects remote images, path escapes, symlinks, active formats, and empty alt text before Pandoc, then verifies embedded bytes and rejects remaining local resource references before atomic delivery.

Pandoc is not a baseline CI dependency. `check:portable-docs` uses pure-Node positive and negative fixtures for the same invariants. Actual delivery still requires desktop and mobile browser inspection. See [Portable Single-File Documents](portable-documents.md).

## Diagram gates

The [Diagram System](diagram-system.md) assigns one source and one acceptance loop to every diagram.

### Archify

- `npm run check:archify` verifies the Claude/Codex Skill integration and vendored digest, runs showcase 9/9 on every Typed JSON source, checks the offline boundary, compares deterministic HTML, and validates native PNG dimensions.
- `npm run gen:archify` atomically regenerates interactive HTML.
- `npm run review:archify -- <source>` requires Chrome/Chromium, measures four desktop viewports, captures temporary light/dark evidence, and refreshes the Viewer-native canonical PNG.
- HTML can use deterministic freshness checks. PNG bytes are not compared across machines, but their canonical export receipt and expected dimensions are checked.

### PlantUML

- The fenced Markdown block is the editable source; its following local SVG is generated for GitHub.
- `npm run check:plantuml` requires `PUML_JAR`, compiles every block under PlantUML's `SECURE` profile, forbids include/import directives, and validates each committed SVG as a regular non-empty file.
- `npm run gen:plantuml` securely compiles every block and atomically refreshes its referenced SVG.
- SVG bytes are not compared across machines because JAR, JVM, Graphviz, and font metrics affect output. Compilation plus a real non-empty artifact is the stable gate.

`npm run check:diagrams` aggregates both tools; `npm run gen:diagrams` regenerates both artifact families. PlantUML and Chrome review stay outside the Node-only `npm run quality` baseline. CI's independent Linux `diagrams` job installs Java, downloads PlantUML 1.2026.1 with a pinned SHA-256 check, and runs the combined gate alongside vendored Archify.

## GitHub Actions semantic checks

`actionlint` is an external binary, so it is not part of the dependency-free Ubuntu/Windows `quality` matrix. With the official binary installed, run:

```bash
ACTIONLINT_BIN=/absolute/path/actionlint npm run check:workflows
```

If `ACTIONLINT_BIN` is unset, the wrapper tries `PATH` and fails when the binary is unavailable. It accepts only workflow paths, not temporary ignore or shell-check bypass flags.

CI's Linux-only `workflow-lint` job verifies ShellCheck, downloads actionlint v1.7.12 with SHA-256 `8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8`, checks repository workflows, and runs persistent positive/negative fixtures including generated Release Please and boolean `dry_run` deployment workflows.

CI therefore has three responsibility groups: the cross-platform `quality` matrix, the Linux `diagrams` gate for Archify plus PlantUML, and Linux `workflow-lint` for GitHub Actions semantics.

## Local commits

After cloning, run `git config core.hooksPath .githooks`. The pre-commit hook reuses `npm run quality`, while the commit-msg hook enforces the repository subject format.
