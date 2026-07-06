#!/usr/bin/env python3
"""
PreToolUse hook：Write / Edit 工具执行前的参数校验。

校验项：
1. Write 必填参数（file_path / content）缺失 → 硬拦截
2. Edit 必填参数（file_path / old_string / new_string）缺失 → 硬拦截

注：Write 行数限制由 Claude Code 工具自身和 rules 文件约束，不在此拦截。
"""
from __future__ import annotations

import json
import sys
from json import JSONDecodeError


def _block(reason: str) -> int:
    """输出统一阻断结果。"""
    output = {"decision": "block", "reason": reason}
    sys.stdout.write(json.dumps(output, ensure_ascii=False))
    return 0


def _load_payload() -> dict[str, object] | None:
    """从 stdin 读取 payload，失败时返回阻断原因。"""
    raw = sys.stdin.read()
    if not raw.strip():
        _block("Hook 输入为空，已阻止本次写入，请重试。")
        return None

    try:
        payload = json.loads(raw)
    except JSONDecodeError:
        _block("Hook 输入不是合法 JSON，已阻止本次写入，请重试。")
        return None

    if not isinstance(payload, dict):
        _block("Hook 输入格式错误：顶层必须是 JSON 对象。")
        return None

    return payload


def validate_write(tool_input: dict[str, object]) -> str | None:
    """校验 Write 参数，返回 None 表示通过，否则返回错误原因。"""
    errors: list[str] = []

    if not tool_input.get("file_path"):
        errors.append("file_path 缺失或为空")

    if tool_input.get("content") is None:
        errors.append("content 缺失")

    if errors:
        return "Write 参数校验失败：\n- " + "\n- ".join(errors)
    return None


def validate_edit(tool_input: dict[str, object]) -> str | None:
    """校验 Edit 参数，返回 None 表示通过，否则返回错误原因。"""
    errors: list[str] = []

    file_path = tool_input.get("file_path")
    old_string = tool_input.get("old_string")
    new_string = tool_input.get("new_string")

    if not file_path:
        errors.append("file_path 缺失或为空")
    if old_string is None or old_string == "":
        errors.append("old_string 缺失或为空")
    if new_string is None:
        errors.append("new_string 缺失")

    if old_string is not None and new_string is not None and old_string == new_string:
        errors.append("old_string 与 new_string 完全相同，编辑无意义")

    if errors:
        return "Edit 参数校验失败：\n- " + "\n- ".join(errors)
    return None


def main() -> int:
    payload = _load_payload()
    if payload is None:
        return 0

    tool_name = payload.get("tool_name", "")
    tool_input = payload.get("tool_input", {})

    if not isinstance(tool_name, str):
        return _block("Hook 输入格式错误：tool_name 必须是字符串。")
    if not isinstance(tool_input, dict):
        return _block("Hook 输入格式错误：tool_input 必须是对象。")

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
