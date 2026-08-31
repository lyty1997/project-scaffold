---
name: setup-cicd
description: Generate and deliver CI/CD for the project's actual build, deployment, release, and rollback shape instead of applying a preset template. Trigger when the user asks to set up CI/CD, deployment, release automation, or launch; when the cicd-reminder hook reports source code without a CI/CD ledger; or when deferred setup must be completed after initialization. Enforce the complete loop: permission preflight, fact probe, user decisions, ledger, generation, local gates, temporary-branch green run, remote configuration, and ledger update. Ask about every fact the detector cannot establish; never guess.
---

# Project-Specific CI/CD Setup

English | [Chinese](SKILL-zh.md)

## Triggers

- The user requests CI/CD, deployment, release, or rollback automation.
- The `cicd-reminder` hook reports project source without `docs/contracts/cicd-answers.json`.
- CI/CD was deferred during `npm run init` and is now required.
- Existing CI/CD needs another target or workflow change; update the ledger through this same loop instead of editing generated output.

## Prerequisites

Read the design source of truth in [`docs/architecture/cicd-autosetup.md`](../../../docs/architecture/cicd-autosetup.md) and the behavior contract in [`.claude/rules/cicd-workflow.md`](../../rules/cicd-workflow.md).

There is no ready-made “C++ ci.yml” to copy. `scripts/cicd/render.mjs` fixes the safety structure; probed facts plus explicit user decisions determine the toolchain and commands. Establish those facts in the ledger instead of inventing YAML.

## Required workflow

### 1. Permission preflight before writing any file

Run `npm run cicd:probe`. A non-zero exit means blockers must be resolved first:

- Missing token `workflow` scope: ask the user to run `gh auth refresh -h github.com -s workflow`, then stop for the required browser authorization. Do not bypass it.
- No repository admin permission: explain that Pages, environments, and branch protection cannot be configured.
- Private repository on the free plan: list environments, branch protection, rulesets, and Pages explicitly as skipped because of the plan; do not omit them silently.

### 2. Read the probe facts

Inspect `.cicd/probe.json` for build-system markers, source distribution, static entry points, existing workflows, and remote state. Treat it as a fact inventory, not a conclusion.

### 3. Confirm facts the detector cannot discover

At minimum, confirm build command, test command, deployment target, and release trigger. When enabling Release Please, also confirm the release type, current version, version source of truth, synchronized version files, history starting point and tag rules, plus `GITHUB_TOKEN` or PAT credential mode. GitHub Apps require a separately generated short-lived token and are not yet supported by the renderer; ordinary secret mode must not be presented as App support.

Read commands from declared project scripts or ask the user. Never invent them. If the user cannot decide now, omit that workflow and record the decision in both open-decisions documents rather than fabricating a complete-looking pipeline.

Prefer targets with no long-lived credential when they fit: GitHub Pages, GHCR, and artifact attestations can form a genuinely automated loop. For other targets, state that the user must configure trust on the provider. Cloudflare, in particular, provides neither OIDC nor an API for creating API tokens.

### 4. Write `docs/contracts/cicd-answers.json`

At minimum, include:

- `workflows`, with `id`, `file`, `kind`, `displayName`, `on`, `permissions`, and `jobs`;
- `targets`, each with a real `rollback` description;
- `secrets`, each with its `source` and never its value.

Every step in a `kind: deploy` workflow must be classified: use `"deployStep": true` for real publication and `false` for safe checkout, build, or verification. The renderer adds “no deploy from PR” and “manual trigger defaults to dry run” guards to real deployment steps, and at least one step must be `true`.

For Release Please, add `releasePlease` with `workflowFile`, `targetBranch`, `credential`, restricted `config`, `initialManifest`, and `versionSources`. The second increment supports only `node` and language-neutral `simple`; extend version-source mapping and fixtures before another release type instead of passing it through. Package paths must match exactly across `config.packages`, `initialManifest`, and `versionSources`. Every package declares `release-type`; config explicitly declares the `include-v-in-tag` and `include-component-in-tag` booleans. An optional `bootstrap-sha` is a complete 40-character lowercase SHA. `skip-github-pull-request` is not a config field and is forbidden at any value; `skip-github-release` may only be explicitly `false`. Default-token mode needs no secret entry. PAT mode records only the secret name and source.

Before writing, inventory same-name workflows, `release-please-config.json`, the manifest, and stale managed artifacts. A hand-written file is not automatically transferred to the generator. Ask the user to choose another name or explicitly approve a backed-up migration. Never delete old workflow, config, or manifest files left by rename or disable operations automatically.

### 5. Generate and pass local gates

Run:

```bash
npm run gen:cicd
npm run quality
ACTIONLINT_BIN=/absolute/path/actionlint npm run check:workflows
```

