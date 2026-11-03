# Concurrency and Resources

Apply when work creates tasks, subprocesses, threads, or long-lived handles.

- Assign every resource an owner and cleanup path. Retain background-task references, observe failures, and cancel then await tasks during shutdown; clean up if registration fails.
- Consume child stdout/stderr pipes while the child can write, or use bounded `communicate()` for finite jobs. Avoid waiting on a child blocked by full pipes.
- Terminate only owned children/process groups using platform-supported APIs. Bound graceful shutdown, force termination if needed, and reap the child. Add crash-recovery machinery only for a demonstrated lifecycle requirement.
- Stop producers and await dependent tasks before closing their clients, workers, databases, or files. Choose shutdown order from actual dependencies.
- Join threads or shut down executors; close clients, files, sockets, and connections with context managers or `finally`.
- Make unsubscribe and repeated cleanup idempotent. Shell launchers need guarded traps and bounded child cleanup; avoid broad process-name or system-wide stale-process killing.

Verify cancellation, failure, and shutdown paths relevant to the change. Do not copy a Linux-specific process recipe into an unrelated platform or framework.
