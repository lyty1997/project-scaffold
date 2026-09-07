# Python

Apply to Python work using the project's configured tools. Read the [Python recipe](../../docs/architecture/stack-recipes/python.md) only when configuring the stack; it does not require adopting dependencies or a coverage target.

- Annotate function parameters, returns, and generic element types; explain necessary `Any`. Validate external input with the established boundary schema.
- Use context managers for files, connections, sessions, and locks; use `tempfile` for temporary files.
- Keep blocking I/O off the event loop. Synchronize shared mutable state and use a consistent lock order.
- Use parameterized SQL and subprocess argument lists. Do not add dynamic code execution or `shell=True` without a justified, documented boundary.
- Catch expected exceptions narrowly; handle or propagate errors visibly. Do not substitute empty/fake success.
- Verify changed behavior with applicable configured checks and meaningful normal/error cases; isolate unavailable external services.

For tasks and subprocess lifecycles, read [resource safety](concurrency-resource-safety.md).
