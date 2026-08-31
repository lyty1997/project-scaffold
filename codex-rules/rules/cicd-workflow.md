# CI/CD Setup and Maintenance

English | [Chinese](cicd-workflow-zh.md)

The design source of truth is [Automated CI/CD Setup](../../docs/architecture/cicd-autosetup.md). This file contains only mandatory Agent behavior.

## 1. When to propose CI/CD proactively

Do not wait for the user to remember. Recommend CI/CD before continuing when any of the following becomes true:

- The project has just selected a technology stack or added buildable source for the first time, such as `CMakeLists.txt`, `pyproject.toml`, a build script in `package.json`, or a `Dockerfile`.
- The project adds its first third-party dependency or first releasable artifact, such as a binary, wheel, image, or static site.
- The user mentions deployment, release, launch, rollback, or distributing the project to others.
- The repository contains source code but no `docs/contracts/cicd-answers.json` ledger.

If the user explicitly defers CI/CD, record the decision and reason in [Open Decisions](../../docs/architecture/open-decisions.md). Do not leave it implicit or ask repeatedly.

## 2. Distinguish framework maintenance from target-project delivery

When maintaining the scaffold's detector, renderer, quality scripts, or baseline `.github/workflows/ci.yml`, update the [Automated CI/CD Setup design](../../docs/architecture/cicd-autosetup.md) first, then change the implementation and run `npm run quality`, `npm run check:workflows`, and `npm run check:workflows:fixtures`. Framework maintenance does not require an existing target-project ledger and is not blocked on running the target-facing `npm run cicd:probe` command.

When applying CI/CD to a concrete project created from this scaffold, complete the full `setup-cicd` Skill workflow.

Never hand-write or directly edit a workflow carrying the `managed-by` marker or the ledger-generated `release-please-config.json`. The renderer owns the safety structure: least privilege, SHA-pinned actions, safe secret syntax, explicit shells, and false-green defenses. Change the target-project ledger and regenerate instead. `.release-please-manifest.json` is the exception: after bootstrap, Release PRs update it and the generator validates without overwriting it.

Adding a hand-written workflow or config to the ledger does not transfer ownership automatically. Present same-name conflicts, symlinks, and stale managed artifacts to the user before proceeding; the generator must not overwrite or delete them on its own.

The supported path is: `npm run cicd:probe` → confirm facts the detector cannot discover → write `docs/contracts/cicd-answers.json` → `npm run gen:cicd` → `npm run quality` → `npm run check:workflows` → verify a real green run.

## 3. Four decisions that must never be guessed

The detector reports facts only. The user must decide:

- **Build and test commands:** read them from declared project scripts or ask the user. The Agent must not invent them.
- **Deployment target:** Pages, Cloudflare, Vercel, containers, package publication, and self-hosting require different credentials and rollback strategies.
- **Release cadence:** what triggers a release and whether it requires a human gate.
- **Release parameters:** the user must confirm the release type, current version, version source of truth, history starting point, tag rules, and token mode. The scaffold's `package.json` is not automatically every project's product-version source. The second increment supports only `node` and `simple` with an established version-source mapping; do not pass through other types unchecked.

If no build system can be detected, stop and ask instead of guessing. GitLab Auto DevOps abandoned Auto Test precisely because guessed commands were unreliable.

## 4. Run preflight checks before remote writes

For target-project CI/CD delivery, run `npm run cicd:probe` and inspect blockers before writing the ledger or generated artifacts. Framework maintenance remains exempt as described in section 2. Three hard constraints are already known:

- A token without the `workflow` scope cannot push `.github/workflows/*`. The user must run `gh auth refresh -h github.com -s workflow`; browser authorization is a required pause point.
- Private repositories on the free plan do not support environments, branch protection, rulesets, or Pages. Explicitly state that unsupported controls were skipped because of the plan; never omit them silently.
- `gh` has no `gh ruleset create`. Enable rulesets, branch protection, environments, and Pages through `gh api --input`. Send secrets through stdin instead of `--body` to keep them out of shell history.

`gh api` exits 1 for both 403 and 404 and writes error JSON to stdout, so parse the response body's `.status` rather than relying on the exit code. Do not use `gh auth status` as the authentication verdict because it can still exit 0 after a timeout.

## 5. Definition of green

An exit code of 0 from `gh run watch` is not sufficient. Assert every job and step: find the run by SHA and fail if none exists; require `status == "completed"` and `conclusion == "success"`; require every expected job to appear and succeed, treating `skipped`, `cancelled`, and `null` as failures; and require the evidence step to exist and succeed.

An API failure is UNKNOWN. Retry or report it; never treat missing evidence as a pass. Do not report completion while CD is red or its state is unknown.

## 6. Change discipline

- Do not hand-edit workflows with a `managed-by` marker or `release-please-config.json`. Change the ledger and run `npm run gen:cicd`, or `npm run quality` will report drift. Release PRs evolve the manifest within the ownership boundary above.
- A missing manifest alongside an existing config or release workflow is lost runtime state and must be restored. Stale artifacts left by a rename or disable operation require user confirmation before deletion; the generator must not remove them silently.
- Every step in a `kind: deploy` workflow must declare `deployStep: true` for a real deployment or `deployStep: false` for safe preparation or verification. One protected step cannot act as a `dry_run` sentinel for a new, unclassified deployment step.
- Synchronize `docs/` whenever the ledger, deployment targets, or rollback process changes.
- Document a rollback method for every deployment target. Package publication is inherently irreversible; state that recovery requires a new version and a yank instead of inventing rollback support.
