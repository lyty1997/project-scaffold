# __PROJECT_NAME__

__BRAND_NAME__ 是__PROJECT_TAGLINE__。在这里写清楚你的项目实际做什么：目标用户是谁、第一版聚焦什么、后续打算如何演进。

## 本项目的核心定位

- 核心定位：在这里概括项目要解决的问题和产品形态。
- 关键能力入口：在这里列出面向用户/团队的主要功能或页面入口。
- 后续演进方向：新能力上线前，先在 `docs/` 中完成定位、边界和信息架构设计，再落地实现。

## 工程规范入口

- Claude Code 指引：[CLAUDE.md](CLAUDE.md)
- 项目规范：[AGENTS.md](AGENTS.md)
- 文档入口：[docs/README.md](docs/README.md)
- 项目进度：[docs/progress.md](docs/progress.md)
- Codex 规则：[codex-rules/global-AGENTS.md](codex-rules/global-AGENTS.md)
- 质量门禁脚本：[scripts/quality](scripts/quality)

## 本地检查

首次使用本脚手架时，先执行一次占位符替换：

```bash
npm run init
# 或
node scripts/init.mjs
```

再运行质量门禁：

```bash
npm run quality
```

提交前门禁与 CI 一致，克隆后执行一次即可启用本地 pre-commit 钩子：

```bash
git config core.hooksPath .githooks
```

当前基础 `quality` 无需安装第三方 npm 包，使用 Node.js 内置能力检查；仓库另外 vendored 一份固定版本、MIT 许可的 Archify Skill，并通过 `.claude/skills` 与 `.agents/skills` 分别供 Claude、Codex 原生发现，用于独立图表门禁：

- 质量脚本自身语法自检（`node --check`）。
- Markdown 内部链接和 `docs/README.md` 索引完整性。
- 契约词表和禁用旧名回潮。
- 常见密钥形态。
- 静态站点入口和资源引用。
- 便携单文件文档的图片扫描、路径边界、内嵌字节与断链剥离正负 fixture。
- `npm run check:diagrams` 校验 Archify Typed JSON、交互 HTML 新鲜度和原生 PNG 尺寸；`npm run review:diagrams` 使用真实浏览器做视觉复核并调用 Viewer 原生导出刷新文档主图。

需要把带本地图的 Markdown 单独复制出去时，安装 Pandoc 2.12+ 后生成自包含 HTML；输出位于已忽略的 `build/portable-docs/`，移动一个 HTML 即可阅读：

```bash
npm run export:portable-docs -- docs/sharing/ai-coding-scaffold.md
```

## 许可证

本项目以 [Apache License 2.0](LICENSE) 授权。相比 MIT，它在保留宽松使用的同时增加了专利授权、变更声明与 `NOTICE` 传递等更明确的条款。`LICENSE` 附录里的版权年份和归属者由 `npm run init` 自动填写。
