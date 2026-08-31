#!/usr/bin/env python3
"""Validate Write and Edit arguments in a PreToolUse hook.

Missing required Write arguments (file_path/content) and Edit arguments
(file_path/old_string/new_string) block the operation. Claude Code itself and
the project rules enforce Write size limits, so this hook does not duplicate
that validation.
"""
from __future__ import annotations

import json
import sys
from json import JSONDecodeError


def _block(reason: str) -> int:
    """Emit a standard blocking response."""
    output = {"decision": "block", "reason": reason}
    sys.stdout.write(json.dumps(output, ensure_ascii=False))
    return 0


def _load_payload() -> dict[str, object] | None:
    """Read the stdin payload and emit a blocking reason on failure."""
    raw = sys.stdin.read()
    if not raw.strip():
        _block("The hook input is empty. The write was blocked; retry with a valid payload.")
        return None

    try:
        payload = json.loads(raw)
    except JSONDecodeError:
        _block("The hook input is not valid JSON. The write was blocked; retry with a valid payload.")
        return None

    if not isinstance(payload, dict):
        _block("Invalid hook input: the top-level value must be a JSON object.")
        return None

    return payload


def validate_write(tool_input: dict[str, object]) -> str | None:
    """Validate Write arguments, returning None or a failure reason."""
    errors: list[str] = []

    if not tool_input.get("file_path"):
        errors.append("file_path is missing or empty")

    if tool_input.get("content") is None:
        errors.append("content is missing")

    if errors:
        return "Write argument validation failed:\n- " + "\n- ".join(errors)
    return None


def validate_edit(tool_input: dict[str, object]) -> str | None:
    """Validate Edit arguments, returning None or a failure reason."""
    errors: list[str] = []

    file_path = tool_input.get("file_path")
    old_string = tool_input.get("old_string")
    new_string = tool_input.get("new_string")

    if not file_path:
        errors.append("file_path is missing or empty")
    if old_string is None or old_string == "":
        errors.append("old_string is missing or empty")
    if new_string is None:
        errors.append("new_string is missing")

    if old_string is not None and new_string is not None and old_string == new_string:
        errors.append("old_string and new_string are identical, so the edit has no effect")

    if errors:
        return "Edit argument validation failed:\n- " + "\n- ".join(errors)
    return None


def main() -> int:
    payload = _load_payload()
    if payload is None:
        return 0

    tool_name = payload.get("tool_name", "")
    tool_input = payload.get("tool_input", {})

    if not isinstance(tool_name, str):
        return _block("Invalid hook input: tool_name must be a string.")
    if not isinstance(tool_input, dict):
        return _block("Invalid hook input: tool_input must be an object.")

    if tool_name == "Write":
        reason = validate_write(tool_input)
    elif tool_name == "Edit":
        reason = validate_edit(tool_input)
    else:
        return 0

    if reason:
        return _block(reason)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
