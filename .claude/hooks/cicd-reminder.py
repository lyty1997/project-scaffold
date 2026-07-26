#!/usr/bin/env python3
"""CI/CD 搭建提醒 hook（PostToolUse）。

只在三个条件同时成立时输出一条提醒：
项目已初始化、已经长出源码、还没有 CI/CD 台账。

它永远不阻断动作。PostToolUse 只能提醒；
要阻断得用 PreToolUse 的 decision:block。

必须独立成脚本：现有 post-edit-safety.py
按扩展名分发技术栈，对 .md / .yml / .c / .cpp
一律提前返回、完全静默，扩它的 CHECKS 表覆盖不到。

去重：同一天最多提醒一次，状态写在 .cicd/ 下
（该目录已被 .gitignore 忽略）。提醒变噪音就等于没提醒。
"""

from __future__ import annotations

import json
import os
import sys
from datetime import date
from pathlib import Path

# 构建系统特征：命中任意一条即认为项目已长出实体。
BUILD_MARKERS: tuple[str, ...] = (
    "CMakeLists.txt", "Makefile", "GNUmakefile", "meson.build",
    "configure.ac", "pyproject.toml", "setup.py", "requirements.txt",
    "tsconfig.json", "Cargo.toml", "go.mod", "Dockerfile",
)
SOURCE_SUFFIXES: frozenset[str] = frozenset({
    ".c", ".h", ".cc", ".cpp", ".hpp", ".py", ".ts", ".tsx", ".rs", ".go",
})
# 脚手架自身目录不算项目源码，否则一 clone 就误报。
SCAFFOLD_DIRECTORIES: frozenset[str] = frozenset({
    ".git", ".claude", ".githooks", ".github", "codex-rules",
    "docs", "scripts", "node_modules",
})
ANSWERS_RELATIVE = "docs/contracts/cicd-answers.json"


def _load_payload() -> dict[str, object] | None:
    """读 stdin 载荷；读不到或格式不对返回 None（静默放行）。"""
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
    """定位仓库根：先用 CLAUDE_PROJECT_DIR，否则向上找 .git。"""
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
    """package.json 里不再有 __PLACEHOLDER__ 才算完成初始化。"""
    package_json = root / "package.json"
    if not package_json.is_file():
        # 纯 C/C++ 等项目没有 package.json，
        # 无法用这个信号判断，按已初始化处理。
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
    """存在构建系统标记或项目源码文件。"""
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
    """同一天只提醒一次；顺手把今天记下。"""
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
        # 写不了状态就照常提醒，只是可能重复。
        # 把原因透出，不悄悄吞掉。
        sys.stderr.write(
            f"cicd-reminder: 无法写入提醒状态（{error}）\n"
        )
    return False


def _reminder_text() -> str:
    """提醒正文。"""
    return (
        f"这个项目已经有源码，但还没有 CI/CD 台账（{ANSWERS_RELATIVE}）。\n"
        "建议现在搭：跑 `npm run cicd:probe` 看探测结果，\n"
        "或用 setup-cicd skill 走完整闭环"
        "（探测 → 拍板 → 生成 → 实测转绿 → 远端配置）。\n"
        "暂时不搭的话，把决定和理由记进 "
        "docs/architecture/open-decisions.md，别让它悬着。"
    )


def main() -> int:
    """判定三个条件，命中则输出一条提醒。"""
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
