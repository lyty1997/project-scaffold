# 已知注意事项

## 工具与验证

- UI 变更需要实际渲染验证；若当前环境无法启动浏览器或截图，应至少运行 `npm run quality` 并说明未做视觉验证。
- 质量脚本只做轻量静态检查，不能替代未来框架引入后的 lint、typecheck、test 和可访问性检查。
- **跨平台换行由 `.gitattributes` 固定，别依赖各机器的 `core.autocrlf`。** Shell 脚本与 `.githooks/pre-commit` 必须以 LF 检出，否则在 Linux/macOS 上会 `bad interpreter: /usr/bin/env bash^M` 或每行 `\r` 破坏解析；`.ps1` 检出为 CRLF。新增脚本时确认 `.gitattributes` 覆盖到对应扩展名。
- **质量门禁会扫描仓库里包括脚本自身在内的所有文本文件，写"看起来像密钥/链接"的示例要小心。** 例如注释里写完整的 `协议://用户:口令@主机` 或反引号包裹的 Markdown 链接示例可能触发 `check:secrets`/`check:docs`；用全角字符、占位描述，或对确属误报的行加 `pragma: allowlist secret`。
- **`.ps1` 脚本带中文注释时必须存成带 BOM 的 UTF-8，否则 Windows PowerShell 5.1 会解析失败。** 现象：直接执行报一堆看似不相关的语法错误（字符串缺少终止符、括号不匹配等），但用 `Read`/`cat` 看文件内容完全正常。原因：PowerShell 5.1 解析 `.ps1` 源码时，没有 BOM 就按系统 ANSI 代码页解码（中文 Windows 常见是 GB2312/GBK），把实际是 UTF-8 的中文字节序列读错，产生的乱字节又恰好破坏了词法分析。判断方法：`xxd 文件.ps1 | head -1` 看开头是不是 `ef bb bf`。修法：用 PowerShell 自己重新写盘一次，例如 `[System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($true))`（`$true` 即写 BOM），普通 `Write`/`Set-Content -Encoding utf8`（不带 BOM 的那种）不够。`scripts/dev/*.ps1` 已按此修过，新增 `.ps1` 脚本时留意。
- **`.githooks/` 下的钩子文件必须在 git 索引里带可执行位（`100755`），否则 git 会静默忽略它。** 现象：`git config core.hooksPath .githooks` 配置正确、脚本内容也没问题，但提交时钩子完全不运行，且没有报错——只有 `git commit` 输出里一行容易被忽略的提示"因为没有将钩子 '...' 设置为可执行，钩子被忽略"（`advice.ignoredHook`）。原因：`.githooks/pre-commit` 早期是用编辑器/Write 工具创建的，`git ls-files -s` 一度显示为 `100644` 而非 `100755`，git 检出到任何机器上都不会自动加可执行位。判断方法：`git ls-files -s .githooks/<钩子名>` 看模式位是否为 `100755`；也可以直接跑一次不合规的提交，观察是否真的被拦截。修法：`chmod +x .githooks/<钩子名>` 后用 `git add --chmod=+x <路径>`（而不是普通 `git add`）确保暂存区记录的模式位更新，`core.fileMode=true`（Linux/macOS 默认）时 git 会正确追踪这个变化。新增任何 `.githooks/` 脚本后，必须用真实 git 仓库端到端验证钩子确实被调用，不能只看脚本本身语法正确。
- **PlantUML 的 SVG 字节跨机器不可复现，任何"字节相等"的 SVG 新鲜度门禁都会在 CI 必红——所以本仓库不设这道门禁，只校验源码能编译。** 现象：本地 `npm run quality` 全绿、`check:diagrams`（纯编译）也过，但（曾经的）CI diagrams job 在 "Check rendered SVGs are up to date" 步骤红，报"X 个渲染产物与最新 PlantUML 源码不一致（重新编译后字节不同）"。排查历程（留作教训）：一开始以为只是版本错配（CI 锁 `1.2024.7`、开发环境用 `1.2026.1`，版本号写进 SVG 头），把 CI 对齐到 1.2026.1 后**仍红**；进一步看 SVG 内容发现文字元素是 `textLength="41.9998"` 这类值、整图 `width/height` 也按文字排版反推，这些数字来自 **JVM 的 AWT 字体度量**——我的机器和 CI runner（Temurin 21 + 不同已装字体）字体度量不同，同版本渲染字节照样不同。根因：`render-diagrams.mjs --check` 做的是纯字符串相等比较，而 PlantUML SVG 的字节依赖运行环境字体，跨机器天生对不上。叠加诱因：图表 SVG 提交后源码又改过没重新 `gen:diagrams`，SVG 相对源码本就过期。最终修法（已落地）：**删掉 `check:diagrams:fresh` 门禁与 `render-diagrams.mjs` 的 `--check` 模式**，CI 的 `diagrams` job 只跑 `check:diagrams`（编译校验，只认退出码、对版本/环境都不敏感、任何版本稳定过）；`gen:diagrams` 保留为纯本地生成器，改完 plantuml 源码本地跑一次刷新 SVG 并提交即可。教训：要给"生成产物"上门禁，先确认该产物在不同机器上是否字节可复现——PlantUML SVG 不是。

## 项目专属注意事项

（新项目在这里记录自己的坑点和已知限制，格式：现象 / 原因 / 修法）
