# 待决策问题

[English](open-decisions.md) | 中文

状态：active
最近更新：__PROJECT_NAME__ 起步阶段

本文件集中记录 __PROJECT_NAME__（__PROJECT_SLUG__）还未拍板的技术和产品决策，避免决策散落在代码或聊天记录里。决策一旦确定，应把结论迁移到对应的正式设计文档，并从本文件删除。

## 技术选型

- 前端框架选型：React、Vue、Next.js、SvelteKit 或其他方案，需结合团队熟悉度和渲染需求（SSR/SSG/CSR）确定。
- 后端框架与语言选型：例如 Node.js（Express/Nest）、Python（FastAPI/Django）、Go、Java 等，需结合团队能力和性能要求确定。
- 数据库选型：关系型（PostgreSQL/MySQL）、文档型（MongoDB）或其他，以及是否需要缓存层（Redis 等）。
- 认证方案：自建账号体系、第三方登录（OAuth）、还是托管认证服务（如 Auth0/Clerk 等），需明确会话管理和权限模型。
- 部署目标：Vercel、自建服务器、云厂商（AWS/GCP/Azure 等）或其他 PaaS，需结合成本和运维能力确定。
- 是否需要跨机协同预览工作流（多台开发机之间同步代码并提供可访问的预览环境）。

## 内容与产品

- 第一批内容/功能模块的范围、优先级和信息架构。
- 产品服务入口何时上线，以及是否在首屏展示。
- 是否提供讨论、评论或反馈表单等用户交互能力。

## 工程基建

- Release 自动化的项目级决策：启用 release-please 前，必须确认发布包路径、`release-type`、
  当前版本、是否需要及具体 `bootstrap-sha`、版本号真相源及需同步的版本文件、tag 规则；脚手架不得把自身
  `package.json` 预设为所有下游项目的产品版本源。
- Release Please 凭证模式：当前生成器支持默认 `GITHUB_TOKEN`（零新增长期凭证，但
  机器人 PR 的 CI 需要有写权限的人手工批准，其他后续 workflow 不会自动触发）或
  fine-grained PAT（可自动触发，但属于长期 secret，需轮换）。GitHub App installation
  token 更适合短期凭证，但需要另行设计 App 参数和 token 生成步骤，当前尚未支持。必须
  在具体项目启用 Release 前由使用者确认；使用 PAT 时只记录 secret 名与来源，不写凭证值。
- Breaking change 的提交表达：扩展提交钩子以允许 `feat(scope)!:` / `fix(scope)!:`，
  或维持当前主题格式并要求在正文写 `BREAKING CHANGE:`。该选择会同时影响本地钩子、
  Release Please 版本计算和贡献文档，确认前不修改提交约定。
- 测试框架与范围：确定技术栈后选定测试运行器（如 `node --test`、Vitest、Pytest 等），把占位的 `npm test` 换成真实命令，并考虑是否新增 `check:test` 门禁纳入 `npm run quality`。
- 依赖与锁文件策略：引入第一个第三方依赖时，约定锁文件（`package-lock.json` 等）是否入库、CI 是否改用 `npm ci` 保证可复现构建；在此之前保持零依赖。
- CI job 拆分时机：一旦引入数据库等需要外部服务的依赖，`.github/workflows/ci.yml` 应把现有单一 `quality` job 拆成"无外部依赖的快 job"（继续跑 `npm run quality`）和"起 docker/服务容器的慢 job"（跑迁移、集成测试），两者独立失败、互不拖慢；后者建议验证"迁移可回滚再重新迁移"的闭环（up → down → up），而不是只跑一遍 migrate 就算过。
- 数据库迁移引入后，若同时维护"迁移顺序设计文档台账"，考虑加一道机器校验：以实际迁移文件名为真相源，扫描核对台账文档是否同步，避免人工登记的编号和文件系统漂移。参考实现见 [迁移一致性门禁参考脚本](stack-recipes/migration-ledger-check-zh.md)（按需启用，不强制）。

## 隐私与运营

- 是否引入访问分析；如引入，需要确定供应商、数据保留周期和隐私声明。
- 是否收集用户数据（账号信息、邮箱等）；如收集，需要确定字段、用途、存储和删除方式。
