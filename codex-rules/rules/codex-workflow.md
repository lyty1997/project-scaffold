# Complex Implementation Workflow

The root [AGENTS.md](../../AGENTS.md) owns the common task loop. For cross-module work:

- Establish the relevant design, current implementation, shared contracts, and pending decisions before integration.
- Split work only where a boundary has independent acceptance; execute dependencies in order.
- Verify each module's normal and error/boundary input-output behavior with fixtures or stubs when dependencies are unavailable. Use [issue rules](issue-workflow.md) for contract details.
- Challenge consequential choices and compare a simpler reversible candidate against the same checks. Keep only complexity supported by evidence.

A small fix or read-only answer needs no separate plan, issue, or design proposal unless it changes a documented contract.
