# __PROJECT_NAME__ 文档入口

[English](README.md) | 中文

本文档目录是项目定位、架构、内容模型、产品服务演进和质量门禁的真相源。涉及公开页面结构、内容栏目、产品服务、用户数据、部署和 CI 的改动，先更新这里对应文档，再进入实现。

## 文档索引

- [项目进度](progress-zh.md)
- [技术分享：AI 编码脚手架——从一次对话到可复用的工程闭环](sharing/ai-coding-scaffold-zh.md)
- [架构概览](architecture/overview-zh.md)
- [质量门禁](architecture/quality-gates-zh.md)
- [Agent 提示词设计与精简评估](architecture/agent-prompts-zh.md)
- [图表系统：Archify + PlantUML](architecture/diagram-system-zh.md)
- [便携单文件文档](architecture/portable-documents-zh.md)
- [语言与本地化](architecture/localization-zh.md)
- [术语表](architecture/glossary-zh.md)
- [待决策问题](architecture/open-decisions-zh.md)
- [跨机协同开发预览工作流](architecture/dev-workflow-zh.md)
- [CI/CD 自动搭建](architecture/cicd-autosetup-zh.md)
- [并行项目规则同步台账](architecture/sibling-repo-sync-zh.md)（仓库所有者私人笔记，非通用脚手架内容）
- [内容与产品路线](product/content-roadmap-zh.md)
- [契约词表](contracts/contract-terms.json)
- [契约扫描规则](contracts/contract-rules.json)
- [站点检查规则](contracts/site-checks.json)
- [Archify 固定版本契约](contracts/archify.json)
- [技术栈参考配方](architecture/stack-recipes/README-zh.md)：[Python](architecture/stack-recipes/python-zh.md)、[TypeScript](architecture/stack-recipes/typescript-zh.md)、[迁移一致性门禁](architecture/stack-recipes/migration-ledger-check-zh.md)

## 按问题找文档

| 我想知道... | 去哪份文档 |
| --- | --- |
| 这个项目现在处于什么阶段、这一版做什么/不做什么 | 本文件“当前阶段”一节 |
| 系统整体结构、目录职责、模块怎么划分 | [架构概览](architecture/overview-zh.md) |
| 某个名词/缩写具体指什么 | [术语表](architecture/glossary-zh.md) |
| 还没拍板的技术/产品决策有哪些 | [待决策问题](architecture/open-decisions-zh.md) |
| 内容栏目、产品服务的规划和边界 | [内容与产品路线](product/content-roadmap-zh.md) |
| 本地开发怎么跨机预览、怎么同步 | [跨机协同开发预览工作流](architecture/dev-workflow-zh.md) |
| 品牌名/状态枚举等契约词从哪来、怎么改 | [契约词表](contracts/contract-terms.json)、[契约扫描规则](contracts/contract-rules.json) |
| `npm run quality`、图表检查和本地钩子具体做什么 | [质量门禁](architecture/quality-gates-zh.md) |
| 怎样选择 Archify 或 PlantUML，并验证各自的产物 | [图表系统：Archify + PlantUML](architecture/diagram-system-zh.md) |
| 怎样把带本地插图的 Markdown 导出成可单独移动的一个文件 | [便携单文件文档](architecture/portable-documents-zh.md) |
| CI/CD 如何探测、生成、校验和按项目接入发版 | [CI/CD 自动搭建](architecture/cicd-autosetup-zh.md) |
| Agent 执行任务时该遵守什么操作规范 | 根目录 [AGENTS.md](../AGENTS.md) 与 [Codex 规则索引](../codex-rules/global-AGENTS.md) |

## 当前阶段

- 阶段：__在这里写你当前所处的阶段__。
- 范围：__在这里写清楚这一版做什么__。
- 非目标：__在这里写清楚明确不做什么__。

## 文档维护要求

- 新增 `docs/` 下的 Markdown 文件后，必须加入本目录对应语言的索引。
- 修改路由、导航、内容栏目、产品服务或部署方式时，同步更新相关设计文档。
- 不确定事项写入 [待决策问题](architecture/open-decisions-zh.md)，不要散落在代码注释里。
