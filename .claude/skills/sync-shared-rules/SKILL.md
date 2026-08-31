---
name: sync-shared-rules
description: Synchronize reusable engineering rules added or changed in project-scaffold, such as the Git workflow or commit format, to sibling personal repositories recorded in the ledger. Trigger when the user asks to sync a rule to other projects, add the same rule to another repository, keep sibling projects current, or distribute a general change from `.claude/rules/*.md` or `codex-rules/rules/*.md`. Enforce the complete loop: read the ledger, inspect each repository, adapt to its mechanism, test behavior, write and commit locally, then update the ledger. Never copy bytes blindly across repositories.
---

# Synchronize Rules Across Sibling Repositories

English | [Chinese](SKILL-zh.md)

## Triggers

- The user explicitly asks to synchronize a rule from project-scaffold or the current repository to sibling repositories.
- After changing a reusable rule under `.claude/rules/*.md` or `codex-rules/rules/*.md`, the user asks whether or how other projects should receive it.
- The user says a repository listed in the ledger must adopt the latest rules.

## Prerequisite

Read the ledger in [`docs/architecture/sibling-repo-sync.md`](../../../docs/architecture/sibling-repo-sync.md), including repository paths, rule-file locations, commit validation, CI, and synchronization history. The ledger avoids repeating every discovery step, but repository owners may have changed their projects manually. Treat it as a starting point, not current truth.

## Required workflow

1. **Read the ledger:** identify the rule, target repositories, rule locations, and commit-validation mechanism.
2. **Inspect each repository:** read its actual `CLAUDE.md`, `AGENTS.md`, `codex-rules/rules/*.md`, and commit checker. Run `git status --short` to protect unrelated work and record the current branch.
3. **Adapt to the local mechanism:** one repository may use a shell hook, another a Python checker or commitlint, and another documentation only. Some have CI and others do not. Rewrite both prose and validation for the target instead of copying project-scaffold text.
4. **Test before writing:** for a commit-format regex, hook, or commitlint change, execute one example that must pass and one that must fail through the real checker, such as a direct hook call or `pnpm exec commitlint`. Visual inspection is not acceptance.
5. **Write and commit locally without pushing:** use each repository's own subject format, which also exercises its commit-msg hook. Ask before pushing or opening a PR.
6. **Update the ledger:** append the synchronized rule, repositories, date, and any related fixes to the synchronization history.

## Common pitfalls

- A permissive expression such as `.+` makes a documented commit rule unenforced. Tighten it to require the repository's actual Conventional Commit structure and test both acceptance and rejection.
- A commitlint or husky repository may cap `header-max-length`, commonly at 100 characters. Keep subjects concise and run the real checker before delivery.
- Do not invent CI requirements for a repository without CI. State that they apply after CI is introduced and use the repository's current equivalent local check for this handoff.
- A `.githooks` / `core.hooksPath` hook is inactive until the one-time enable command has run. Execute the documented non-destructive setup step when it is clearly in scope, or tell the user exactly what remains.
