# Complex Implementation Workflow

The root [AGENTS.md](../../AGENTS.md) owns the common task loop. For cross-module work:

- Establish the relevant design, current implementation, shared contracts, and pending decisions before integration. Derive completion checks from the requested outcome and existing contracts.
- Split work only where a boundary has independent acceptance; execute dependencies in order.
- Verify each module's normal and error/boundary input-output behavior with fixtures or stubs when dependencies are unavailable. Use [issue rules](issue-workflow.md) for contract details.
- Keep the plan current when evidence changes. At interruption, retain the objective, completed verification, remaining work, and blockers so work can resume without restarting.

A small fix or read-only answer needs no separate plan, issue, or design proposal unless it changes a documented contract.
