#!/usr/bin/env python3
"""Write verified gNN.puml files back to matching Markdown PlantUML blocks."""

from __future__ import annotations

import re
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: write_back.py <markdown-file> <puml-directory>", file=sys.stderr)
        return 2

    markdown_path = Path(sys.argv[1])
    source_dir = Path(sys.argv[2])
    if not markdown_path.is_file():
        print(f"ERROR: Markdown file not found: {markdown_path}", file=sys.stderr)
        return 2
    if not source_dir.is_dir():
        print(f"ERROR: source directory not found: {source_dir}", file=sys.stderr)
        return 2

    content = markdown_path.read_text(encoding="utf-8")
    pattern = re.compile(r"```plantuml\n@startuml.*?@enduml\n```", re.DOTALL)
    blocks = pattern.findall(content)
    source_files = sorted(source_dir.glob("g*.puml"))
    if len(blocks) != len(source_files):
        print(
            f"ERROR: Markdown has {len(blocks)} block(s), but {len(source_files)} source file(s) exist",
            file=sys.stderr,
        )
        return 1

    for old_block, source_path in zip(blocks, source_files):
        body = source_path.read_text(encoding="utf-8").rstrip("\n")
        content = content.replace(old_block, f"```plantuml\n{body}\n```", 1)
        print(f"replaced <- {source_path.name}")

    candidate_path = markdown_path.with_name(f".{markdown_path.name}.plantuml-write-back.tmp")
    try:
        candidate_path.write_text(content, encoding="utf-8")
        candidate_path.replace(markdown_path)
    finally:
        candidate_path.unlink(missing_ok=True)

    verified = pattern.findall(markdown_path.read_text(encoding="utf-8"))
    print(f"OK: {len(verified)} PlantUML block(s) now in {markdown_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
