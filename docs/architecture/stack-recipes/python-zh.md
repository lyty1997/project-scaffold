# Python 技术栈参考配方

[English](python.md) | 中文

可选，仅在 [待决策问题](../open-decisions-zh.md) 确定后端语言选 Python 后才需要落地。规则依据见 [`.claude/rules/python-coding-rules.md`](../../../.claude/rules-zh/python-coding-rules-zh.md)。

## `pyproject.toml`：ruff + mypy + pytest

```toml
[tool.ruff]
target-version = "py312"
line-length = 100

[tool.ruff.lint]
# B=bugbear, C4=comprehensions, C90=mccabe 复杂度, UP=pyupgrade, T20=print,
# ARG=未使用参数, RET=return 一致性, S=bandit 安全检查, ASYNC=异步误用,
# SIM105=用 contextlib.suppress 替代空 try/except, PT=pytest 风格,
# RUF006=asyncio 裸 create_task（配合并发安全规则）。
select = ["E", "F", "W", "B", "C4", "C90", "UP", "T20", "ARG", "RET", "S", "ASYNC", "SIM105", "PT", "RUF006"]
ignore = [
  "RUF001", "RUF002", "RUF003", # 中文全角标点误报
]

[tool.ruff.lint.per-file-ignores]
"tests/**" = ["S101", "ARG001", "ARG002"] # 测试里允许裸 assert、未用的 fixture 形参
"scripts/**" = ["T201", "E501"]           # 工具脚本允许 print 和稍长的行

[tool.mypy]
strict = true
explicit_package_bases = true

# 无类型桩的三方库集中在这里登记 override，禁止散落 `# type: ignore`。
[[tool.mypy.overrides]]
module = ["some_untyped_lib.*"]
ignore_missing_imports = true

[tool.pytest.ini_options]
addopts = "--strict-config --strict-markers"
asyncio_mode = "auto"
filterwarnings = [
  # 只精确屏蔽已知的第三方噪音，不要用一条通配符静默所有 warning。
  "ignore:some known third-party DeprecationWarning:DeprecationWarning",
]

[tool.coverage.report]
fail_under = 80
exclude_also = ["if TYPE_CHECKING:", "if __name__ == .__main__.:", "\\.\\.\\."]
```

## `.pre-commit-config.yaml`：本地质量门禁

```yaml
repos:
  - repo: local
    hooks:
      - id: mypy-strict
        name: mypy --strict
        entry: mypy --strict
        language: system
        files: '\.py$'
        pass_filenames: true
      - id: ruff-check
        name: ruff check
        entry: ruff check
        language: system
        files: '\.py$'
      - id: typos
        name: typos
        entry: typos
        language: system
```

要点：pre-commit 跑在隔离环境时，如果 hook 依赖第三方插件（例如 `mypy` 的 `pydantic.mypy` 插件），必须在对应 hook 的 `additional_dependencies` 里显式声明，否则会在隔离 venv 里因为缺依赖而报 `ImportError`——这个坑很容易在本地手跑正常、CI/pre-commit 隔离环境里才炸。

## 依赖锁定（pip-tools）

不用 poetry/uv 时，`requirements.txt`（运行时）+ `requirements-dev.txt`（开发依赖，`-r requirements.txt` 引用）+ 锁定结果：

```bash
python -m piptools compile requirements-dev.txt \
  --output-file requirements-dev.lock.txt \
  --no-emit-index-url --no-emit-trusted-host
```

CI 和本地安装都装 `requirements-dev.lock.txt`；改了任意一份 `requirements*.txt` 后必须重新生成 lock 文件并一起提交，不能只改源文件不重新编译。

## `_typos.toml`：标识符拼写检查白名单骨架

```toml
[default.extend-identifiers]
# 项目里合法但会被 typos 误判的标识符，加到这里。

[default.extend-words]
# 合法但常被拼写检查误判的单词。
```

只维护骨架，具体条目按你项目实际遇到的误报逐条添加，不要提前预置一堆用不上的例外。
