# CI/CD Rules

Design and schema: [Automated CI/CD Setup](../../docs/architecture/cicd-autosetup.md).

## Scope

- For a concrete project, propose setup when its stack, first dependency/artifact, deployment, or release work appears, or source exists without a CI/CD ledger. Record an explicit deferral in Open Decisions and do not ask repeatedly.
- Scaffold detector, renderer, gates, and baseline CI maintenance: update the design, then run `npm run quality`, `npm run check:workflows`, and `npm run check:workflows:fixtures`. No target ledger or remote probe is required.
- Target-project delivery: follow [setup-cicd](../../.claude/skills/setup-cicd/SKILL.md). Probe before writing the ledger or generated files. Use declared commands and existing decisions; ask only for missing build/test commands, deployment target, release cadence/gate, and release/version/tag/credential choices.

## Ownership and deployment

- `docs/contracts/cicd-answers.json` owns generated workflows marked `managed-by` and `release-please-config.json`. Change the ledger and run `npm run gen:cicd`; do not hand-edit output or weaken gates.
- `.release-please-manifest.json` is bootstrapped only for an absent bundle, then advanced by Release PRs. Never reset it from `initialManifest`; an existing bundle with a missing manifest needs state recovery.
- Ledger entries do not transfer ownership of handwritten files. Report same-name conflicts, symlinks, and stale artifacts; obtain a user decision before migration or deletion.
- Every deployment step declares `deployStep: true` for publication or `false` for safe preparation/verification. Keep boolean `dry_run` guards and deployment `cancel-in-progress: false`.
- Record real rollback methods for all targets. Package publication requires a new version and deprecate/yank recovery; do not claim reversible publication.
- Reuse session authorization. Prepare local changes before any additional approval; apply remote settings, push, merge, or publish only within authorized scope.

## Verified remote completion

Match the run by exact commit SHA, event, and workflow. Require the run to be completed/successful, every expected job and required step to exist and succeed, and an artifact/log evidence step to succeed. Missing, skipped, cancelled, or unknown required evidence fails acceptance; `gh run watch` exiting zero is insufficient.

Retry transient read-only `gh api` / `gh run` failures up to three times with backoff. API failure is UNKNOWN, never a pass. Diagnose failed checks and verify the repair; do not report remote completion while CI/CD is red or unknown. See relevant [Known Issues](../known-issues.md) rows for authentication, API status parsing, secret transport, and workflow-trigger pitfalls.
