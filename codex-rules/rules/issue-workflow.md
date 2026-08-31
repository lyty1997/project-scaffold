# Writing and Decomposing Issues

English | [Chinese](issue-workflow-zh.md)

Use this rule for new or changed modules, cross-module contracts, and complex work that cannot be completed in one loop. A documentation-only or isolated single-file fix with no cross-layer impact is exempt.

## New-module issues

The acceptance checklist must include:

- Public interface signatures, including function, route, or event names.
- Parameters, return values, enums, and error structures, with type, requirement, and value range for every field.
- The provider, injection layer, and upstream/downstream dependencies of cross-layer fields and IDs. Related issues must reference the same contract.
- When an upstream or downstream dependency is unavailable, mocks, stubs, or fixtures covering the normal path and at least one error or boundary path, with input/output contract assertions.
- Reviewable test output, logs, or screenshots in the issue or PR. Do not mark the issue Done without reproducible input/output evidence.

## Complex work

- Split work into sub-issues with clear boundaries and independent acceptance. The parent issue should summarize only scope and milestones.
- Mark `blocks` and `blocked-by` relationships and execute in dependency order.
- Every sub-issue still follows the contract and evidence requirements. Close one complete loop before starting the next instead of accumulating partial work.
- Split again when a sub-issue still crosses several modules or cannot produce independent evidence. Merge tasks when coordination cost clearly exceeds implementation cost.

Before completion, check the [Git Workflow](git-workflow.md) and record cross-module evidence in both [progress.md](../../docs/progress.md) and [progress-zh.md](../../docs/progress-zh.md).