The renderer rejects unpinned third-party actions, `pull_request_target`, false-green `continue-on-error`, and unsafe secret syntax. Fix the ledger from its diagnostics; do not edit the renderer or weaken a scanner.

Release Please config is generated deterministically. The manifest initializes only when the complete bundle is absent. Existing config or a release workflow without a manifest means runtime state was lost and must be restored rather than reconstructed from `initialManifest`. Resolve ownership, symlink, stale-artifact, and transactional-write failures at their root cause.

### 6. Prove behavior on a temporary branch

Create `ci-verify/<timestamp>`, push it, and open a draft PR with `gh pr create --draft` to trigger `pull_request`. Do not use `gh workflow run --ref`: `workflow_dispatch` returns a misleading 404 when its file is not yet on the default branch. Identify the run by the exact SHA from `git rev-parse HEAD`. The first deployment run must remain a dry run.

### 7. Apply the green-run criteria

Use the criteria below. On failure, collect logs, fix the ledger, regenerate, push, and observe again until every required signal is green. Use this repository's English commit-subject format during the repair loop so the commit-msg hook does not block progress.

### 8. Configure remote controls

- Send `gh secret set <NAME>` through stdin, never `--body`, so credentials do not enter shell history.
- Enable Pages with `gh api -X POST /repos/{owner}/{repo}/pages -f build_type=workflow`; a 409 means it is already enabled and is expected.
- Configure environments, rulesets, and branch protection with `gh api --input`; there is no `gh ruleset create` command.
- Record success or the explicit reason for skipping every control.

### 9. Update the ledger and documentation

Update the ledger change history and both progress documents. Synchronize the relevant `docs/` design when deployment behavior changes. Commit locally, do not push automatically, and ask whether to merge.

## Definition of verified

All conditions must hold; user approval or `gh run watch` exiting 0 is insufficient:

- [ ] `npm run cicd:probe` reports no blockers.
- [ ] `npm run quality`, including `check:cicd`, passes.
- [ ] The pinned actionlint binary passes `npm run check:workflows`.
- [ ] The run is found by exact SHA; no matching run is a failure. Event and workflow name match.
- [ ] `run.status == "completed"` and `run.conclusion == "success"`.
- [ ] Every expected job appears and succeeds; `skipped`, `cancelled`, and `null` are failures.
- [ ] A designated evidence step exists and succeeds, using an artifact or log sentinel rather than `$GITHUB_STEP_SUMMARY`.
- [ ] Every deployment target in the ledger has a rollback description.
- [ ] With Release Please, config, manifest, and versionSources package keys match and every recorded path exists. Local gates prove the primary version files match the current manifest. A real Release PR also updates every extra-file to the same version. Validate a tag or GitHub Release only in a project where the user explicitly authorized it.
- [ ] With default `GITHUB_TOKEN`, a write-authorized person approves any approval-required workflow run created by the bot PR, after which every job and step still meets the green criteria.

Retry `gh api` and `gh run` calls up to three times with backoff. Distinguish API failure (UNKNOWN) from a negative check result. Missing data never defaults to pass.

## Common pitfalls

- **`gh api` exits 1 for both 403 and 404 while error JSON goes to stdout.** Parse `.status`; do not rely on the exit code or on `gh auth status`, which can exit 0 after a timeout.
- **`GITHUB_TOKEN` has trigger exceptions but still needs a human gate.** A bot-created or updated PR can produce an approval-required `pull_request` run that a writer must approve. Other commits or tags created by the default token do not trigger downstream workflows. Add later package publication to the same workflow using Release Please's `release_created` output instead of relying on a tag-triggered second chain.
- **Only one secret expression is accepted:** `${{ secrets.NAME }}`, with spaces inside the braces and no quotes. Other spellings fail the repository secret scan.
- **Linux defaults to `bash -e` without pipefail when `shell:` is absent.** `false | true` can pass silently. The renderer adds `shell: bash`; do not remove it from the ledger.
- **Deployment workflows require `cancel-in-progress: false`.** Otherwise a later run can cancel an active deployment and leave partial state.
- **`dry_run` is a boolean input.** Test `!inputs.dry_run`, not equality with the string `"true"`, which can turn the default rehearsal into a real deployment through expression coercion.
- **Package publication is not reversible.** npm and PyPI recover through a new version plus deprecate or yank. Record that truth instead of claiming rollback.
- **Pages has no native rollback.** Rerun an old commit's deployment. If the `github-pages` environment lock stalls, force-cancel through the API.
- **Do not hand-edit ledger-owned output.** Workflows with `managed-by` and `release-please-config.json` are regenerated and `check:cicd` reports drift. `.release-please-manifest.json` is the exception: Release PRs update it after bootstrap and the generator validates without overwriting it.
- **The generator cannot resolve conflicts by deletion.** It rejects unmanaged same-name files, configs with unproven ownership, symlinks, and stale artifacts after rename or disable. Present the exact list to the user before migration or deletion.
