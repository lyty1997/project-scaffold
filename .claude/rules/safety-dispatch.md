# Coding Safety: Automatic Stack Dispatch

English | [Chinese](../rules-zh/safety-dispatch-zh.md)

## Automated hook checks

After every Write or Edit of a code file, `.claude/hooks/post-edit-safety.py`:

- detects the stack from the extension: `.py`/`.pyi` for Python, `.ts`/`.tsx` for TypeScript, and `.js`/`.jsx` for JavaScript;
- runs `mypy --strict`, `ruff check`, and `typos` for Python;
- runs `tsc --noEmit`, ESLint, and `typos` for TypeScript;
- runs ESLint and `typos` for JavaScript;
- reports results through additionalContext;
- treats a failed, missing, or timed-out `must_pass=true` check as an error that must be fixed;
- reports `must_pass=false` checks as non-blocking warnings.

The hook is configured under `.claude/settings.json` at `hooks.PostToolUse`. It activates with the repository after cloning. A same-named hook in the user's global `~/.claude/settings.json` is merged and may also run.

## Rules by stack

Hooks provide automated checks; these files define coding guidance:

| Stack | Rule |
| --- | --- |
| Python | `python-coding-rules.md` |
| TypeScript / JavaScript | `typescript-coding-rules.md` |
| Rust | Pending |
| Go | Pending |
| Cross-language concurrency and resources | `concurrency-resource-safety.md` for asyncio tasks, subprocesses, pipe draining, shutdown order, and shell traps |

## Adding a stack

1. Add the language commands to `CHECKS` and `EXT_MAP` in `.claude/hooks/post-edit-safety.py`.
2. Create the matching rule file under `.claude/rules/` and its maintained translation under `.claude/rules-zh/`.
3. Update the table above and its Chinese counterpart.
