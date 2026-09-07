# __PROJECT_NAME__ - Project Rules

__PROJECT_NAME__ is __PROJECT_TAGLINE__. Establish purpose before implementation and credible content before presentation. When creating a new project from this scaffold, run `npm run init` if uppercase placeholders wrapped in double underscores remain; scaffold maintenance preserves them.

## Sources and scope

- `docs/` owns design facts and public claims; `package.json` and `.github/workflows/` own commands and CI behavior.
- Use [docs/README.md](docs/README.md) and the [rule index](codex-rules/global-AGENTS.md) to load only task-relevant context and needed history. Read one language for background; inspect both when editing a pair.
- These project constraints apply to every Agent. Detailed rules and Skills supplement them; explicit user instructions take precedence over their guidance.

## Reasoning and design

- **First principles:** Start from confirmed goals, evidence, and constraints; challenge assumptions.
- **Adversarial review:** For consequential, complex, or uncertain choices, test counterexamples and failure modes; resolve findings or report limitations.
- **Ablation and Occam's razor:** Test added complexity by reversibly removing one element against a baseline with the same acceptance checks. Record the result and prefer the simplest passing design; if infeasible, explain what remains unverified.
- **Uncertainty:** Keep unresolved questions, missing evidence, impact, and next verification steps current in updates and handoff.
- **Independent judgment:** Assess suggestions and conclusions against evidence; explain disagreements and revise when warranted.
- **High cohesion, low coupling:** Keep responsibilities together and dependencies behind explicit contracts; investigate changes spreading across modules. Follow [architecture evolution](docs/architecture/overview.md#evolution-principles).

## Execution and boundaries

1. Inspect the worktree and implementation; preserve existing changes. Use `apply_patch` for manual edits.
2. Update `docs/` before changing positioning, information architecture, content models, public copy/pages, routes/SEO, products/services, interactions/data, third-party scripts, deployment, or stack. Record technology choices in [Open Decisions](docs/architecture/open-decisions.md) first.
3. Reuse verified facts and session authorization. Do not invent user intent, preferences, priorities, acceptance criteria, business facts, or permission. Resolve routine implementation details within scope; for a missing user-owned choice, state facts, options, and consequences and pause only dependent work.
4. Complete the smallest verifiable loop. Expose real failures; do not hide them with fake success, redundant fallbacks, or unsupported infrastructure.
5. Run applicable configured formatter, lint, typecheck, tests, and focused checks after code changes. The baseline is `npm run quality`; do not invent absent commands. Verify UI changes with an actual render under [frontend rules](codex-rules/rules/frontend-web-rules.md). Stop repeating passing checks unless new evidence warrants it.
6. Update both progress documents with changes, verification, and remaining issues. Report these and whether user-data collection or a third-party service was added; add neither by default. Record reusable bug guidance once in [Known Issues](codex-rules/known-issues.md).

Never commit, print, or write credentials, real private/customer data, or non-public business plans. Distinguish facts, opinions, plans, and pending decisions; never present unreleased capabilities as delivered. Destructive or irreversible actions require an explicit request and risk confirmation.

## Language

Use English for repository content, UI, instructions, comments, CLI output, and commit subjects; follow the user's conversation language. Maintain Chinese pairs only for `README.md`, `SCAFFOLD.md`, and Markdown under `docs/`. Agent/contributor instructions, rules, Skills, and the PR template remain English only. See [Localization](docs/architecture/localization.md).
