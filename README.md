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

当前首版不依赖第三方包，`quality` 使用 Node.js 内置能力检查：

- Markdown 内部链接和 `docs/README.md` 索引完整性。
- 契约词表和禁用旧名回潮。
- 常见密钥形态。
- 静态站点入口和资源引用。
