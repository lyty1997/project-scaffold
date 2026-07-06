#!/usr/bin/env python3
"""
PostToolUse hook：编辑代码文件后自动运行安全检查。
根据文件扩展名识别技术栈，运行对应的检查工具链。
"""
from __future__ import annotations

import json
import subprocess
import sys
from enum import Enum
from json import JSONDecodeError
from pathlib import Path


class CheckStatus(Enum):
    """检查结果状态。"""

    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"


class SkipReason(Enum):
    """检查跳过原因。"""

    MISSING_TOOL = "missing_tool"
    TIMEOUT = "timeout"


# 技术栈 → 检查命令映射
# 每条命令：(工具名, 命令列表, 是否必须通过)
CHECKS: dict[str, list[tuple[str, list[str], bool]]] = {
    "python": [
        ("mypy", ["mypy", "--strict", "{file}"], True),
        (
            "ruff",
            [
                "ruff", "check", "--select",
                "E,F,W,B,C4,C90,UP,T20,ARG,RET,"
                "S,ASYNC,SIM105,PT,RUF006",
                "--ignore", "RUF001,RUF002,RUF003",
                "{file}",
            ],
            True,
        ),
        ("typos", ["typos", "{file}"], True),
    ],
    "typescript": [
        ("tsc", ["npx", "tsc", "--noEmit"], True),
        ("eslint", ["npx", "eslint", "{file}"], True),
        ("typos", ["typos", "{file}"], True),
    ],
    "javascript": [
        ("eslint", ["npx", "eslint", "{file}"], True),
        ("typos", ["typos", "{file}"], True),
    ],
}

# 文件扩展名 → 技术栈
EXT_MAP: dict[str, str] = {
    ".py": "python",
    ".pyi": "python",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
}

# PLACEHOLDER_FOR_APPEND

# ESLint 配置文件可能的名称
_ESLINT_CONFIG_NAMES = (
    "eslint.config.js", "eslint.config.mjs", "eslint.config.cjs",
    "eslint.config.ts", "eslint.config.mts", "eslint.config.cts",
    ".eslintrc.js", ".eslintrc.cjs", ".eslintrc.json", ".eslintrc.yml",
)

# 期望在 ESLint 配置中出现的关键字（表明启用了 strict-type-checked）
_ESLINT_STRICT_KEYWORDS = ("strict-type-checked", "strictTypeChecked")


def _load_payload() -> dict[str, object] | None:
    """从 stdin 读取 payload，失败时返回 None。"""
    raw = sys.stdin.read()
    if not raw.strip():
        return None

    try:
        payload = json.loads(raw)
    except JSONDecodeError:
        return None

    if not isinstance(payload, dict):
        return None

    return payload


def _find_project_root(start: Path) -> Path | None:
    """从 start 向上查找包含 package.json 的目录。"""
    search_dir = start
    for _ in range(10):
        if (search_dir / "package.json").exists():
            return search_dir
        parent = search_dir.parent
        if parent == search_dir:
            return None
        search_dir = parent
    return None


def _read_eslint_config(project_root: Path) -> str | None:
    """读取 ESLint 配置内容，返回文本或 None（未找到/读取失败）。"""
    for name in _ESLINT_CONFIG_NAMES:
        config_path = project_root / name
        if config_path.exists():
            try:
                return config_path.read_text(encoding="utf-8")
            except OSError:
                return None

    # 回退：检查 package.json 中的 eslintConfig 字段
    try:
        pkg = json.loads((project_root / "package.json").read_text(encoding="utf-8"))
    except (OSError, JSONDecodeError):
        return None
    if "eslintConfig" in pkg:
        return json.dumps(pkg["eslintConfig"])
    return None


