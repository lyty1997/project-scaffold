# 编码安全规范 — 技术栈自动调度

## 自动检查（hooks 层）
项目 hook `.claude/hooks/post-edit-safety.py` 在每次 Write/Edit 代码文件后自动运行：
- 根据文件扩展名识别技术栈（.py/.pyi → Python，.ts/.tsx → TypeScript，.js/.jsx → JavaScript）
- Python：自动运行 `mypy --strict` + `ruff check` + `typos`
- TypeScript：自动运行 `tsc --noEmit` + `eslint` + `typos`
- JavaScript：自动运行 `eslint` + `typos`
- 检查结果通过 additionalContext 反馈
- `must_pass=true` 的检查若失败、缺依赖或超时，会被视为错误，必须修复
- `must_pass=false` 的检查可作为警告提示，不阻断主流程

配置位置：`.claude/settings.json` → hooks.PostToolUse
克隆本仓库后无需额外配置，hook 随项目自动生效（若个人全局 `~/.claude/settings.json` 也配置了同名 hook，两者会合并运行）。

## 编码规范（rules 层）
hooks 只管自动检查，编码指南仍由 rules 文件约束：

| 技术栈 | 对应规范 |
|-------|---------|
| Python | `python-coding-rules.md` |
| TypeScript/JS | `typescript-coding-rules.md` |
| Rust | 待建 |
| Go | 待建 |
| 跨语言 — 并发/资源 | `concurrency-resource-safety.md`（asyncio task / 子进程 / pipe drain / shutdown 顺序 / shell trap） |

## 扩展新技术栈
1. 在 `.claude/hooks/post-edit-safety.py` 的 `CHECKS` 和 `EXT_MAP` 中添加新语言的检查命令
2. 在 `.claude/rules/` 中创建对应的编码规范文件
3. 更新本文件的表格
