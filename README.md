# __PROJECT_NAME__

English | [Chinese](README-zh.md)

__BRAND_NAME__ is __PROJECT_TAGLINE__. Replace this paragraph with an accurate description of what the project does, who it serves, what the first release focuses on, and how later releases may evolve.

## Project focus

- Core purpose: summarize the problem and product shape here.
- Primary entry points: list the main features or pages available to users or the team.
- Future evolution: design the positioning, boundaries, and information architecture in `docs/` before shipping a new capability.

## Engineering documentation

Project explanations and design documents have maintained Chinese translations. Agent rules, Skills, and contributor workflow guidance are maintained in English only; see [Language and Localization](docs/architecture/localization.md).

- Claude Code guidance: [CLAUDE.md](CLAUDE.md)
- Project rules: [AGENTS.md](AGENTS.md)
- Documentation index: [docs/README.md](docs/README.md)
- Project progress: [docs/progress.md](docs/progress.md)
- Codex rules: [codex-rules/global-AGENTS.md](codex-rules/global-AGENTS.md)
- Quality-gate scripts: [scripts/quality](scripts/quality)

## Local checks

Replace the scaffold placeholders before using this repository for a new project:

```bash
npm run init
# or
node scripts/init.mjs
```

Then run the quality gates:

```bash
npm run quality
```

The local pre-commit gate mirrors CI. Enable the repository hooks once after cloning:

```bash
git config core.hooksPath .githooks
```

The base `quality` command uses only built-in Node.js capabilities and requires no third-party npm packages. Diagram work uses complementary Archify and PlantUML workflows: the repository vendors the reviewed Archify implementation and the PlantUML authoring Skill, while CI downloads a checksum-verified PlantUML JAR only for the independent diagram job.

- JavaScript syntax checks with `node --check`.
- Markdown internal-link, bilingual-pair, and `docs/README.md` / `docs/README-zh.md` index checks.
- Contract vocabulary and retired-name checks.
- Common secret-pattern checks.
- Static-site entry-point and asset-reference checks.
- Positive and negative fixtures for portable single-file documents, including image discovery, path boundaries, embedded-byte integrity, and removal of broken local links.
- `npm run check:archify` validates Archify Typed JSON, HTML freshness, and native PNG boundaries; `npm run review:archify` performs its real-browser visual review.
- `npm run check:plantuml` securely compiles Markdown-inline PlantUML and checks each generated SVG; `npm run check:diagrams` aggregates both tools.

PlantUML commands require a local JAR; Archify remains self-contained:

```bash
export PUML_JAR=/absolute/path/to/plantuml-1.2026.1.jar
npm run check:diagrams
```

The selection rules and artifact contracts are documented in [Diagram System: Archify + PlantUML](docs/architecture/diagram-system.md).

To move a Markdown document with local images outside the repository, install Pandoc 2.12 or later and generate a self-contained HTML file. Output is written under the ignored `build/portable-docs/` directory, so one HTML file is sufficient for delivery:

```bash
npm run export:portable-docs -- docs/sharing/ai-coding-scaffold.md
```

## License

This project is licensed under the [Apache License 2.0](LICENSE). Compared with MIT, it remains permissive while adding an explicit patent grant, change notices, and clearer notice-preservation terms. `npm run init` fills in the copyright year and holder in the license appendix.
