# CI/CD 自动搭建

状态：draft（等待仓库所有者确认后才进入实现）
最近更新：2026-07-26

本文定义脚手架如何在绿地项目起步时**主动提醒该搭 CI/CD**，并在获得授权后**按项目实际形态自动搭完**。
本文是设计真相源；实际命令与 job 行为以 `package.json` 和 `.github/workflows/` 为准。

## 一、要解决的问题

脚手架当前只有 CI（`quality` 双 OS 矩阵 + `diagrams`），CD 一行没有：没有部署、发版、回滚 workflow，没有 secrets 与环境约定，`npm test` 仍是占位。部署目标在[待决策问题](open-decisions.md)里是未定项。

要补齐的是三件事，缺一不可：

1. **会提醒**：绿地项目长出源码时，机制主动提示"该搭 CI/CD 了"，而不是等人想起来。
2. **能搭完**：获得授权后自动完成搭建，包含远端 GitHub 设置写入。
3. **适配任意栈**：使用者的技术栈跨 gcc / C / C++ / Python / TypeScript / HTML，目标跨 Pages / Cloudflare / Vercel / 容器 / 包发布 / 自建，且未来还会增加。

CD 深度按已确认的范围：**部署流水线 + Release 自动化 + 回滚机制**。不做 staging/production 环境分层。

## 二、核心判断

### 2.1 不建模板库，但也不能纯靠现场即兴

需求原话是"按需适配对应的项目，而不是在这里建现成的"。把一份 CI/CD 配置拆开看，里面其实是两类完全不同的内容：

| 类别 | 例子 | 是否随技术栈变化 |
| --- | --- | --- |
| 结构与安全骨架 | `permissions` 最小化、第三方 action 钉 40 位 SHA、`concurrency` 分组、secrets 引用写法、每个 `run` 步骤显式 `shell:`、禁 `pull_request_target`、假绿防护 | **否** —— 与语言、目标无关 |
| 工具链与命令 | 装 gcc 还是 clang、跑 `cmake --build` 还是 `pytest`、发到 GHCR 还是 PyPI、矩阵开几档 | **是** —— 每个项目都不同 |

于是分工确定：

- **骨架代码化**：由渲染器固化，一次写对，之后每个项目都自动正确，不依赖 Agent 临场记得。
- **工具链与命令现场产生**：由探测器给事实、使用者拍板决策，写进台账，**不以任何形式预置成品 workflow**。

这既不是"技术栈 × 部署目标"的模板库（仓库里不会出现任何一份 `cpp-ci.yml` 成品），也不是纯靠模型即兴写 YAML（语法、权限、SHA 钉法由渲染器保证）。加一个新技术栈不需要往仓库加文件，只需要探测器认得它的特征。

### 2.2 真相源是 JSON，YAML 只是产物

实测 Node v22.22.0 无内置 YAML 解析器（`node:yaml` → `ERR_UNKNOWN_BUILTIN_MODULE`），而 `npm run quality` 承诺零第三方依赖。结论：生成器**只写不读 YAML**——决策存成 JSON 台账，YAML 由渲染器单向产出。

这与仓库既有范式同构：PlantUML 源码是真相源、SVG 是产物；`contract-terms.json` 是真相源、扫描只做校验。

顺带白送一个能力：漂移检测可以做成"重新渲染 + 字节比对"。这与被废弃的 `check:diagrams:fresh` 不同——YAML 序列化不依赖 JVM 字体度量，同一份 JSON 在任何机器上必然产出同样字节，跨机器稳定。

### 2.3 只自己写三块，其余全部复用

调研（含实测）后确认该自己写的只有**探测器、台账、渲染器**，其余一律复用现成方案：

