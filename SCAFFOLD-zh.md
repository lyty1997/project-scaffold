# Project Scaffold

[English](SCAFFOLD.md) | 中文

本文件是脚手架自身的 README。根 [README](README-zh.md) 和 [docs/](docs/README-zh.md) 描述目标工程；脚手架设计、维护历史、样例及初始化集中在 `scaffold/`。

## 归属

```text
README.md                 目标工程占位符及明确标注的样例
SCAFFOLD.md               脚手架使用及维护入口
docs/                     目标工程设计、契约和进度
scripts/                  持续使用的工程工具
build/                    忽略的工程产物
scaffold/
  docs/                   脚手架设计、参考、图表和历史
  scripts/                初始化及框架回归检查
  examples/               CI/CD 和编译样例
  build/                  忽略的脚手架产物
```

Agent 自动发现入口、hooks、workflows、可复用规则和 Skills 保留标准位置。这些文件的存在不代表已经实现应用技术栈或业务能力。

## 初始化工程

1. 克隆或下载仓库，设置目标工程远端。
2. 运行 `npm run init`（或 `node scaffold/scripts/init.mjs`），填写确认的工程身份。初始化先验证明确的[工程文件清单](scaffold/project-files.json)，再替换身份变量。
3. 执行 `git config core.hooksPath .githooks` 启用本地门禁。
4. 按真实事实填写工程 README、设计、决策、路线图和进度；在[工程 Open Decisions](docs/architecture/open-decisions-zh.md) 中选择技术栈。
5. 运行 `npm run quality`。检查失败会使初始化以失败状态退出；提交前先修复诊断。

初始化不修改本指南及 `scaffold/` 下的文件。工程进度从空记录开始，脚手架历史位于[独立进度文件](scaffold/docs/progress-zh.md)。附带命令和参考仍依赖脚手架目录时，应保留该目录。

可选预览配置见[跨机器工作流](scaffold/docs/architecture/dev-workflow-zh.md)；CI/CD 使用已声明命令及[搭建指南](scaffold/docs/architecture/cicd-autosetup-zh.md)，延期选择记录在工程 Open Decisions。选项本身不授予远端修改权限。

## 附带工具

`npm run quality` 是仅依赖 Node.js 的基线，覆盖语法、链接/索引、语言、可携文档不变量、契约、密钥模式、静态入口及 CI/CD 安全。Hooks 和 Ubuntu/Windows CI 矩阵运行该基线。框架样例位于 `scaffold/examples/`，执行器位于 `scaffold/scripts/`。

- [质量门禁](scaffold/docs/architecture/quality-gates-zh.md)
- [Agent 提示词设计](scaffold/docs/architecture/agent-prompts-zh.md)
- [Archify 与 PlantUML](scaffold/docs/architecture/diagram-system-zh.md)
- [语言与本地化](scaffold/docs/architecture/localization-zh.md)
- [技术栈参考配方](scaffold/docs/architecture/stack-recipes/README-zh.md)

图表验证需指定本地校验和固定的 PlantUML JAR，再运行 `npm run check:diagrams`。Archify 已审阅实现继续位于 `.claude/skills/archify/`。图表工具和可选 Pandoc 不属于仅 Node 的基线。

## 导出文档

安装本地 Pandoc 2.12 或更高版本后：

```bash
npm run export:portable-docs -- scaffold/docs/sharing/ai-coding-scaffold.md
```

`docs/` 工程源导出到 `build/portable-docs/`；`scaffold/docs/` 脚手架源导出到 `scaffold/build/portable-docs/`。生成文件被忽略，不作为可编辑来源。

## 维护脚手架

从[脚手架文档索引](scaffold/docs/README-zh.md)及[归属设计](scaffold/docs/architecture/scaffold-layout-zh.md) 开始。脚手架维护更新脚手架进度，工程任务更新工程进度。脚手架不预选 React、后端、数据库或部署基础设施。

维护这些能力时，运行 `npm run quality`、`npm run check:scaffold`、`npm run check:workflows`、`npm run check:workflows:fixtures` 及适用图表检查。Workflow 检查需要质量门禁文档指定的固定版本 actionlint。
