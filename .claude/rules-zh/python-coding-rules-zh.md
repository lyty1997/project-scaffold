# Python 代码质量与安全规范

[English](../rules/python-coding-rules.md) | 中文

### 一、类型安全

#### 静态检查（编码期）
- `mypy --strict` 作为主要类型检查器（由 hook 自动执行）
- 项目可选配合 pyright IDE 集成（`pyproject.toml` 中配置 strict 模式）
- 所有函数签名必须有完整类型注解（参数 + 返回值），无例外
- 禁止使用 `Any` 除非有注释说明原因
- 泛型容器必须标注元素类型：`list[str]` 而非 `list`
- 用注释或 docstring 说明函数的非显然契约；不添加只是复述代码的注释

#### 运行时校验（系统边界）
- 外部输入（API 请求、用户输入、配置文件、文件解析结果）必须用 pydantic BaseModel 校验
- 性能敏感的内部路径用 `beartype` 装饰器做 O(1) 类型断言
- 禁止用 `isinstance` 手写校验链代替结构化校验

### 二、资源安全（防泄漏）
- 文件、数据库连接、网络会话、锁 —— 必须用 `with` 语句或 `contextlib.closing`
- 自定义资源类必须实现 `__enter__` / `__exit__`（或继承 `contextlib.AbstractContextManager`）
- 临时文件必须用 `tempfile` 模块，禁止手动 open + 手动 delete
- ruff 启用规则：`SIM105`、`ASYNC`、`S`、`PT`
- pylint 启用：`consider-using-with`

### 三、并发安全

#### async 代码
- async 函数内禁止直接调用阻塞 IO（文件读写、`requests`、`time.sleep`）
- 必须用 `asyncio.to_thread()` 包裹阻塞调用，或使用原生 async 库（`aiohttp`、`aiofiles`）
- 开发模式下启用事件循环 debug：`loop.set_debug(True)` + `slow_callback_duration = 0.1`

#### 多线程代码
- 共享可变状态必须用 `threading.Lock` / `Queue` 保护，禁止裸写共享变量
- 推荐使用 `Guarded[T]` 模式封装共享数据，强制通过上下文管理器访问
- 避免嵌套锁，如必须则统一锁获取顺序防死锁

### 四、安全漏洞防护
- 禁止拼接 SQL，必须用参数化查询
- 禁止 `eval()` / `exec()`，除非有安全沙箱且注释说明
- 子进程调用禁止 `shell=True`，用列表形式传参
- 日志/输出禁止打印密钥、token、密码等敏感信息

### 五、测试规范
- 框架：`pytest` + `pytest-asyncio`（异步代码必须用 asyncio 模式）
- 覆盖率：新功能必须有单元测试，核心模块 ≥ 80%
- 位置：`tests/` 目录，结构与 `src/` 一致，文件名 `test_` 开头
- 集成测试：外部服务（Docker/Git/Redis）用 Docker 容器隔离
- Tester 角色：自动生成测试用例，沙箱运行，结果反馈给 Reviewer

### 六、自动检查（三层防线）

#### 第一层：PostToolUse hook（Claude 编辑时实时触发）
- 项目 hook `.claude/hooks/post-edit-safety.py`，每次 Write/Edit 自动运行：
  - `mypy --strict` — 类型检查
  - `ruff check` — B(bugbear),C4,C90,UP,T20,ARG,RET,S,ASYNC,SIM105,PT
  - `typos` — 标识符拼写检查（支持下划线/驼峰拆分）
- 检测到错误时反馈 additionalContext，必须修复后再继续

#### 第二层：pre-commit（git 提交时兜底）
- `.pre-commit-config.yaml` 配置同样的 mypy + ruff + typos 检查
- 覆盖用户手动编辑的代码，提交前必须通过

#### 第三层：提交前手动检查
- `bandit -r src/` — 深度安全扫描
- `pytest --tb=short` — 全量测试