| 能力 | 采用 | 理由 |
| --- | --- | --- |
| Release 自动化 | `googleapis/release-please-action` | 语言无关（18 种 strategy，`simple` 适配 C/C++），以 Action 运行，目标仓库零 npm 依赖，且是"先开 Release PR 待人合并"模式，天然保留人工闸门 |
| workflow 正确性校验 | `actionlint` 二进制 | 26 类检查：表达式类型、runner label、`needs` 环、`permissions` 取值、`run` 脚本过 shellcheck。照抄现有 `diagrams` job 的"固定版本 + SHA256 + 环境变量指路径 + 不进 quality"范式 |
| 构建/发布原语 | `aminya/setup-cpp`、`pypa/cibuildwheel`、`actions/deploy-pages`、`docker/build-push-action`、`wrangler` 等 | 官方 building block，不自研构建脚本 |

明确**不引入**并记录理由，避免以后重复调研：

- **projen**：最接近的先例，但是"先声明再合成 + anti-tamper 强制不可手改"，与本脚手架"探测现状后生成、产物可被继续演进"方向相反；且 15 个直接依赖 + jsii，C/C++ 完全不在其覆盖内。只借鉴它的 managed-file 标记与漂移检测方法论。
- **semantic-release / changesets**：Node 生态深度绑定，非 JS 语言是二等公民。
- **goreleaser / cargo-dist**：分别只服务 Go / Rust。cargo-dist 的"生成 YAML 提交进仓库"工作模式值得照抄。
- **Dagger / Earthly**：Earthly Cloud 已于 2025-07-16 停服；Dagger 无 SaaS 缓存时构建慢到不值得，且对文档型脚手架数量级过重。
- **act**：只支持 linux runner，直接毁掉本仓库 ubuntu+windows 双矩阵的验证价值；官方 `not_supported` 明确不支持 OIDC 与 `job.environment`，意味着**所有 deploy job 在 act 下必然失败**。只能在文档里作为可选 debug 工具提及。
- **npm 上的 `actionlint` 包**：非官方野包（发布者非 rhysd，最后发布 2022-12-07）。只走官方二进制。

### 2.4 探测只用来选工具链，不用来猜命令

GitLab Auto DevOps 的教训：它的 Auto Test 功能因为"猜不准项目的测试命令"最终被弃用。

落到本设计：探测器输出的是**事实清单**（存在 `CMakeLists.txt` / `pyproject.toml` 有 `[project.scripts]` / `package.json` 有 `build` 脚本 / 有 `Dockerfile` / 有 `public/index.html`），构建与测试的具体命令**必须由使用者确认，或从项目已声明的脚本里读取，不得由生成器发明**。探不出来就停下来问，不猜。

## 三、总体架构

数据流严格单向，每一步都有可核验产物：

```plantuml
@startuml
title CI/CD 自动搭建的单向数据流

start

partition "探测" {
  :读本地信号\nCMakeLists.txt, pyproject.toml, package.json, Dockerfile 等;
  :读远端只读信号\n可见性, 套餐, Pages, environments, secrets;
  :权限体检\n从 X-Oauth-Scopes 响应头读 token scope;
}

if (preflight 通过?) then (是)
else (缺 workflow scope 或非 admin)
  :停下来引导人工授权;
  stop
endif

partition "决策" {
  :展示事实清单;
  :就探测不出来的项询问使用者\n构建命令, 测试命令, 部署目标;
  :写入台账 cicd-answers.json;
}

partition "生成" {
  :渲染器读台账;
  :按设计不变量装配结构化对象;
  :序列化为 workflow YAML\n头部写 managed 标记与台账 hash;
}

partition "校验" {
  fork
    :零依赖门禁\n随 quality 一起跑;
  fork again
    :actionlint\n独立 job, 依赖外部二进制;
  fork again
    :临时分支加 draft PR 真机实测\n部署步骤 dry_run 为 true;
  end fork
  :逐 job 逐 step 断言真绿;
}

if (真绿?) then (是)
else (否)
  :取失败日志定位并修正后重来;
  stop
endif

partition "落地" {
  :远端 apply\n写 secrets, 开 Pages, 建 environment;
  :回写台账与进度文档;
  :本地提交, 不自动 push;
}

stop
@enduml
```

