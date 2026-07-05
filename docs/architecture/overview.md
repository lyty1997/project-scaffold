# 架构概览

状态：__在这里写当前状态，例如 active__
最近更新：__在这里写最近一次更新日期，例如 2026-07-03__
适用范围：__在这里写这份文档的适用范围，例如"M0 全栈项目脚手架与工程规范"__

## 目标

__PROJECT_NAME__ 的首版目标是建立一个可维护的 __PROJECT_TAGLINE__，并提前保留向后续能力演进的结构空间。

## 当前实现

以下是占位示例，请替换成你项目的实际架构：

```mermaid
flowchart TD
  User[访问者] --> Frontend[前端应用]
  Frontend --> Backend[后端 / API]
  Backend --> Storage[数据存储]
  Docs[docs 真相源] --> Frontend
  Docs --> Backend
  Quality[quality 门禁] --> Docs
  Quality --> Frontend
  Quality --> Backend
```

请根据实际情况补充说明当前是否有运行时后端、数据库、登录、评论系统或用户数据采集等能力，以及各能力所处的阶段。

## 目录职责

以下为全栈项目常见目录示例，仅供参考，请根据你的实际目录结构调整这一节：

- `frontend/` 或 `apps/web/`：前端应用入口和资源。
- `backend/` 或 `apps/api/`：后端服务与 API 实现。
- `docs/`：定位、架构、内容模型、产品服务演进和契约词表的真相源。
- `codex-rules/`：Agent 执行任务时的操作规范。
- `scripts/quality/`：CI 和本地质量门禁。
- `.github/`：PR 模板、CODEOWNERS 和 CI。

## 演进原则

- 引入框架前先明确框架解决的问题，例如内容规模、路由、构建、SEO、MDX、搜索或部署需求。
- 引入用户交互前先明确隐私边界、滥用风险、数据保留和删除策略。
- 产品服务上线前先明确服务边界，不用营销文案替代真实能力说明。
