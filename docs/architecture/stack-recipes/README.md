# Technology Stack Reference Recipes

English | [Chinese](README-zh.md)

Status: active
Last updated: __replace with the current date when applying these recipes__

These are optional configurations for a stack selected in [Open Decisions](../open-decisions.md); they introduce no dependency by default. The [Python](../../../.claude/rules/python-coding-rules.md) and [TypeScript](../../../.claude/rules/typescript-coding-rules.md) rules define concise coding constraints. These recipes offer tool settings to adopt when needed. Actual project configuration determines commands, dependencies, and coverage requirements; a rule or recipe does not select them automatically.

## How to use these recipes

1. First record in [Open Decisions](../open-decisions.md) why you chose the stack and what problem it solves.
2. Copy the relevant configuration snippets into your project and adjust paths to match the actual directory structure.
3. If your project's resulting configuration differs from this reference, change your project's own configuration. This directory is only a starting point, not a source of truth that must stay synchronized, and it will not update automatically as your project evolves.

## Contents

- [python.md](python.md): ruff select/ignore rules, mypy strict mode with per-module overrides, pytest configuration, local pre-commit hooks, and pip-tools dependency locking.
- [typescript.md](typescript.md): `eslint.config.js` with `strictTypeChecked` and `stylisticTypeChecked`, the complete `tsconfig.json` strict option set, and separate Vitest configurations for unit and database integration tests.
- [migration-ledger-check.md](migration-ledger-check.md): an optional reference script for checking database migration-identifier consistency. Use it only when the project has introduced a database migration tool and maintains migration order in a design-document ledger.
