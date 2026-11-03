---
name: setup-cicd
description: Set up or change a target project's CI/CD automation. Use for requested setup or an accepted reminder; framework maintenance uses the CI/CD rule.
---

# Project CI/CD Setup

Use the [CI/CD rule](../../../codex-rules/rules/cicd-workflow.md) for ownership and remote acceptance, and relevant [design](../../../docs/architecture/cicd-autosetup.md) sections for the ledger schema and selected targets. Run commands from the repository root.

Match the requested scope: assessment is read-only; local preparation generates and validates files; operational delivery also exercises runners and authorized remote controls. Reuse session authorization. If another permission is needed, finish the independent local preparation and present the exact remaining action. This Skill grants no remote-write authority.

## Execution

1. Before generating files, run `npm run cicd:probe`, inspect `.cicd/probe.json`, and resolve blockers. Missing workflow scope requires the user's `gh auth refresh -h github.com -s workflow` browser authorization. Report controls unavailable under actual permissions/plan.
2. Reuse declared commands and decisions; ask only for missing build/test, deployment, release/version/tag, or credential choices. Record deferrals in both Open Decisions documents and omit their workflows. Inspect existing workflows, release config, manifest, and stale artifacts; resolve ownership conflicts before writing.
3. Write `docs/contracts/cicd-answers.json` using the design schema: targets, real rollback methods, secret names/sources only, and `deployStep: true/false` for every deployment step. Run `npm run gen:cicd`, `npm run quality`, and `npm run check:workflows` with pinned actionlint on `PATH` or `ACTIONLINT_BIN`. Repair the ledger, never generated output or weakened gates.
4. For authorized operational delivery, exercise a `ci-verify/<timestamp>` branch and draft PR. A new workflow absent from the default branch cannot rely on `gh workflow run --ref`. Keep the first deployment rehearsal in dry-run mode and verify exact-SHA job/step evidence.
5. Apply authorized remote controls with `gh api --input`; transport secrets through stdin to `gh secret set`, never arguments. Inspect state before retrying mutations. Record successes, skips, and remaining work in the ledger/design and both progress documents.

## Release Please

Load design section 4.6 only when release automation is selected. The renderer supports `node` and `simple`; match package keys and version paths across config, manifest, and `versionSources`. Preserve existing manifest state. Record default `GITHUB_TOKEN` or PAT secret-name mode; do not claim GitHub App support.

For operational release acceptance, verify a real Release PR updates primary and extra version files consistently. An approval-required bot PR run needs a writer's approval before CI can pass. Default-token downstream triggers have limits: use `release_created` in the same workflow where applicable. Tags and GitHub Releases require publication authorization.

## Verified delivery

State what was delivered: local validation, remote runner verification, and deployment/release verification are separate evidence. Operational completion requires local gates, real rollback records, remote job/step evidence, and applicable release/version evidence. Report missing evidence and the next action; local generation alone cannot establish operational CI/CD.
