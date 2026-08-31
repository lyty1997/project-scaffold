# 并发与资源回收规范

[English](../rules/concurrency-resource-safety.md) | 中文

凡是「能脱离主控制流持续占用资源」的对象（asyncio Task / 子进程 / 线程 / 句柄），都必须有明确的生命周期归属。

## asyncio Task
- **禁止**裸 `asyncio.create_task(coro())`，必须保存引用并在 shutdown 时 cancel + gather
- 框架内统一用追踪容器：`set` + `add_done_callback(set.discard)`，或 `manager.spawn_background()`
- `task.cancel()` 后**必须** `await`（用 `with contextlib.suppress(CancelledError):` 吞预期异常），否则会 "Task was destroyed but it is pending"
- `create_task` 与「注册到追踪容器」是两步时，中间用 try/except，注册失败必须 `bg.cancel()`
- ruff `--select` 必须含 `RUF006`（asyncio-dangling-task）

## subprocess / 子进程（长生命周期）
- `Popen` / `create_subprocess_exec` 必须 `start_new_session=True`（pid==pgid，便于 killpg）
- Linux 下加 `preexec_fn` 设置 `prctl(PR_SET_PDEATHSIG, SIGKILL)`，父被 kill -9 时内核兜底
- `stdout=PIPE` / `stderr=PIPE` **必须**有协程持续 `readline()` 消费 —— 否则 64KB pipe buffer 写满，子进程的下一次 logging 阻塞在 pipe_write 整个卡死
- shutdown：先 cancel drain task → killpg → finally 里清空 task 列表与 proc 句柄

## 进程级四层兜底（长生命周期子进程必备）
1. **atexit** —— `_kill_pgid_sync(pgid, grace=3.0)`：SIGTERM → 轮询 → SIGKILL
2. **PDEATHSIG(SIGKILL)** —— `preexec_fn` 内 prctl，覆盖 kill -9 父进程
3. **SIGHUP handler** —— 同步 killpg + 转发 SIGTERM 给自己（覆盖终端关闭/SSH 断开）；只接管 SIGHUP，**不要**覆盖 uvicorn 自管的 SIGINT/SIGTERM；安装必须幂等
4. **启动时扫描** —— 遍历 `/proc` 找残留同名进程清理

pgid 用模块级 `_tracked_pgids: set[int]` 维护，`_track_pgid` / `_untrack_pgid` 幂等成对。

## 线程 / 文件 / 网络
- `threading.Thread` 长期线程必须 join；`ThreadPoolExecutor` 必须 `with` 或 `shutdown(wait=True)`
- HTTP client（httpx/openai/litellm）长生命周期实例必须 shutdown 时 `aclose()`
- WebSocket subscribe/unsubscribe 必须**幂等**（`set.discard` 而非 `remove`）
- 文件/socket/DB 必须 `with` / `async with` / try/finally

## Shell 启动脚本
- `trap cleanup EXIT INT TERM`，cleanup 函数必须有 reentrancy guard
- SIGTERM 后必须有 SIGKILL fallback（轮询若干秒未退就强杀），否则 lifespan 卡住时脚本永远不退
- 第一次 Ctrl+C 后把 trap 改为 `_force_kill`，让第二次 Ctrl+C 执行 `kill -9 $(jobs -p); exit 130`
- 用 `jobs -p` 而非 `pkill`，只杀本脚本子进程

## shutdown 顺序（FastAPI lifespan / 类似框架）
固定顺序，颠倒会导致协议错乱或状态丢失：
1. cancel 用户后台 task（warmup 等）+ await
2. `manager.shutdown()` —— cancel 所有运行中任务 + 框架后台协程
3. cancel 长循环（cleanup loop 等）+ **await**
4. 同步资源清理（临时目录等）
5. `pipeline.shutdown()` —— 释放 OCR / 子进程 / 模型
6. `db.close()`

## PR 自检清单
- [ ] 所有 `create_task` 是否保存返回值？
- [ ] 长生命周期子进程是否带 `start_new_session=True`？
- [ ] 所有 `PIPE` 是否有 drain 协程？
- [ ] shutdown 是否 cancel + **await**？
- [ ] 启动脚本是否有 SIGKILL fallback + 二次 Ctrl+C 强杀？
- [ ] HTTP client / DB 是否有 `aclose()` / `close()` 链路？

## 典型反模式
```python
asyncio.create_task(some_coro())          # 裸 fire-and-forget
task.cancel()  # 后续无 await              # CancelledError 溢出 loop
subprocess.Popen([...], stdout=PIPE)      # PIPE 无 drain → 子进程卡死
await pipeline.shutdown()                 # 顺序错：先关 pipeline
await manager.shutdown()                  # 再 cancel 任务 → worker 协议错乱
```
