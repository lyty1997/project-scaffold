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

引入框架后，应在保留上述检查的基础上增加项目实际需要的格式化、lint、typecheck、测试和可访问性检查。

## PlantUML

Markdown 中的 PlantUML 源码是图表真相源，渲染后的 `docs/diagrams/*.svg` 只用于不支持 PlantUML 的阅读平台。

- `PUML_JAR=/path/to/plantuml.jar npm run check:diagrams`：真实编译所有 PlantUML 代码块；有图但未设置 `PUML_JAR` 时失败，无图时跳过。
- `PUML_JAR=/path/to/plantuml.jar npm run gen:diagrams`：刷新源码块后紧跟的 SVG；这是本地生成器，不属于 `quality`。
- CI 的独立 `diagrams` job 会下载校验过 SHA256 的固定版本 JAR，只检查源码能否编译。
- 不比较 SVG 字节新鲜度：PlantUML 布局受 JVM 字体度量影响，同版本在不同机器上也可能产生不同字节。

## 本地提交

首次克隆后运行 `git config core.hooksPath .githooks`。`pre-commit` 复用 `npm run quality`，`commit-msg` 校验仓库约定的提交主题格式。