![CI/CD 自动搭建的单向数据流](../diagrams/cicd-autosetup-flow.svg)

## 四、组件职责

### 4.1 探测器 `scripts/cicd/probe.mjs`

纯 Node、零依赖、**只读**。输出事实，不做任何决策。

**本地信号**：`CMakeLists.txt`、`Makefile`、`meson.build`、`configure.ac`、`pyproject.toml`（及其中的 `[project.scripts]` / `[build-system]`）、`setup.py`、`package.json`（及其 `scripts` 键集合）、`tsconfig.json`、`Cargo.toml`、`go.mod`、`Dockerfile`、`public/index.html`、`index.html`、源文件扩展名分布。

**远端信号**（`gh`，全部只读，仅需 `repo` scope，8 个端点已实测可用）：`repos/{o}/{r}`（`visibility` / `private` / `owner.type` / `permissions.admin` / `has_pages` / `default_branch`）、`/pages`、`/environments`、`/rulesets`、`/branches/{b}/protection`、`/actions/secrets`、`/actions/variables`、`/actions/permissions/workflow`。

**权限体检**：从 `gh api -i rate_limit` 的 `X-Oauth-Scopes` 响应头读 token scope。**不得用 `gh auth status` 判断**——本机实测它在超时报错时仍然 `exit 0`，是不可靠的判据。

产物写 `.cicd/probe.json`（加入 `.gitignore`，不入库，因为它是环境快照不是决策）。

### 4.2 台账 `docs/contracts/cicd-answers.json`

**入库的真相源**。字段：生成器版本、探测事实快照、使用者拍板的部署目标、构建与测试命令、要生成的 workflow 清单、secrets 清单与来源、每个目标的回滚方式、变更记录。

放 `docs/contracts/` 与既有契约文件同列。`check:docs` 只要求 `docs/**/*.md` 进索引，JSON 不受该门禁约束，但仍会被契约扫描与密钥扫描覆盖。

这个文件同时是**零维护成本的沉淀**：下次开同类项目可以拿另一个项目的台账当起点，不需要维护一个会腐烂的"积木库"。

### 4.3 渲染器 `scripts/cicd/render.mjs`

台账 JSON → workflow YAML。内部持有结构化 JS 对象（job / step 的 AST），末端用自写的**受限 YAML 序列化器**输出——只需覆盖 map / seq / string / number / bool / 块标量 `|`，约 100 行纯 Node。输出集合完全可控，因此**不需要解析器**。

生成物头部写 managed 标记注释 + 台账内容 hash，供漂移检测使用。

命令入口 `npm run gen:cicd`，与既有 `gen:diagrams`（本地生成器）对齐。

### 4.4 门禁 `scripts/quality/check-cicd.mjs`

零依赖，**进 `npm run quality`**。行为照抄既有先例：

- 台账不存在 → `exit 0` 跳过（同 `check-static-site.mjs` 的"配置不存在就跳过"）。
- 台账存在 → 校验：声明的每个目标都有对应 workflow 文件；文件头 hash 与台账当前 hash 一致（漂移检测）；secrets 清单齐备；每个目标都声明了回滚方式。
- 纯正则静态断言（不需要 YAML 解析）：无 `continue-on-error: true`、无 `pull_request_target`、每个 `run` 步骤都有显式 `shell:`、secrets 引用符合书写约定。

`actionlint` 因依赖外部二进制，走独立的 `npm run check:workflows` + 独立 CI job，**不进 `quality`**。

### 4.5 提醒三层

