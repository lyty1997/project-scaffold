# Python Technology Stack Reference Recipe

English | [Chinese](python-zh.md)

Optional. Apply this recipe only after [Open Decisions](../open-decisions.md) selects Python as the backend language. See [`.claude/rules/python-coding-rules.md`](../../../.claude/rules/python-coding-rules.md) for the governing rules.

## `pyproject.toml`: ruff + mypy + pytest

```toml
[tool.ruff]
target-version = "py312"
line-length = 100

[tool.ruff.lint]
# B=bugbear, C4=comprehensions, C90=mccabe complexity, UP=pyupgrade, T20=print,
# ARG=unused arguments, RET=return consistency, S=bandit security checks,
# ASYNC=async misuse, SIM105=use contextlib.suppress instead of an empty
# try/except, PT=pytest style, RUF006=bare asyncio create_task (paired with
# the concurrency-safety rules).
select = ["E", "F", "W", "B", "C4", "C90", "UP", "T20", "ARG", "RET", "S", "ASYNC", "SIM105", "PT", "RUF006"]
ignore = [
  "RUF001", "RUF002", "RUF003", # False positives from non-ASCII punctuation.
]

[tool.ruff.lint.per-file-ignores]
"tests/**" = ["S101", "ARG001", "ARG002"] # Allow bare assert and unused fixture arguments in tests.
"scripts/**" = ["T201", "E501"]           # Allow print and somewhat longer lines in utility scripts.

[tool.mypy]
strict = true
explicit_package_bases = true

# Register third-party libraries without type stubs here. Do not scatter
# `# type: ignore` comments throughout the codebase.
[[tool.mypy.overrides]]
module = ["some_untyped_lib.*"]
ignore_missing_imports = true

[tool.pytest.ini_options]
addopts = "--strict-config --strict-markers"
asyncio_mode = "auto"
filterwarnings = [
  # Suppress only precisely identified third-party noise. Do not use one
  # wildcard rule to silence every warning.
  "ignore:some known third-party DeprecationWarning:DeprecationWarning",
]

[tool.coverage.report]
fail_under = 80
exclude_also = ["if TYPE_CHECKING:", "if __name__ == .__main__.:", "\\.\\.\\."]
```

## `.pre-commit-config.yaml`: local quality gates

```yaml
repos:
  - repo: local
    hooks:
      - id: mypy-strict
        name: mypy --strict
        entry: mypy --strict
        language: system
        files: '\.py$'
        pass_filenames: true
      - id: ruff-check
        name: ruff check
        entry: ruff check
        language: system
        files: '\.py$'
      - id: typos
        name: typos
        entry: typos
        language: system
```

Key point: when pre-commit runs in an isolated environment, explicitly declare every third-party plugin required by a hook—for example, mypy's `pydantic.mypy` plugin—in that hook's `additional_dependencies`. Otherwise, the isolated virtual environment raises an `ImportError` even though running the tool directly in the local environment works. This problem often appears only in CI or pre-commit.

## Dependency locking with pip-tools

When not using Poetry or uv, maintain `requirements.txt` for runtime dependencies, `requirements-dev.txt` for development dependencies with `-r requirements.txt`, and a compiled lock:

```bash
python -m piptools compile requirements-dev.txt \
  --output-file requirements-dev.lock.txt \
  --no-emit-index-url --no-emit-trusted-host
```

Both CI and local development install `requirements-dev.lock.txt`. After changing any `requirements*.txt` file, regenerate and commit the lockfile as part of the same change; never update only the source file without recompiling it.

## `_typos.toml`: identifier spelling-check allowlist skeleton

```toml
[default.extend-identifiers]
# Add identifiers that are valid in this project but that typos flags.

[default.extend-words]
# Add valid words that the spelling checker commonly flags.
```

Maintain only the skeleton. Add specific entries one at a time in response to real false positives; do not pre-populate a large set of unused exceptions.
