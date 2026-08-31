# 质量门禁

状态：active

本文记录本仓库质量检查的职责与运行方式；实际命令以 `package.json` 和 `.github/workflows/ci.yml` 为准。

## 主门禁

`npm run quality` 要求 Node.js 22 及以上，首版只使用 Node.js 内置能力。CI 会在 pull request 以及推送到 `main`、`dev` 时，分别在 Ubuntu 和 Windows 运行它。

| 命令 | 职责 |
| --- | --- |
| `check:js` | 对初始化脚本、共享模块和全部质量脚本执行语法检查 |
| `check:docs` | 检查 Markdown 内部链接，并要求 `docs/README.md` 索引全部 `docs/**/*.md` |
| `check:portable-docs` | 用纯 Node 正负 fixture 检查便携文档的图片发现、路径边界、输入摘要、原字节内嵌和本地链接剥离；同时确认当前可导出的 Markdown 源合法 |
| `check:contracts` | 按 `docs/contracts/contract-rules.json` 扫描契约命名；稳定名称与枚举来自 `contract-terms.json` |
| `check:secrets` | 扫描常见密钥形态；不能替代人工审查 |
| `check:site` | 按 `docs/contracts/site-checks.json` 检查静态入口、必需片段和相对资源；入口不存在时跳过 |
| `check:cicd` | 扫描全部 workflow 的项目安全红线；存在 CI/CD 台账时检查 managed 产物完整性与漂移，并运行 release 渲染、失败边界和 manifest 生命周期夹具 |

引入框架后，应在保留上述检查的基础上增加项目实际需要的格式化、lint、typecheck、测试和可访问性检查。

## 便携单文件文档

`npm run export:portable-docs` 使用本机 Pandoc 2.12+，把所有含本地 Markdown 图片的文档导出到已忽略的 `build/portable-docs/`；在 `--` 后传路径可只导出指定文档。生成器在 Pandoc 前拒绝远程图片、路径逃逸、symlink、主动格式和空 alt，写盘前再逐张比较 `data:` 字节并拒绝任何本地资源引用。完整契约见[便携单文件文档](portable-documents.md)。

Pandoc 不进入基础门禁或 CI 依赖。`check:portable-docs` 使用临时正负 fixture 覆盖相同的不变量，因此 Ubuntu 与 Windows 的 `npm run quality` 仍只需要 Node.js 22；实际交付时还要打开生成 HTML 做桌面和移动端渲染检查。

## Archify 图表

`docs/diagrams/*.{architecture,workflow,sequence,dataflow,lifecycle}.json` 是图表真相源；同名 `.archify.html` 是交互成品，`.archify.png` 是 Viewer 原生导出的 canonical 完整图，不是整页截图。完整版本、离线边界、产物约定和视觉验收见 [Archify 图表系统](diagram-system.md)。

- `npm run check:diagrams`：先验证 `.claude/skills` 与 `.agents/skills` 的 Archify 双原生入口、Codex UI 元数据和唯一 canonical 实现，再用仓库 vendored Archify 对全部 JSON 执行 `showcase` 校验，检查离线集成边界，并确认 HTML 没有相对当前 JSON 和固定渲染器漂移。
- `npm run gen:diagrams`：原子生成或刷新全部交互 HTML。
- `npm run review:diagrams`：依赖本机 Chrome/Chromium，做四档桌面包含性检查和深浅主题临时截图，再调用 HTML Viewer 原生 PNG 导出刷新 Markdown 主图；人工查看两类图片后才可报告视觉通过。
- CI 的独立 `diagrams` job 只使用 Node.js 22 和仓库内固定 Skill，不下载 Java、JAR 或其他运行时依赖。
- HTML 可以做确定性新鲜度检查；PNG 检查原生导出尺寸与 canonical 回执边界，但受浏览器与系统字体影响，不比较跨机器字节。

## GitHub Actions 语义检查

`actionlint` 依赖外部二进制，因此不加入零第三方依赖、同时在 Ubuntu/Windows 运行的
`npm run quality`。本地安装官方二进制后运行：

```bash
ACTIONLINT_BIN=/absolute/path/actionlint npm run check:workflows
```

未设置 `ACTIONLINT_BIN` 时命令会尝试使用 `PATH` 中的 `actionlint`；找不到就失败，不会
静默跳过。包装脚本只允许追加 workflow YAML 路径，不接受 `-ignore`、`-shellcheck=`
等可改变规则面的临时选项。CI 的独立 `workflow-lint` job 只在 Ubuntu 运行一次，固定使用 actionlint
v1.7.12，并校验 Linux x86_64 归档 SHA256
`8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8`。job 还会先确认
`shellcheck` 可执行，使 actionlint 对 `run` 脚本的 ShellCheck 集成不是依赖 runner
偶然状态的隐含行为。随后运行 `check:workflows:fixtures`，持久化证明一个合法 workflow
能通过、一个带非法触发键的 workflow 会以 finding 失败，并把渲染器生成的 Release
Please workflow 与布尔 `dry_run` 部署 workflow 交给同一个真实二进制检查；fixture 位于
`scripts/quality/fixtures/actionlint/`，不会被仓库级自动发现误扫。

当前 CI 职责因此分为三组：`quality` 双 OS 矩阵、`diagrams` Archify 校验与 HTML 新鲜度检查、
`workflow-lint` GitHub Actions 语义检查。

## 本地提交

首次克隆后运行 `git config core.hooksPath .githooks`。`pre-commit` 复用 `npm run quality`，`commit-msg` 校验仓库约定的提交主题格式。
