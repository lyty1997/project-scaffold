# Technology Stack Reference Recipes

English | [Chinese](README-zh.md)

Status: active
Last updated: __replace with the current date when applying these recipes__

This directory does **not** introduce any dependency into the scaffold by default. It contains reference configurations that you can copy once you have selected a technology stack in [Open Decisions](../open-decisions.md). These snippets correspond directly to the conventions described in [`.claude/rules/python-coding-rules.md`](../../../.claude/rules/python-coding-rules.md) and [`.claude/rules/typescript-coding-rules.md`](../../../.claude/rules/typescript-coding-rules.md): those two files say *what* to do, while this directory shows *how* to configure it.

## How to use these recipes

1. First record in [Open Decisions](../open-decisions.md) why you chose the stack and what problem it solves.
2. Copy the relevant configuration snippets into your project and adjust paths to match the actual directory structure.
3. If your project's resulting configuration differs from this reference, change your project's own configuration. This directory is only a starting point, not a source of truth that must stay synchronized, and it will not update automatically as your project evolves.

## Contents

- [python.md](python.md): ruff select/ignore rules, mypy strict mode with per-module overrides, pytest configuration, local pre-commit hooks, and pip-tools dependency locking.
- [typescript.md](typescript.md): `eslint.config.js` with `strictTypeChecked` and `stylisticTypeChecked`, the complete `tsconfig.json` strict option set, and separate Vitest configurations for unit and database integration tests.
- [migration-ledger-check.md](migration-ledger-check.md): an optional reference script for checking database migration-identifier consistency. Use it only when the project has introduced a database migration tool and maintains migration order in a design-document ledger.
