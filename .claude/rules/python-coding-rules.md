# Python Code Quality and Security

English | [Chinese](../rules-zh/python-coding-rules-zh.md)

## 1. Type safety

### Static checks during development

- Use `mypy --strict` as the primary type checker; the hook runs it automatically.
- A project may also configure strict pyright integration in `pyproject.toml` for the IDE.
- Every function signature requires complete parameter and return annotations.
- Do not use `Any` without a comment explaining why it is necessary.
- Annotate generic element types, such as `list[str]` instead of `list`.
- Document each function's non-obvious contract with a comment or docstring; do not add comments that merely restate the code.

### Runtime validation at system boundaries

- Validate external input such as API requests, user input, configuration, and parsed files with a Pydantic `BaseModel`.
- Performance-sensitive internal paths may use `beartype` decorators for O(1) type assertions.
- Do not replace structured validation with a hand-written chain of `isinstance` checks.

## 2. Resource safety

- Manage files, database connections, network sessions, and locks with `with` or `contextlib.closing`.
- Custom resource classes implement `__enter__` and `__exit__` or inherit `contextlib.AbstractContextManager`.
- Use `tempfile` for temporary files; do not manually combine open and delete.
- Enable Ruff rules `SIM105`, `ASYNC`, `S`, and `PT`.
- Enable pylint's `consider-using-with`.

## 3. Concurrency safety

### Async code

- Do not call blocking I/O such as file operations, `requests`, or `time.sleep` directly inside an async function.
- Wrap blocking work with `asyncio.to_thread()` or use a native async library such as `aiohttp` or `aiofiles`.
- In development, enable event-loop debugging with `loop.set_debug(True)` and `slow_callback_duration = 0.1`.

### Multithreaded code

- Protect shared mutable state with `threading.Lock` or `Queue`; never write it without synchronization.
- Prefer a `Guarded[T]` wrapper that requires context-manager access.
- Avoid nested locks. When unavoidable, enforce one global acquisition order.

## 4. Vulnerability prevention

- Never concatenate SQL; use parameterized queries.
- Do not use `eval()` or `exec()` without a documented security sandbox.
- Do not pass `shell=True` to subprocesses; pass an argument list.
- Never log or print keys, tokens, passwords, or other sensitive values.

## 5. Testing

- Use `pytest` and `pytest-asyncio`; async tests must run in asyncio mode.
- New behavior requires unit tests, and core modules target at least 80% coverage.
- Mirror `src/` under `tests/` and prefix test filenames with `test_`.
- Isolate external services such as Docker, Git, and Redis in containers for integration tests.
- The Tester role generates cases, runs them in the sandbox, and reports results to the Reviewer.

## 6. Three layers of automated checks

### PostToolUse hook

After every Write or Edit, `.claude/hooks/post-edit-safety.py` runs:

- `mypy --strict` for types;
- `ruff check` with B, C4, C90, UP, T20, ARG, RET, S, ASYNC, SIM105, and PT;
- `typos`, including underscore and camelCase identifier splitting.

Errors arrive through additionalContext and must be fixed before continuing.

### pre-commit

`.pre-commit-config.yaml` configures equivalent mypy, Ruff, and typos checks for manually edited code. All must pass before commit.

### Manual pre-commit checks

- `bandit -r src/` for a deeper security scan.
- `pytest --tb=short` for the complete test suite.