| 层 | 位置 | 判定条件 | 表现 |
| --- | --- | --- | --- |
| 初始化出口 | `scripts/init.mjs` | 照抄行 141-154"跨机协同预览工作流"的可选章节范式，新增一段询问 | 选了就直接进搭建流程；不选则往[待决策问题](open-decisions.md)的"部署目标"条目挂待办，并在"后续步骤"里打印 `npm run setup:cicd` |
| Agent 规则 | `.claude/rules/cicd-workflow.md` + `codex-rules/rules/cicd-workflow.md` | 技术选型落地、引入首个依赖、新增部署相关改动时 | 约束 Agent 主动提出搭建，并规定"推送后必须观察 CD run 转绿"扩展条款 |
| 确定性钩子 | `.claude/hooks/cicd-reminder.py`（新增独立 hook） | ①仓库无残留占位符（已初始化）②台账不存在 ③已出现源码信号 | PostToolUse 输出 `additionalContext` 提醒，**不阻断**；用标记文件去重，避免每次编辑都吵 |

第三层必须新写独立 hook：现有 `post-edit-safety.py` 对 `.md` / `.yml` / `.c` / `.cpp` 一律在 `detect_stack` 处提前返回、完全静默，扩它的 `CHECKS` 表无法覆盖。

### 4.6 执行体 `.claude/skills/setup-cicd/SKILL.md`

形状照抄既有的 `sync-shared-rules`（读台账 → 逐目标实际探查 → 按各自机制适配 → 实测校验 → 写回并本地提交 → 更新台账），它已经是本仓库验证过的"探查 + 现场适配"范式。

SKILL.md 结尾必须写明**什么才算验证通过**（照抄 `plantuml-in-markdown` 的"用户只说看起来不错不算通过"），以及可勾选的收工清单。

## 五、端到端流程

**第 0 步 preflight 必须最先跑，且在写任何文件之前**——否则会生成一堆文件后卡在推不上去。

| 步 | 动作 | 失败处理 |
| --- | --- | --- |
| 0 | 权限体检：token scope 是否含 `workflow`；`permissions.admin` 是否为真；仓库 `visibility` 与套餐 | 缺 `workflow` scope 则停下来引导 `gh auth refresh -h github.com -s workflow`（需人工授权，属于必须暂停的点） |
| 1 | 跑探测器，输出事实清单并展示给使用者 | 探测不到构建系统就停下来问，不猜 |
| 2 | 就"探测不出来的事"逐项确认：构建命令、测试命令、部署目标、发布节奏 | 使用者答不上来的项先不生成对应 workflow，记进[待决策问题](open-decisions.md) |
| 3 | 写台账 | —— |
| 4 | 渲染 workflow | —— |
| 5 | 本地校验：`npm run quality` + `npm run check:workflows` | 红了就修，不许跳过 |
| 6 | 临时分支 + draft PR 触发真机实测，部署步骤走 `dry_run=true` | —— |
| 7 | 按"真绿判据"逐 job 逐 step 断言 | 失败则取日志定位 → 修 → 再推，直到转绿 |
| 8 | 远端 apply：`gh secret set` / 开 Pages / 建 environment | 逐项记录成功与跳过原因 |
| 9 | 回写台账、更新 `docs/progress.md`、本地提交（不自动 push） | —— |

第 6 步用 draft PR 而不是 `gh workflow run --ref`：**`workflow_dispatch` 要求 workflow 文件已存在于默认分支**，否则 API 返回 404 且错误文案具有误导性。而本仓库 `ci.yml` 已有裸 `pull_request:` 触发，任意分支开 PR 都会命中。实测确认 `pull_request` 事件 run 的 `headSha` 就是分支 head commit，`gh run list -c <SHA>` 可无歧义定位。

## 六、设计不变量（渲染器固化，不依赖临场记忆）

