# Codex Workflow

English | [Chinese](codex-workflow-zh.md)

Use this workflow for complex implementations and cross-file or cross-layer changes. For a simple read-only answer, the root [AGENTS.md](../../AGENTS.md) is sufficient.

## Decision gate

- Inspect the relevant design, `docs/architecture/open-decisions.md`, current implementation, and tool output first.
- Separate information into explicit user requirements, verified facts, and choices the user must make. Do not fill the third category with convention or personal preference.
- Verify objective facts from the repository, experiments, or authoritative primary sources whenever possible.
- For a pending decision, state the known facts, options, effects, and question requiring confirmation. Continue only work that does not depend on the answer.
- Record decisions in the corresponding design or contract. Keep unresolved matters in the open-decisions document and do not place them prematurely in code or public copy.

## Execution

Update the design before implementing any of the following:

- Page structure, navigation, routes, content sections, public copy, or SEO.
- Products, pricing, subscriptions, comments, discussions, feedback, or another user interaction.
- User data, analytics, forms, third-party scripts, or their privacy boundaries.
- Build frameworks, CMSs, backends, databases, deployment, or other infrastructure.

Keep implementation to the smallest verifiable loop and expose real failure causes. Do not hide problems behind marketing copy, redundant fallbacks, or unsupported infrastructure.

## Verification and handoff

- Run the project's formatter, lint, typecheck, tests, and relevant focused checks. See [Quality Gates](../../docs/architecture/quality-gates.md) for the baseline.
- Verify UI changes with an actual render. If a check cannot be completed, report the reason and risk.
- Update both `docs/progress.md` and `docs/progress-zh.md` with completed work, verification evidence, and remaining issues.
- In the final report, include changed files, verification results, pending decisions, and whether the change adds data collection or a third-party service.
