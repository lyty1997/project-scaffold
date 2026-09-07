---
name: sync-shared-rules
description: Adapt shared engineering rules to sibling repositories when the user requests synchronization. Editing a reusable rule alone does not trigger writes to other repositories.
---

# Synchronize Shared Rules

1. Establish the requested rule and target repositories. Read the [synchronization ledger](../../../docs/architecture/sibling-repo-sync.md) for those targets; verify its paths and mechanisms against current files.
2. Inspect each target's Agent instructions, affected rules/checkers, branch, and worktree. Preserve unrelated changes.
3. Adapt to the target's actual hook, commitlint, CI, or documentation mechanism. Do not copy scaffold-specific assumptions or add absent infrastructure.
4. Validate changed behavior in a temporary fixture before applying it where practical. For a checker, exercise a passing and failing example through the real checker, then verify the target result. Respect local limits such as commit-subject length.
5. Apply authorized changes. Enable a required existing hook only when in scope. Commit, push, or open a PR according to session authorization and target rules; this Skill grants none by itself.
6. Record the rule, targets, date, validation, and any remaining work in the ledger and progress documents.

For an assessment-only request, produce the comparison without mutating sibling repositories. Do not treat a repository without CI as having failed a nonexistent CI gate.
