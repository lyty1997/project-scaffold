# Issues and Module Contracts

For issue work or a changed cross-module interface, define:

- Public function, route, or event signatures; each field's type, required/optional status, range/enums, and error shape.
- Providers, injection points, and upstream/downstream dependencies for shared IDs and fields. Reference one contract from dependent tasks.
- Reproducible normal and error/boundary input-output evidence. Use mocks, stubs, or fixtures when dependencies are unavailable; do not mark a module complete without evidence.

Split complex work into bounded tasks with independent acceptance and explicit `blocks` / `blocked-by` dependencies. Keep the parent to scope and milestones; merge tasks when coordination exceeds the benefit. A local plan or design can carry this structure; create external issues only within the requested scope. Small documentation or isolated fixes need no issue ceremony.