| 不变量 | 原因 |
| --- | --- |
| secrets 引用一律写成 `${{ secrets.NAME }}`（花括号内留空格、外面不加引号） | **已实测**：`${{secrets.X}}`（无空格）与 `"${{ secrets.X }}"`（带引号）都会被本仓库 `check-secrets.mjs` 判为密钥泄漏，`npm run quality` 直接红。修生成器而不是放宽扫描器——放宽会削弱真实防护 |
| 每个 `run` 步骤显式写 `shell:` | 不写时 Linux 默认是 `bash -e`（**无 pipefail**），`false \| true` 会静默通过；显式 `shell: bash` 才是 `bash -eo pipefail` |
| 非 `actions/` 组织的 action 一律钉 40 位 SHA | 供应链风险；这也是 GitHub `starter-workflows` 贡献规范的明文要求 |
| 每个 workflow 自带最小 `permissions:` 块 | 根级只读权限不会被继承到需要写的 job；显式声明任一项后，未声明项自动为 `none` |
| 禁止 `pull_request_target` | 它在 fork PR 上下文里能拿到仓库 secrets，是已知的凭证窃取入口 |
| 禁止 `continue-on-error: true` | 会让 job 失败而 run 结论仍是 success，制造假绿 |
| 部署类 workflow 带 `dry_run` 输入（默认 true）gate 住真实发布步骤 | 首次验证零副作用；同时白送"手动重跑即回滚入口"和"演练开关"两个能力 |
| 用 artifact 或日志哨兵留证据，**不用** `$GITHUB_STEP_SUMMARY` | act 会直接丢弃它，且 API 不直接暴露 summary |

## 七、自动化边界：能全自动到哪里

已授权全自动远端写入，但"全自动"有真实上限，必须诚实分档而不是假装都能做。

**能做到零长期凭证、一条命令闭环的只有三类**（GitHub 自家目标，OIDC 原生）：

| 目标 | 所需 permissions | 人工活 |
| --- | --- | --- |
| GitHub Pages | `pages: write` + `id-token: write` + `github-pages` environment | 无（Pages 开启由本地 `gh api` 一次性完成） |
| GHCR / GitHub Packages | `packages: write` + `contents: read` | 无（用默认 `GITHUB_TOKEN`） |
| artifact attestations | `id-token: write` + `attestations: write` | 无（public 仓库；private 需 Enterprise Cloud） |

**其余目标只能"生成 workflow + 生成引导清单"**，因为信任关系必须由人去对方平台配：

| 目标 | gh 能做的 | gh 碰不到、必须人工的 |
| --- | --- | --- |
| npm | 写 secret | Trusted Publishing 的 org/repo/workflow/environment 绑定要在 npm 网页配 |
| PyPI | 写 secret | Trusted Publisher 要在 PyPI 网页配 |
| Cloudflare | 写 secret | **完全没有 OIDC**，且连"创建 API token"都没有 API，只能人工在面板生成 |
| Vercel | 写 secret | OIDC 是出站方向，入站部署仍需项目 token |
| 云厂商（AWS/GCP/Azure） | 写 secret | OIDC 信任关系要在对方 IAM 配 |

**三条会直接改变可配项的硬约束**，探测阶段必须先查、不满足就显式输出"因套餐/可见性/权限跳过"而不是静默不配：

1. 本机 token scope 实测为 `gist, read:org, repo`，**缺 `workflow`**——写完 `.github/workflows/*` 后 push 会被 GitHub 直接拒绝。
2. 免费计划下 **private 仓库不支持** environments / 分支保护 / rulesets / Pages。
3. `gh` **没有 `gh ruleset create`**（实测本机只有 `check` / `list` / `view`）——rulesets、classic 分支保护、environments、Pages 启用一律走 `gh api --input`，且写 secret 必须走 stdin 而非 `--body`，避免密钥进 shell history。

另有两个易踩的行为差异：`gh api` 对 403/404 一律 `exit 1` 且错误 JSON 走 stdout，判定必须解析响应体的 `.status` 而非退出码；`GITHUB_TOKEN` 推的提交与 tag **不会触发下游 workflow**，所以"CI 自动打 tag → tag 触发发布"这条链用默认 token 会静默断掉。

## 八、"真绿"判据

