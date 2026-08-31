# __PROJECT_NAME__ - Project Rules

English | [Chinese](AGENTS-zh.md)

## Purpose and sources of truth

__PROJECT_NAME__ is __PROJECT_TAGLINE__. Public content must be credible, traceable, and maintainable; presentation must never conceal an unimplemented capability.

- `docs/`: source of truth for positioning, architecture, content models, products and services, deployment, and public claims.
- `AGENTS.md`: project-level constraints that every Agent must always follow.
- `codex-rules/`: task-specific execution guidance for Codex; it does not replace `docs/`.
- `package.json` and `.github/workflows/`: source of truth for current commands and CI behavior.

**Establish the purpose before implementation; establish credible content before visual presentation.** When this scaffold is used to create a new project and uppercase placeholders wrapped in double underscores remain, run `npm run init` before continuing.

## Minimal end-to-end workflow

1. Read `docs/README.md` and the design documents relevant to the task. Use the [Codex rule index](codex-rules/global-AGENTS.md) to load only the applicable detailed rules.
2. Inspect the worktree and current implementation. Distinguish explicit user requirements, verifiable facts, and choices that only the user can make.
3. When the change falls within a documentation-first area below, update the relevant design, contract, or pending-decision record before implementation.
4. Complete the smallest verifiable loop. Do not introduce infrastructure the current design does not require or add redundant fallbacks that hide a root cause.
5. Run checks proportional to the risk, update `docs/progress.md` and `docs/progress-zh.md`, and report changes, verification, and remaining issues.

## Decisions and boundaries

- Do not invent the user's intent, preferences, priorities, acceptance criteria, business facts, or authorization. Verify what can be verified. If a remaining uncertainty requires a user choice, state the known facts, options, and consequences, then pause work that depends on that choice.
- Changes to positioning, information architecture, content models, public pages or copy, routes, SEO, products and services, user interactions or data, third-party scripts, deployment, or the technology stack require a prior `docs/` update. Record technology choices in `docs/architecture/open-decisions.md` first.
- Clearly distinguish facts, opinions, plans, and items awaiting confirmation. Never describe an unreleased capability as delivered.
- Do not commit, print, or write credentials, real private data, customer data, or non-public business plans.
- Do not perform destructive or irreversible operations unless the user explicitly requests them and confirms the risk.

## Editing and verification

- Inspect the worktree before editing and preserve the user's existing changes. Use `apply_patch` for manual edits.
- After code changes, run the existing formatter, lint, typecheck, tests, and relevant focused checks. The complete baseline gate is `npm run quality`.
- For UI changes, follow the [frontend web rules](codex-rules/rules/frontend-web-rules.md) and verify an actual render.
- When adding or resolving a bug, review and refine `codex-rules/known-issues.md` as needed. Keep only reusable symptom / cause / fix guidance there.
- At completion, state whether the change adds user-data collection or a third-party service. Do not introduce either by default.

## Language and entry points

English is the default language for repository documentation, user-visible UI, Agent-facing instructions, code comments, CLI output, and commit subjects. Follow the user's explicit conversation language. Maintain each existing Chinese document as a synchronized `-zh.md` translation; the detailed pairing and exception rules are defined in [Language and Localization](docs/architecture/localization.md).

- [Documentation index](docs/README.md)
- [Chinese documentation index](docs/README-zh.md)
- [Codex rule index](codex-rules/global-AGENTS.md)
- [Quality gates](docs/architecture/quality-gates.md)
- [Known issues](codex-rules/known-issues.md)
