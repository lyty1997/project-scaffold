# Scaffold Guide

English | [Chinese](SCAFFOLD-zh.md)

This is a technology-neutral project scaffold built around documentation-first development, contract vocabulary, CI-enforced quality gates, and a cross-machine preview workflow. It was extracted from the AxialMuseWebsite project and does not prescribe a frontend or backend stack.

## Getting started

1. Use the repository contents as the starting point for a new project by cloning and replacing the remote or by downloading an archive.
2. Run `node scripts/init.mjs` or `npm run init`, then answer the prompts for the project name, brand name, and GitHub details. To enable the optional cross-machine preview workflow (local rendering host plus remote serving host), select it and provide the remote host settings. The script replaces every placeholder and finishes by running `npm run quality`.
3. Run `git config core.hooksPath .githooks` to enable the local pre-commit quality gate and commit-message gate. The latter enforces the zero-dependency `<type>(<scope>): <English subject>` Conventional Commit format without husky or commitlint.
4. If the cross-machine preview workflow is enabled, follow the **Remote restart** section in `docs/architecture/dev-workflow.md` to generate an SSH key and install it in the remote `~/.ssh/authorized_keys` file.
5. After verifying the initialized project, delete both `SCAFFOLD.md` and `SCAFFOLD-zh.md`. They only apply before initialization; `README.md` and `README-zh.md` then become the project's normal entry points.

## Included

- Layered Agent rules based on `AGENTS.md` / `CLAUDE.md` and `codex-rules/`. General language, security, privacy, tool-failure, and Git workflow rules are reusable; content, product, and frontend wording must be adapted to the project while preserving the documentation-first and fact-versus-plan principles.
- A `docs/` design skeleton covering architecture, terminology, pending decisions, the content roadmap, and cross-machine preview. These are placeholder templates that must be completed with project facts. English files are canonical and paired `-zh.md` files provide maintained Chinese translations.
- `docs/contracts/`, which contains a reusable contract-vocabulary mechanism in `check-contracts.mjs`. The terms and checks in `contract-terms.json` and `contract-rules.json` are examples and must be replaced with the project's real brand names, retired names, and cross-layer constraints. `site-checks.json` configures the optional static-entry check, which skips cleanly if the project has no entry such as `public/index.html`.
- Zero-dependency Node.js quality gates under `scripts/quality/`: JavaScript syntax, Markdown links and bilingual indexes, contract vocabulary, secret patterns, static entry points, portable documents, CI/CD contracts, and generated diagrams. CI runs the same baseline command on Ubuntu and Windows.
- `scripts/docs/`, which uses local Pandoc 2.12 or later to export Markdown with local images as portable HTML under `build/portable-docs/`. Images are embedded, relative links become path hints, and output is not committed.
- Complementary diagram workflows: pinned Archify under `.claude/skills/archify/` for polished interactive artifacts, and `.claude/skills/plantuml-in-markdown/` for inline, diff-friendly technical diagrams. The tool-selection, source, export, and combined CI contracts are defined in `docs/architecture/diagram-system.md`.
- `scripts/dev/`, including cross-platform `sync.sh` / `sync.ps1` and the optional `preview.sh`, `restart-remote.ps1`, and `serve.py` workflow. Runtime settings live in the ignored `scripts/dev/dev-workflow.env`, which the initializer can create.

## Not included

This is not a preconfigured React, Vue, Express, or database starter. It supplies the collaboration, documentation-consistency, validation, and preview layer. Select and record the actual frontend, backend, and database stack using the process in `docs/architecture/open-decisions.md`.
