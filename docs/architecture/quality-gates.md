# 质量门禁

状态：active

本文记录本仓库质量检查的职责与运行方式；实际命令以 `package.json` 和 `.github/workflows/ci.yml` 为准。

## 主门禁

`npm run quality` 要求 Node.js 22 及以上，首版只使用 Node.js 内置能力。CI 会在 pull request 以及推送到 `main`、`dev` 时，分别在 Ubuntu 和 Windows 运行它。

| 命令 | 职责 |
| --- | --- |
| `check:js` | 对初始化脚本、共享模块和全部质量脚本执行语法检查 |
| `check:docs` | 检查 Markdown 内部链接，并要求 `docs/README.md` 索引全部 `docs/**/*.md` |
| `check:contracts` | 按 `docs/contracts/contract-rules.json` 扫描契约命名；稳定名称与枚举来自 `contract-terms.json` |
| `check:secrets` | 扫描常见密钥形态；不能替代人工审查 |
| `check:site` | 按 `docs/contracts/site-checks.json` 检查静态入口、必需片段和相对资源；入口不存在时跳过 |
| `check:cicd` | 扫描全部 workflow 的项目安全红线；存在 CI/CD 台账时检查 managed 产物完整性与漂移，并运行 release 渲染、失败边界和 manifest 生命周期夹具 |

引入框架后，应在保留上述检查的基础上增加项目实际需要的格式化、lint、typecheck、测试和可访问性检查。

## PlantUML

Markdown 中的 PlantUML 源码是图表真相源，渲染后的 `docs/diagrams/*.svg` 只用于不支持 PlantUML 的阅读平台。

- `PUML_JAR=/path/to/plantuml.jar npm run check:diagrams`：真实编译所有 PlantUML 代码块；有图但未设置 `PUML_JAR` 时失败，无图时跳过。
- `PUML_JAR=/path/to/plantuml.jar npm run gen:diagrams`：刷新源码块后紧跟的 SVG；这是本地生成器，不属于 `quality`。
- CI 的独立 `diagrams` job 会下载校验过 SHA256 的固定版本 JAR，只检查源码能否编译。
- 不比较 SVG 字节新鲜度：PlantUML 布局受 JVM 字体度量影响，同版本在不同机器上也可能产生不同字节。

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

当前 CI 职责因此分为三组：`quality` 双 OS 矩阵、`diagrams` PlantUML 编译、
`workflow-lint` GitHub Actions 语义检查。

## 本地提交

首次克隆后运行 `git config core.hooksPath .githooks`。`pre-commit` 复用 `npm run quality`，`commit-msg` 校验仓库约定的提交主题格式。
