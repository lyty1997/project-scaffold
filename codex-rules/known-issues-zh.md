# 已知注意事项

[English](known-issues.md) | 中文

只在任务触及相应范围时查阅。历史排查过程留在 `docs/progress-zh.md`；这里仅保留可复用结论。

| 范围 | 风险与处理 |
| --- | --- |
| 跨平台换行 | `.gitattributes` 是真相源。Shell 与 hooks 使用 LF，PowerShell 脚本使用 CRLF；不要依赖各机器的 `core.autocrlf`。 |
| Windows PowerShell 5.1 | PowerShell 5.1 可能把不带 BOM 的 UTF-8 当作旧代码页。即使当前文案已经是英文，`.ps1` 仍保持带 BOM 的 UTF-8（文件头 `ef bb bf`）和 CRLF。 |
| 双语 Agent 规则 | Claude 会自动发现 `.claude/rules/*.md`。持续维护的中文译本必须放在 `.claude/rules-zh/`，不能与英文运行时规则并排，否则每次会话可能同时加载两套等价指令。 |
| 文本扫描器 | 质量门禁会扫描脚本和文档本身。示例避免写成完整凭证或可解析的伪链接；不带引号的 secret 值必须结束于行尾或注释，避免把 `token = functionCall(...)` 误报为凭证。确认是其他误报时才使用允许标记。 |
| Git hooks | `.githooks/*` 必须在 Git 索引中为 `100755`。新增后用真实仓库验证 hook 被调用，不能只做语法检查。 |
| Archify 离线边界 | 上游模板默认请求 Google Fonts，禁网时会拖住 Chrome `loadEventFired`，打开本地图也会产生未声明第三方请求；本仓库 vendored 模板已删除远程字体，并在 Skill 中禁用自动更新检查。升级时必须重放 `.claude/skills/archify/LOCAL_CHANGES.md`。 |
| Archify 生成物 | Typed JSON 与固定渲染器生成的 HTML 可做字节新鲜度检查；Markdown PNG 必须走 Viewer 原生 canonical 导出，并校验 IHDR 尺寸等于 viewBox × 安全倍率。PNG 字节受 Chrome 和系统字体栈影响，不做跨机器比较；`visual-check` 整页截图只作临时人工复核证据。 |
| PlantUML 编译 | 显式设置 `PUML_JAR`，并在 `SECURE` profile 下编译。每个 Markdown 块拥有紧随其后的一个 SVG，但 SVG 字节受 JAR/JVM/Graphviz/字体环境影响，不能跨机器复现。门禁只要求真实编译成功与非空普通文件；本地重新生成并看图，不做字节新鲜度检查。 |
| 便携文档导出 | 便携 HTML 是 `build/portable-docs/` 下的忽略产物，不能手改或作为正文真相源。Pandoc 2.x 使用 `--self-contained`，3.x 使用 `--embed-resources`；项目包装器按版本选择并在写盘前校验原图字节和零本地资源引用，不能绕过包装器直接交付 Pandoc 输出。 |
| workflow 里的 secrets 写法 | 只有 `${{ secrets.NAME }}`（花括号内留空格、外面不加引号）能通过密钥扫描。无空格或加引号都会被判为泄漏。生成器已固化该写法，手写 workflow 时要自己守。 |
| `gh` 写入能力 | 没有 `gh ruleset create`（只有 check/list/view）。rulesets、分支保护、environments、Pages 启用一律 `gh api --input`。`gh api` 对 403/404 都 `exit 1` 且错误 JSON 走 stdout，要解析 `.status` 而非看退出码；`gh auth status` 超时时仍返回 0，不能当认证判据。 |
| 推送 workflow 文件 | token 缺 `workflow` scope 时，含 `.github/workflows/*` 改动的 push 会被 GitHub 拒绝。先 `gh auth refresh -h github.com -s workflow`（需浏览器授权）。 |
| CI 是否真绿 | `gh run watch` 退出 0 不等于通过：`startup_failure` 不进失败过滤、全 skipped、cancelled、`continue-on-error` 都能伪装成非失败。要逐 job 逐 step 断言 `conclusion == "success"`，且"按 SHA 找不到 run"判负而非放行。 |
| 生成的 workflow | 带 `managed-by` 标记的文件由 `npm run gen:cicd` 生成，手工改会被 `check:cicd` 判为漂移。要改就改 `docs/contracts/cicd-answers.json`。 |
| Release Please 文件所有权 | `release-please-config.json` 由台账确定性生成，不得手改；`.release-please-manifest.json` 只在 bootstrap 时创建，之后由 Release PR 更新，生成器只能校验 package key 与 SemVer，不能重置版本。 |
| workflow 外部语义检查 | `actionlint` 必须使用官方固定版本二进制并校验下载 SHA256；合法/非法 fixture 都要跑，避免包装脚本吞掉退出码。`zizmor` 当前默认要求包括官方 Action 在内全部钉 SHA，与项目现行策略不同，未统一策略前不要加一个 non-blocking 假门禁。 |
| CI/CD 生成物写盘 | 台账声明不等于自动取得既有文件所有权。生成器必须拒绝非 managed 同名文件、symlink、无法证明归属的 release config 与旧 managed 残留；多文件先 staging，失败恢复旧字节。manifest 状态丢失只能恢复，不能用 bootstrap 值重建。 |
| 部署演练开关 | `workflow_dispatch` 的 boolean input 在 `inputs` context 中保持布尔类型。guard 使用 `!inputs.dry_run`；不要与字符串 `"true"` 比较。`kind: deploy` 的每个 step 都必须显式标成真实发布或安全准备，避免新增未分类步骤绕过默认演练。 |

## 项目专属注意事项

按“现象 / 原因 / 修法”追加仍会影响后续任务的项目特有问题；已解决且无复用价值的过程只记入进度文档。
