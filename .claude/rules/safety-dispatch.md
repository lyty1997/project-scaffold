# Hook Checks

`.claude/settings.json` runs `post-edit-safety.py` after Write/Edit. The hook's `CHECKS` and `EXT_MAP` own extension dispatch, commands, and severity; do not duplicate that table in prompts.

Resolve failed, missing, or timed-out `must_pass=true` checks; `must_pass=false` reports warnings. Hook output is evidence only for checks actually run, and does not replace project gates. A new stack needs an explicit design decision before changing hooks or dependencies.