`gh run watch` 退出 0 **不等于**真绿。已确认的假绿通道有六条：默认 shell 无 pipefail、`startup_failure` 不进 `-s failure` 过滤、路径过滤导致压根没触发（"查不到 run"被当成没失败）、`continue-on-error`、全部 job skipped、`concurrency` 把验证 run 干成 cancelled。

判定写成确定性断言：

1. 按 SHA 找到 run，且 `event` / `workflowName` 对得上——**找不到判负，不是通过**。
2. `run.conclusion == "success"` 且 `status == "completed"`。
3. 期望的 job 名集合全部出现，逐个 `conclusion == "success"`；出现 `skipped` / `cancelled` / `null` 一律判负。
4. 指定的证据 step 存在且成功。
5. artifact 证据存在，或日志哨兵命中。

所有 `gh api` / `gh run` 调用包 3 次重试 + 指数退避，并**严格区分"API 调用失败(UNKNOWN)"与"检查结论为失败"**——拿不到数据绝不默认放行。这一条直接对应既有规则"不允许在 CI 红色或状态未知时汇报任务完成"。

## 九、回滚：按目标分档，且不承诺做不到的事

不自研回滚机制，全部用 `gh` 与各平台原生原语：

| 目标 | 回滚方式 | 限制 |
| --- | --- | --- |
| GitHub Pages | 重跑旧 commit 的部署 run | 无原生 rollback；`github-pages` environment 有并发锁，卡死需 API force-cancel |
| Cloudflare | `wrangler rollback` | 可回滚版本窗口 100，是硬上限 |
| 容器 | 按 immutable digest 重新部署 | —— |
| GitHub Release | `gh release edit --latest` 指回旧版 | —— |
| **npm / PyPI 包发布** | **本质不可回滚** | 只能发新版本 + `deprecate` / `yank`，必须在文档里写清楚，不能承诺"全目标可回滚" |

## 十、工程量判断与增量拆分

**判定：整体偏大，拆成两个增量后第一增量为"刚刚好"。**

理由：使用者是单人开发者，不是平台工程组。完整方案里有几项属于"听起来专业但一年用不到三次"，已主动砍掉：

- **砍掉"积木库 + 验证后自增长"**：单人项目触发频次低，积木库会迅速腐烂成无人维护的垃圾场。台账文件本身已经提供了零维护成本的沉淀能力。
- **砍掉 staging/production 环境分层与审批门**：已确认不在范围内。
- **`zizmor` 深度安全审计降为可选**：它主要防"人手改 workflow 后引入的问题"，而渲染器根本不生成 `pull_request_target`、SHA 钉法也是固化的，第一增量的收益有限。

拆分：

**第一增量（先做，可独立验收）**
探测器 + 台账 + 渲染器 + `check:cicd` + 三层提醒 + `setup-cicd` skill + `init.mjs` 改动 + 本文档与规则文件。
验收标准：在一个真实绿地项目上跑通"提醒 → 探测 → 拍板 → 生成 → 本地门禁绿 → 临时分支实测转绿 → 远端 apply"，并留下输入输出证据。

**第二增量（第一增量落地并用过至少一个真实项目后再评估）**
`actionlint` 独立 job + `npm run check:workflows`；按需加 `zizmor`。

## 十一、需要拍板的未定项

1. **台账放 `docs/contracts/cicd-answers.json` 还是 `.github/cicd-answers.json`**：前者与既有契约文件同列、更符合"docs 是真相源"；后者离产物更近。倾向前者。
2. **第一增量是否包含 Release 自动化**：`release-please` 引入成本低，但它会往仓库加 `release-please-config.json` 与 `.release-please-manifest.json`，且需要决定版本号真相源（C/C++ 用 `version.txt` + `extra-files` 注解同步 `CMakeLists.txt`）。可以放第二增量。
3. **`gh auth refresh -s workflow` 的时机**：它需要开浏览器人工授权。是在 `npm run init` 时就提示，还是留到 `setup-cicd` 的 preflight 才提示。倾向后者，避免打断初始化。

