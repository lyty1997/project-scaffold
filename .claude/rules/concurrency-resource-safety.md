# Concurrency and Resource Cleanup

English | [Chinese](../rules-zh/concurrency-resource-safety-zh.md)

Every object that can outlive the main control flow while holding resources, including an asyncio Task, subprocess, thread, or handle, must have explicit lifecycle ownership.

## asyncio Task

- Never call bare `asyncio.create_task(coro())`. Retain the reference and cancel plus gather it during shutdown.
- Use one tracked container in a framework: a `set` with `add_done_callback(set.discard)`, or `manager.spawn_background()`.
- After `task.cancel()`, always await the task, suppressing the expected `CancelledError` with `contextlib.suppress`; otherwise Python can report “Task was destroyed but it is pending.”
- If task creation and registration are separate steps, guard the gap with try/except and call `bg.cancel()` when registration fails.
- Ruff `--select` must include `RUF006` for dangling asyncio tasks.

## Long-lived subprocesses

- `Popen` and `create_subprocess_exec` must use `start_new_session=True`, making the PID equal to the PGID for reliable `killpg` cleanup.
- On Linux, use `preexec_fn` to set `prctl(PR_SET_PDEATHSIG, SIGKILL)` so the kernel cleans up after a parent killed with SIGKILL.
- A coroutine must continuously consume `stdout=PIPE` and `stderr=PIPE` with `readline()`. Otherwise the 64 KiB pipe buffer can fill and block the child on its next log write.
- Shutdown order is: cancel drain tasks, call `killpg`, then clear task lists and process handles in `finally`.

## Four process-level safeguards for long-lived children

1. **atexit:** `_kill_pgid_sync(pgid, grace=3.0)` sends SIGTERM, polls, then sends SIGKILL.
2. **PDEATHSIG(SIGKILL):** `prctl` in `preexec_fn` covers a parent killed with SIGKILL.
3. **SIGHUP handler:** synchronously call `killpg`, then forward SIGTERM to self to cover terminal closure or SSH disconnect. Handle only SIGHUP; do not replace uvicorn's SIGINT/SIGTERM handlers. Installation must be idempotent.
4. **Startup scan:** inspect `/proc` and remove stale matching processes.

Maintain pgids in a module-level `_tracked_pgids: set[int]`; `_track_pgid` and `_untrack_pgid` must be paired and idempotent.

## Threads, files, and network resources

- Join every long-lived `threading.Thread`. Use `ThreadPoolExecutor` as a context manager or call `shutdown(wait=True)`.
- Close long-lived HTTP clients such as httpx, openai, or litellm with `aclose()` during shutdown.
- WebSocket subscribe and unsubscribe operations must be idempotent; prefer `set.discard` to `remove`.
- Manage files, sockets, and databases with `with`, `async with`, or try/finally.

## Shell launch scripts

- Install `trap cleanup EXIT INT TERM`; the cleanup function needs a reentrancy guard.
- After SIGTERM, poll for a bounded period and fall back to SIGKILL so a stuck lifespan cannot keep the script alive forever.
- After the first Ctrl+C, change the trap so a second Ctrl+C invokes `_force_kill` with `kill -9 $(jobs -p); exit 130`.
- Use `jobs -p`, not `pkill`, so the script kills only its own children.

## Shutdown order for FastAPI lifespan and similar frameworks

Reordering these steps can corrupt protocol state or lose data:

1. Cancel and await user background tasks such as warmup.
2. Call `manager.shutdown()` to cancel running jobs and framework background coroutines.
3. Cancel and await long loops such as cleanup loops.
4. Release synchronous resources such as temporary directories.
5. Call `pipeline.shutdown()` to release OCR, subprocess, and model resources.
6. Call `db.close()`.

## PR checklist

- [ ] Is every `create_task` return value retained?
- [ ] Does every long-lived child use `start_new_session=True`?
- [ ] Does every `PIPE` have a drain coroutine?
- [ ] Does shutdown cancel and await every task?
- [ ] Does each launch script provide a SIGKILL fallback and second-Ctrl+C force kill?
- [ ] Do HTTP clients and databases have an `aclose()` or `close()` path?

## Common anti-patterns

```python
asyncio.create_task(some_coro())          # Bare fire-and-forget
task.cancel()                             # Never awaited; cancellation leaks into the loop
subprocess.Popen([...], stdout=PIPE)      # No drain; the child can deadlock
await pipeline.shutdown()                 # Wrong order: pipeline closes first
await manager.shutdown()                  # Tasks cancel later and corrupt the worker protocol
```
