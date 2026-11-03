# __PROJECT_NAME__

[English](README.md) | 中文

__BRAND_NAME__ 是__PROJECT_TAGLINE__。请在这里准确说明项目实际做什么、服务谁、第一版聚焦什么，以及后续版本可能如何演进。

## 项目核心定位

- 核心定位：在这里概括项目要解决的问题和产品形态。
- 关键能力入口：在这里列出面向用户或团队的主要功能、页面入口。
- 后续演进方向：新能力上线前，先在 `docs/` 中完成定位、边界和信息架构设计，再落地实现。

## 工程文档入口

项目说明和设计文档保留持续维护的中文译本；Agent 规则、Skills 和贡献协作流程仅维护英文，详见[语言与本地化](docs/architecture/localization-zh.md)。

- Claude Code 指引：[CLAUDE.md](CLAUDE.md)
- 项目规范：[AGENTS.md](AGENTS.md)
- 文档入口：[docs/README-zh.md](docs/README-zh.md)
- 项目进度：[docs/progress-zh.md](docs/progress-zh.md)
- Codex 规则：[codex-rules/global-AGENTS.md](codex-rules/global-AGENTS.md)
- 质量门禁脚本：[scripts/quality](scripts/quality)

## 本地检查

首次使用本脚手架创建新项目时，先执行占位符替换：

```bash
npm run init
# 或
node scripts/init.mjs
```

再运行质量门禁：

```bash
npm run quality
```

本地 pre-commit 门禁与 CI 一致。克隆后执行一次即可启用仓库 hooks：

```bash
git config core.hooksPath .githooks
```

基础 `quality` 命令只使用 Node.js 内置能力，无需安装第三方 npm 包。图表采用 Archify 与 PlantUML 互补工作流：仓库 vendored 经过审查的 Archify 实现与 PlantUML 创作 Skill；CI 只在独立图表 job 中下载并校验固定 PlantUML JAR。

- 使用 `node --check` 做 JavaScript 语法检查。
- 检查 Markdown 内部链接、双语文档配对，以及 `docs/README.md` / `docs/README-zh.md` 的索引完整性。
- 检查契约词表和禁用旧名回潮。
- 检查常见密钥形态。
- 检查静态站点入口和资源引用。
- 通过正负 fixture 检查便携单文件文档的图片发现、路径边界、内嵌字节完整性和本地断链剥离。
- `npm run check:archify` 校验 Archify Typed JSON、HTML 新鲜度和原生 PNG 边界；`npm run review:archify` 负责真实浏览器视觉复核。
- `npm run check:plantuml` 安全编译 Markdown 内联 PlantUML 并检查生成 SVG；`npm run check:diagrams` 聚合两套工具。

PlantUML 命令需要本地 JAR；Archify 仍保持自包含：

```bash
export PUML_JAR=/absolute/path/to/plantuml-1.2026.1.jar
npm run check:diagrams
```

选型规则与产物契约见[图表系统：Archify + PlantUML](docs/architecture/diagram-system-zh.md)。

需要把带本地图的 Markdown 单独移出仓库时，安装 Pandoc 2.12 或更高版本后生成自包含 HTML。输出位于已忽略的 `build/portable-docs/`，移动一个 HTML 即可交付：

```bash
npm run export:portable-docs -- docs/sharing/ai-coding-scaffold.md
```

## 许可证

本项目以 [Apache License 2.0](LICENSE) 授权。相比 MIT，它仍保持宽松使用，同时增加明确的专利授权、变更声明和更清晰的 notice 保留条款。`npm run init` 会填写许可证附录中的版权年份与归属者。
