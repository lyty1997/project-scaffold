# TypeScript and JavaScript

Use project configuration and installed tools. Read the [TypeScript recipe](../../docs/architecture/stack-recipes/typescript.md) only for stack configuration; it does not mandate new libraries or coverage targets.

- Preserve strict typing. Prefer `unknown` with narrowing to `any`; explain necessary assertions and `@ts-expect-error`. Validate external inputs and environment configuration through the established schema boundary.
- Keep shared types and runtime schemas consistent. Handle absent indexed/Map values and exhaustive union cases.
- Handle or propagate errors visibly; centralize established error/status mappings. Never use an empty catch or fake success.
- Await async work or handle its rejection. Use `Promise.allSettled` when every result matters; serialize conflicting shared-state changes and cancel obsolete work.
- Release listeners, timers, streams, and connections when their owner ends. Handle stream errors.
- Avoid unintended parameter mutation. Use framework escaping, safe URL construction, and parameterized SQL; do not interpolate untrusted HTML or code.
- Run applicable configured checks and meaningful behavior tests; await async assertions and isolate external services.
