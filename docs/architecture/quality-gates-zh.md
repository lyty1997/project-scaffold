# 质量门禁

[English](quality-gates.md) | 中文

状态：active

本文定义仓库检查及其运行方式；实际行为仍以 `package.json` 和 `.github/workflows/ci.yml` 为真相源。

## 基础门禁

`npm run quality` 要求 Node.js 22 或更高版本，只使用 Node.js 内置能力。CI 会在 pull request 及推送到 `main`、`dev` 时分别在 Ubuntu 与 Windows 运行。

| 命令 | 职责 |
| --- | --- |
| `check:js` | 对初始化器、共享模块和质量脚本执行语法检查 |
| `check:docs` | 检查 Markdown 链接、双语配对和语言索引 |
| `check:localization` | 检查默认英文表面不得出现未放行 Han 字符；校验项目文档（`README`、`SCAFFOLD` 和 `docs/`）成对互链；拒绝仅维护英文的指令出现中文副本；功能性中文只能通过显式 marker 或契约字段放行 |
| `check:portable-docs` | 验证本地图发现、路径边界、输入摘要、原字节内嵌和本地链接剥离 |
| `check:contracts` | 按 `docs/contracts/contract-rules.json` 与 `contract-terms.json` 扫描命名契约 |
| `check:secrets` | 检测常见凭证形态，不能代替人工审查 |
| `check:site` | 检查配置的静态入口、必需片段与相对资源 |
| `check:cicd` | 强制 workflow 安全边界，并校验 managed CI/CD 产物、release fixture 和 manifest 生命周期 |

确定应用技术栈后，在保留本基线的前提下增加真实需要的 format、lint、typecheck、测试、可访问性及其他专项检查。

## 便携单文件文档

`npm run export:portable-docs` 使用本机 Pandoc 2.12+，把含本地栅格图的 Markdown 导出到已忽略的 `build/portable-docs/`。包装器在 Pandoc 前拒绝远程图片、路径逃逸、symlink、主动格式和空 alt，原子交付前逐张核对内嵌字节并拒绝残留本地资源链接。

Pandoc 不进入基础 CI 依赖；`check:portable-docs` 用纯 Node 正负 fixture 覆盖同一组不变量。实际交付仍须检查桌面和移动端浏览器渲染。详见[便携单文件文档](portable-documents-zh.md)。

## 图表门禁

[图表系统](diagram-system-zh.md)为每张图规定唯一真相源与验收闭环。

### Archify

- `npm run check:archify` 校验 Claude/Codex Skill 集成和 vendored 摘要，逐份执行 showcase 9/9，检查离线边界、HTML 确定性新鲜度和原生 PNG 尺寸。
- `npm run gen:archify` 原子刷新交互 HTML。
- `npm run review:archify -- <source>` 依赖 Chrome/Chromium，测量四档桌面、抓取临时深浅主题证据并刷新 Viewer 原生 canonical PNG。
- HTML 可做确定性新鲜度检查；PNG 不跨机器比较字节，但校验 canonical 导出回执与预期尺寸。

### PlantUML

- Markdown 围栏块是可编辑真相源；紧随其后的本地 SVG 是供 GitHub 阅读的生成产物。
- `npm run check:plantuml` 要求 `PUML_JAR`，在 PlantUML `SECURE` profile 下编译所有块，禁止 include/import，并校验每个提交 SVG 是非空普通文件。
- `npm run gen:plantuml` 安全编译所有块并原子刷新引用的 SVG。
- JAR、JVM、Graphviz 和字体度量会影响输出，因此不跨机器比较 SVG 字节；真实编译成功与非空产物才是稳定门禁。

`npm run check:diagrams` 聚合两套检查，`npm run gen:diagrams` 刷新两类产物。PlantUML 和 Chrome 视觉复核不进入纯 Node 的 `npm run quality`。CI 的独立 Linux `diagrams` job 安装 Java、校验固定 SHA-256 后下载 PlantUML 1.2026.1，并与 vendored Archify 一起运行聚合门禁。

## GitHub Actions 语义检查

`actionlint` 是外部二进制，不进入零依赖的 Ubuntu/Windows `quality` 矩阵。安装官方二进制后运行：

```bash
ACTIONLINT_BIN=/absolute/path/actionlint npm run check:workflows
```

未设置 `ACTIONLINT_BIN` 时，包装器尝试从 `PATH` 查找，找不到就失败；只允许传 workflow 路径，不接受临时 ignore 或 shell-check 绕过参数。

CI 的 Linux `workflow-lint` job 会确认 ShellCheck，下载并校验 actionlint v1.7.12 的 SHA-256 `8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8`，检查仓库 workflow，并运行包含 Release Please 与 boolean `dry_run` 部署 workflow 的持久化正负 fixture。

CI 因此分为三组：跨平台 `quality` 矩阵、Linux `diagrams`（Archify + PlantUML）以及 Linux `workflow-lint`。

## 本地提交

克隆后运行 `git config core.hooksPath .githooks`。pre-commit 复用 `npm run quality`，commit-msg 校验仓库主题格式。
