# Writing and Decomposing Issues

English | [Chinese](../rules-zh/issue-workflow-zh.md)

This rule governs how to write and split issues or Linear tasks before implementation. It applies to new or modified modules and complex work spanning multiple steps. Documentation-only and small single-file fixes are exempt unless they change a cross-module contract.

## 1. New-module issues must contain actionable steps

Do not begin from an issue that says only “implement module X.” Put both groups below in its acceptance checklist.

### Align the API before integration

- Write the module's public interface signature: function name, route path and method, or event name.
- Specify every parameter and return field: name, type, optional or required status, enum range, and error code and structure.
- Identify cross-layer contract fields: which layer supplies a tenant ID, revision, or related ID and where it is injected.
- Cross-reference upstream and downstream issues and confirm both use the same signature.
- Reason: mismatched signatures, field names, types, enums, or error shapes fail during integration. Aligning them first is equivalent to agreeing on a `.h` header before separate `.c` implementations.

### Use simulated data until dependencies are ready

- Use a mock, stub, or fixture for upstream input, covering the normal path and at least one error or boundary path.
- Capture downstream output with a stub or assert that it matches the agreed contract.
- Produce and retain input-to-output evidence such as test output, logs, or screenshots in the issue.
- **Acceptance gate: a module without input/output evidence is incomplete and must not be marked Done.**
- Reason: “wait for the downstream dependency” is not a substitute for isolated testing. Each module must prove its contract before integration or stacked defects become impossible to localize.

## 2. Split complex work into ordered sub-issues

For work spanning several modules or states, too large for one pass, or lacking a clear implementation path:

1. Split it into bounded tasks with independent acceptance before implementation.
2. Create one sub-issue per task under a parent that contains only the summary and milestones.
3. Mark `blocks` and `blocked-by` relationships to make execution order explicit.
4. Apply section 1 to every sub-issue that introduces a module.
5. Close one sub-issue with evidence before starting the next; do not accumulate parallel partial implementations.

A useful sub-issue can usually be completed independently in half a day to two days. Merge tasks when coordination cost exceeds implementation cost; split again when one task still spans three or more modules or cannot be completed independently.
