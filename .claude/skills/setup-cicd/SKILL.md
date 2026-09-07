---
name: setup-cicd
description: Set up or change a concrete project's CI/CD, deployment, release, or rollback automation. Use for requested setup or an accepted CI/CD reminder; scaffold framework maintenance uses the CI/CD rule instead.
---

# Project CI/CD Setup

Read the [CI/CD rule](../../../codex-rules/rules/cicd-workflow.md) for ownership and verified-completion criteria. Use relevant sections of the [design](../../../docs/architecture/cicd-autosetup.md) for ledger schema, selected release mode, and remote controls. Do not preload unrelated target details.

## Execution

1. Run `npm run cicd:probe` before writing the target ledger or generated files; inspect `.cicd/probe.json` and resolve blockers. Missing workflow scope requires the user's `gh auth refresh -h github.com -s workflow` browser authorization. Report controls unavailable under the actual repository permissions/plan.
2. Reuse declared build/test commands and confirmed decisions. Ask only for missing commands, deployment target, release trigger/gate, or release/version/tag/credential choices. Record deferred items in both Open Decisions documents and omit their workflows.
3. Inventory existing workflows, config, manifest, and stale managed artifacts. Obtain a user decision for ownership conflicts or migrations; do not overwrite or delete them automatically.
4. Write `docs/contracts/cicd-answers.json` with workflows, targets and real rollback methods, and secret names/sources only. Classify every deployment step as `deployStep: true/false`. Use the design's schema and renderer diagnostics.
5. Run `npm run gen:cicd`, `npm run quality`, and `npm run check:workflows` with the pinned actionlint available through `PATH` or `ACTIONLINT_BIN`. Fix the ledger; never hand-edit generated output or weaken checks.
6. Within session authorization, push a `ci-verify/<timestamp>` branch and open a draft PR to exercise the runner. A new workflow absent from the default branch cannot rely on `gh workflow run --ref`. Keep the first deployment rehearsal in dry-run mode; apply the rule's exact-SHA job/step evidence criteria.
7. Apply authorized remote controls using `gh api --input`; send secret values through stdin to `gh secret set`, never command arguments. Record each success or reason for skipping. Inspect existing state before retrying a remote mutation.
8. Update the ledger, relevant design, and both progress documents. Commit, push, merge, and publish only within existing authorization. If extra approval is needed, present the validated result and exact remaining action.

## Release Please

Load design section 4.6 only when release automation is selected. The renderer supports `node` and `simple`; match package keys and version paths across config, manifest, and `versionSources`. Preserve existing manifest state. Record default `GITHUB_TOKEN` or PAT secret-name mode; do not claim GitHub App support.

Verify a real Release PR updates primary and extra version files consistently. An approval-required bot PR run needs a writer's approval before CI can pass. Default-token downstream triggers have limits: use `release_created` in the same workflow where applicable. Creating tags or a GitHub Release requires authorization for that publication.

## Verified delivery

Local gates, remote run evidence, rollback records, and applicable release/version evidence must all pass. Use the [canonical criteria](../../../codex-rules/rules/cicd-workflow.md#verified-remote-completion); local generation alone is not operational CI/CD. Report unavailable remote evidence as incomplete, with its blocker and next action.
