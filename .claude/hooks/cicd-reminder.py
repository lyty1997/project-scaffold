#!/usr/bin/env python3
"""PostToolUse hook that reminds a project to set up CI/CD.

It emits one reminder only when the project has been initialized, real source
code exists, and no CI/CD decision ledger exists yet.

The hook never blocks an action. PostToolUse can only add a reminder; blocking
requires a PreToolUse ``decision:block`` response.

This logic must remain separate from post-edit-safety.py. That hook dispatches
by source extension and deliberately returns silently for files such as .md,
.yml, .c, and .cpp, so extending its CHECKS table would not cover this case.

To avoid noise, the hook records state under the ignored .cicd/ directory and
emits at most one reminder per day.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import date
from pathlib import Path

# Any build-system marker indicates that the project has real implementation.
BUILD_MARKERS: tuple[str, ...] = (
    "CMakeLists.txt", "Makefile", "GNUmakefile", "meson.build",
    "configure.ac", "pyproject.toml", "setup.py", "requirements.txt",
    "tsconfig.json", "Cargo.toml", "go.mod", "Dockerfile",
)
SOURCE_SUFFIXES: frozenset[str] = frozenset({
    ".c", ".h", ".cc", ".cpp", ".hpp", ".py", ".ts", ".tsx", ".rs", ".go",
})
# Exclude scaffold-owned directories so a fresh clone does not trigger a reminder.
SCAFFOLD_DIRECTORIES: frozenset[str] = frozenset({
    ".git", ".claude", ".githooks", ".github", "codex-rules",
    "docs", "scripts", "node_modules",
})
ANSWERS_RELATIVE = "docs/contracts/cicd-answers.json"


def _load_payload() -> dict[str, object] | None:
    """Read the stdin payload, returning None on missing or malformed input."""
    try:
        raw = sys.stdin.read()
    except OSError:
        return None
    if not raw.strip():
        return None
    try:
        parsed: object = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def _project_root() -> Path | None:
    """Locate the repository root from CLAUDE_PROJECT_DIR or a parent .git."""
    env_root = os.environ.get("CLAUDE_PROJECT_DIR")
    if env_root:
        candidate = Path(env_root)
        if candidate.is_dir():
            return candidate
    current = Path.cwd()
    for directory in (current, *current.parents):
        if (directory / ".git").exists():
            return directory
    return None


def _is_initialized(root: Path) -> bool:
    """Treat package.json as initialized when no __PLACEHOLDER__ remains."""
    package_json = root / "package.json"
    if not package_json.is_file():
        # Projects such as pure C/C++ repositories may not have package.json,
        # so this signal cannot prove they are uninitialized.
        return True
    try:
        text = package_json.read_text(encoding="utf-8")
    except OSError:
        return True
    segments = text.split("__")
    return not any(
        part.isupper() and part.isidentifier() for part in segments
    )


def _has_source(root: Path) -> bool:
    """Return whether a build marker or project source file exists."""
    if any((root / marker).is_file() for marker in BUILD_MARKERS):
        return True
    for entry in root.iterdir():
        if not entry.is_dir() or entry.name in SCAFFOLD_DIRECTORIES:
            continue
        for path in entry.rglob("*"):
            if path.is_file() and path.suffix in SOURCE_SUFFIXES:
                return True
    return False


def _already_reminded_today(root: Path) -> bool:
    """Record today's reminder and report whether it already ran today."""
    state_path = root / ".cicd" / "reminder-state.json"
    today = date.today().isoformat()
    if state_path.is_file():
        try:
            stored: object = json.loads(
                state_path.read_text(encoding="utf-8")
            )
        except (OSError, json.JSONDecodeError):
            stored = None
        if isinstance(stored, dict):
            if stored.get("lastRemindedOn") == today:
                return True
    try:
        state_path.parent.mkdir(parents=True, exist_ok=True)
        state_path.write_text(
            json.dumps({"lastRemindedOn": today}), encoding="utf-8"
        )
    except OSError as error:
        # Still emit the reminder when state cannot be stored, but surface the
        # cause because the reminder may repeat.
        sys.stderr.write(
            f"cicd-reminder: could not write reminder state ({error})\n"
        )
    return False


def _reminder_text() -> str:
    """Build the user-facing reminder."""
    return (
        f"This project has source code but no CI/CD decision ledger ({ANSWERS_RELATIVE}).\n"
        "Consider setting it up now: run `npm run cicd:probe` to inspect the facts,\n"
        "or use the setup-cicd skill for the full loop "
        "(probe, decide, generate, validate, and configure the remote).\n"
        "If setup is intentionally deferred, record the decision and rationale in "
        "docs/architecture/open-decisions.md."
    )


def main() -> int:
    """Emit a reminder when all three eligibility conditions are met."""
    payload = _load_payload()
    if payload is None:
        return 0

    tool_name = payload.get("tool_name", "")
    if not isinstance(tool_name, str):
        return 0
    if tool_name not in ("Write", "Edit"):
        return 0

    root = _project_root()
    if root is None:
        return 0
    if (root / ANSWERS_RELATIVE).is_file():
        return 0
    if not _is_initialized(root):
        return 0
    if not _has_source(root):
        return 0
    if _already_reminded_today(root):
        return 0

    sys.stdout.write(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": _reminder_text(),
        }
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
