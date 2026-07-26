# 已知注意事项

只在任务触及相应范围时查阅。历史排查过程留在 `docs/progress.md`；这里仅保留可复用结论。

| 范围 | 风险与处理 |
| --- | --- |
| 跨平台换行 | `.gitattributes` 是真相源。Shell 与 hooks 使用 LF，PowerShell 脚本使用 CRLF；不要依赖各机器的 `core.autocrlf`。 |
| Windows PowerShell 5.1 | 含中文的 `.ps1` 必须保存为带 BOM 的 UTF-8，否则可能出现伪语法错误；文件头应为 `ef bb bf`。 |
| 文本扫描器 | 质量门禁会扫描脚本和文档本身。示例避免写成完整凭证或可解析的伪链接；确认是误报时才使用允许标记。 |
| Git hooks | `.githooks/*` 必须在 Git 索引中为 `100755`。新增后用真实仓库验证 hook 被调用，不能只做语法检查。 |
| PlantUML SVG | SVG 字节受 JVM 字体度量影响，不能做跨机器字节一致性门禁。只编译校验源码；改图后本地运行 `gen:diagrams` 刷新展示产物。 |
| workflow 里的 secrets 写法 | 只有 `${{ secrets.NAME }}`（花括号内留空格、外面不加引号）能通过密钥扫描。无空格或加引号都会被判为泄漏。生成器已固化该写法，手写 workflow 时要自己守。 |
| `gh` 写入能力 | 没有 `gh ruleset create`（只有 check/list/view）。rulesets、分支保护、environments、Pages 启用一律 `gh api --input`。`gh api` 对 403/404 都 `exit 1` 且错误 JSON 走 stdout，要解析 `.status` 而非看退出码；`gh auth status` 超时时仍返回 0，不能当认证判据。 |
| 推送 workflow 文件 | token 缺 `workflow` scope 时，含 `.github/workflows/*` 改动的 push 会被 GitHub 拒绝。先 `gh auth refresh -h github.com -s workflow`（需浏览器授权）。 |
| CI 是否真绿 | `gh run watch` 退出 0 不等于通过：`startup_failure` 不进失败过滤、全 skipped、cancelled、`continue-on-error` 都能伪装成非失败。要逐 job 逐 step 断言 `conclusion == "success"`，且"按 SHA 找不到 run"判负而非放行。 |
| 生成的 workflow | 带 `managed-by` 标记的文件由 `npm run gen:cicd` 生成，手工改会被 `check:cicd` 判为漂移。要改就改 `docs/contracts/cicd-answers.json`。 |

## 项目专属注意事项

按“现象 / 原因 / 修法”追加仍会影响后续任务的项目特有问题；已解决且无复用价值的过程只记入进度文档。
