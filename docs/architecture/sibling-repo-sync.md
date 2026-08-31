# Sibling Repository Rule-Synchronization Ledger

English | [Chinese](sibling-repo-sync-zh.md)

Status: active
Last updated: 2026-07-09
Applies to: records and operating procedures for synchronizing shared engineering rules such as `git-workflow` among other repositories developed in parallel by this repository's owner. **This document describes a private set of projects owned by the repository owner; it is not general advice for everyone who initializes a new project from this scaffold.** If you are using the scaffold for an independent project of your own, this document is irrelevant and can be deleted.

## Background

`project-scaffold` is the rule source for the parallel projects listed below. Some were initialized directly with `npm run init`, while others are independent repositories that share the same personal engineering conventions. When `project-scaffold` adds or changes a common rule such as commit formatting or post-push CI observation, that change should in principle propagate to these repositories. **Mechanical byte-for-byte copying is incorrect**, however: their rule-file structures, CI job names, and mechanisms for enforcing commit formats differ completely—shell regular expressions, Python scripts, and Commitlint configurations. Each repository must be inspected, adapted to its actual mechanism, and tested before the rule is applied.

## Scope assessment

The scope is **appropriate**. Git submodules, subtrees, or cross-repository CI dispatch are not introduced: for four personal repositories, their maintenance cost exceeds the benefit, and they cannot solve the fundamental problem that different mechanisms require adaptation rather than byte copying. Maintain one human-readable ledger and one Skill that codifies the process. Consulting the ledger whenever a rule changes is much faster than rediscovering every repository from scratch, while retaining the necessary manual adaptation step. These are genuine implementation differences; skipping that step would create new drift.

## Repository inventory

| Repository | Path relative to this repository's parent | Rule-file location | Machine validation of commit format | CI |
|---|---|---|---|---|
| Augur_Maestro | `../AxiomMind/Axial_Muse/Augur_Maestro` | `CLAUDE.md` for convention details plus `codex-rules/rules/git-workflow.md` for general operating rules; no separate `.claude/rules/` | `src/scripts/quality/commit_msg_check.py`, run during pre-commit's commit-msg stage with a Python regular expression | `.github/workflows/ci.yml`: `python-quality` for ruff, mypy, pytest, and related checks, plus `diagrams` |
| AxialMuseWebsite | `../AxiomMind/Axial_Muse/AxialMuseWebsite` | `CLAUDE.md` plus `codex-rules/rules/git-workflow.md`; no `.claude/rules/` | `.githooks/commit-msg`, a shell regular expression requiring `git config core.hooksPath .githooks`; the file and configuration were added on 2026-07-09 | `.github/workflows/ci.yml`: `Website quality gates` running `npm run quality`; no diagrams job |
| Narrative_Maestro | `../AxiomMind/Axial_Muse/Narrative_Maestro` | `codex-rules/rules/git-workflow.md`; no `.claude/rules/` | `.husky/commit-msg` → `commitlint` through `commitlint.config.cjs`; note the 100-character `header-max-length` limit | `.github/workflows/ci.yml`: `quality`, `dependency-audit`, and `database`; `stability.yml` is a daily cron plus manual trigger and does not participate in immediate push/merge observation |
| DocRestore-pro | `../DocRestore/DocRestore-pro` | `AGENTS.md` contains all conventions in one file, without a `codex-rules` or `.claude` split | None; `.pre-commit-config.yaml` exists, but no commit-msg hook is installed or enabled | No `.github/workflows`; currently no CI |

## Synchronization record

| Date | Rule | Synchronized to | Notes |
|---|---|---|---|
| 2026-07-09 | Bilingual commit message with English first, plus mandatory CI observation after push or merge | All four repositories above | Augur_Maestro also tightened an overly permissive validation regex whose `.+` accepted any content; tests proved a bilingual subject passed and a Chinese-only subject was rejected. AxialMuseWebsite added the missing `.githooks/commit-msg` and enabled it with `git config core.hooksPath .githooks`. Narrative_Maestro first confirmed with `pnpm exec commitlint` that a bilingual subject passed, then adopted the rule. Because DocRestore-pro has no CI, its CI-observation clause was marked "effective after CI is integrated" instead of inventing a nonexistent gate. |

## Procedure for the next shared rule

Do not edit repository files from memory or paste the complete `project-scaffold` wording into every repository. Invoke the `sync-shared-rules` Skill, or follow these steps manually:

1. Finalize the new rule in `project-scaffold` under `.claude/rules/*.md` and `codex-rules/rules/*.md`.
2. For each repository in the table, recheck whether its rule files still match the ledger; the owner may have changed them manually, making the ledger stale. Adapt the new rule to that repository's actual mechanism, including CI job names and commit validation.
3. If the change affects machine validation—for example, by tightening a regular expression or modifying Commitlint—construct one example that must pass and one that must fail. Test the validator itself before applying the change to the repository.
4. Commit locally in each repository after the change, but **do not push automatically**. Append this synchronization to the table above so the next run can identify which repositories have caught up.
