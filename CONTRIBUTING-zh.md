# 贡献指南

[English](CONTRIBUTING.md) | 中文

本文件汇总贡献者需要使用的入口。详细规则仍以各自指定的真相源为准，不在这里重复维护。

## 开始之前

1. 先运行一次占位符初始化：`npm run init` 或 `node scripts/init.mjs`。
2. 克隆后启用本地提交门禁：`git config core.hooksPath .githooks`。pre-commit hook 通过运行 `npm run quality` 镜像 CI。
3. 动手前先读 [docs/README-zh.md](docs/README-zh.md) 找到设计真相源，再只加载本次任务相关的 [Codex 中文规则](codex-rules/global-AGENTS-zh.md)。

## 铁律：先设计后实现

涉及定位、信息架构、内容栏目、路由、公开文案、SEO、部署、用户数据或产品服务边界的改动，必须先更新对应的[设计文档](docs/README-zh.md)。详见 [CLAUDE-zh.md](CLAUDE-zh.md) 与 [AGENTS-zh.md](AGENTS-zh.md)。

## 分支与提交

- 保持 `main` 稳定且不直接提交；`dev` 是开发主干，聚焦的特性或修复分支使用 `feature/description`、`bugfix/description`。
- 使用英文 Conventional Commit 主题：`<type>(<scope>): <English subject>`。不要添加 `Co-Authored-By` trailer。
- 完整规范见 [Git 工作流](codex-rules/rules/git-workflow-zh.md)。

## 提交前自检

- 运行 `npm run quality` 并确保通过。CI 在 Ubuntu 与 Windows 上运行同一条基础命令。
- UI 改动必须做实际渲染或截图验证；纯静态页面至少检查入口文件、资源引用和关键链接。
- 任务结束时同时更新 [docs/progress.md](docs/progress.md) 与 [docs/progress-zh.md](docs/progress-zh.md)。修复可复用 bug 后，在 [known-issues.md](codex-rules/known-issues.md) 与 [known-issues-zh.md](codex-rules/known-issues-zh.md) 中记录原因与方案。

## 尚未选定的基建

测试框架、依赖策略和锁文件策略仍未决定，见[待决策问题](docs/architecture/open-decisions-zh.md)。引入第三方框架或依赖前，先记录决策。