def check_eslint_config(file_path: str, stack: str) -> str | None:
    """检查项目 ESLint 配置，返回警告或 None。"""
    project_root = _find_project_root(Path(file_path).parent)
    if project_root is None:
        return None

    content = _read_eslint_config(project_root)
    if content is None:
        return "[eslint-config] 警告：未找到 ESLint 配置文件，请初始化 ESLint"

    if stack != "typescript":
        return None

    for keyword in _ESLINT_STRICT_KEYWORDS:
        if keyword in content:
            return None

    return (
        "[eslint-config] 警告：ESLint 配置中未检测到 strict-type-checked。"
        "请确保启用 @typescript-eslint/strict-type-checked 规则集"
    )


def detect_stack(file_path: str) -> str | None:
    """根据文件扩展名检测技术栈。"""
    ext = Path(file_path).suffix.lower()
    return EXT_MAP.get(ext)


def _format_skip_output(tool_name: str, reason: SkipReason) -> str:
    """格式化跳过原因，便于用户理解。"""
    if reason is SkipReason.MISSING_TOOL:
        return f"[{tool_name}] SKIPPED:\n[{tool_name}] 未安装，无法执行检查"
    return f"[{tool_name}] SKIPPED:\n[{tool_name}] 超时，未完成检查"


def run_check(
    cmd: list[str], file_path: str,
) -> tuple[CheckStatus, str, SkipReason | None]:
    """运行单个检查工具，返回 (状态, 输出摘要, 跳过原因)。"""
    resolved_cmd = [c.replace("{file}", file_path) for c in cmd]
    try:
        result = subprocess.run(  # noqa: S603 可信的内部命令调用
            resolved_cmd,
            capture_output=True,
            text=True,
            timeout=30,
        )
        output = (result.stdout + result.stderr).strip()
        if len(output) > 2000:
            output = output[:2000] + "\n... (truncated)"
        if result.returncode == 0:
            return CheckStatus.PASSED, output, None
        return CheckStatus.FAILED, output, None
    except FileNotFoundError:
        return CheckStatus.SKIPPED, "", SkipReason.MISSING_TOOL
    except subprocess.TimeoutExpired:
        return CheckStatus.SKIPPED, "", SkipReason.TIMEOUT


def _run_checks_for_stack(
    stack: str, file_path: str,
) -> tuple[bool, list[str]]:
    """运行指定技术栈的全部检查，返回 (是否有错误, 结果列表)。"""
    results: list[str] = []
    has_error = False

    config_warning = check_eslint_config(file_path, stack)
    if config_warning:
        results.append(config_warning)

    for check_name, cmd, must_pass in CHECKS.get(stack, []):
        status, output, skip_reason = run_check(cmd, file_path)
        if status is CheckStatus.PASSED:
            results.append(f"[{check_name}] OK")
            continue

        if status is CheckStatus.SKIPPED:
            if skip_reason is not None:
                results.append(_format_skip_output(check_name, skip_reason))
            else:
                results.append(f"[{check_name}] SKIPPED")
            if must_pass:
                has_error = True
            continue

        has_error = has_error or must_pass
        results.append(f"[{check_name}] FAILED:\n{output}")

    return has_error, results


def _format_output(
    stack: str, file_path: str, has_error: bool, results: list[str],
) -> str:
    """将检查结果格式化为 JSON 输出。"""
    context = f"安全检查 ({stack}) for {Path(file_path).name}:\n" + "\n".join(results)
    if has_error:
        context += "\n\n请修复以上错误后再继续。"
    return json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": context,
        }
    }, ensure_ascii=False)


def main() -> int:
    payload = _load_payload()
    if payload is None:
        return 0

    tool_name = payload.get("tool_name", "")
    tool_input = payload.get("tool_input", {})

    if not isinstance(tool_name, str) or tool_name not in ("Write", "Edit"):
        return 0
    if not isinstance(tool_input, dict):
        return 0

    file_path = tool_input.get("file_path", "")
    if not isinstance(file_path, str) or not file_path:
        return 0

    stack = detect_stack(file_path)
    if not stack:
        return 0

    has_error, results = _run_checks_for_stack(stack, file_path)
    if results:
        sys.stdout.write(_format_output(stack, file_path, has_error, results))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
