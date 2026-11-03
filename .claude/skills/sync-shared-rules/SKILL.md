---
name: sync-shared-rules
description: Compare or synchronize engineering rules across named repositories when requested. A local rule edit does not trigger synchronization.
---

# Compare or Synchronize Shared Rules

Determine whether the request is comparison-only or synchronization. Comparison is read-only, including the ledger and progress logs. Synchronization changes only the named rules and targets; commits, pushes, and PRs require session authorization.

1. Establish the requested rule and target repositories. Read the [synchronization ledger](../../../docs/architecture/sibling-repo-sync.md) for those targets; verify its paths and mechanisms against current files.
2. Inspect each target's Agent instructions, affected rules/checkers, branch, and worktree. Preserve unrelated changes.

For synchronization:

- Adapt to the target's actual hook, commitlint, CI, or documentation mechanism. Do not copy scaffold-specific assumptions or add absent infrastructure.
- Validate changed behavior in a temporary fixture before applying it where practical. For a checker, exercise passing and failing examples through the real checker, then verify the target result. Respect local limits such as commit-subject length.
- Apply authorized changes under each target's rules. Enable a required existing hook only when in scope.
- Record the rule, targets, date, validation, and remaining work in the ledger and progress documents.

Report per-target changes or differences, checks actually run, and unresolved conflicts. A repository without CI has no CI result; do not report a nonexistent gate as failed.
