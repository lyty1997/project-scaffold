# CI/CD 搭建与维护

设计真相源：[CI/CD 自动搭建](../../docs/architecture/cicd-autosetup.md)。本文只写 Agent 必须遵守的行为约束。

## 一、什么时候必须主动提出搭 CI/CD

不要等用户想起来。命中以下任一情形，先提出建议再继续手上的活：

- 项目刚定下技术栈，或第一次落地可构建的源码（`CMakeLists.txt` / `pyproject.toml` / `package.json` 有构建脚本 / `Dockerfile` 等）。
- 引入第一个第三方依赖，或第一次出现可发布的产物（二进制、wheel、镜像、静态站点）。
- 用户提到部署、发版、上线、回滚、"发给别人用"。
- 仓库已有源码但 `docs/contracts/cicd-answers.json` 不存在。

用户明确说暂时不搭时，把决定和理由写进 [待决策问题](../../docs/architecture/open-decisions.md)，不要让它悬着，也不要反复追问。

## 二、区分框架维护与目标项目落地

维护脚手架自身的探测器、渲染器、质量脚本或基线 `.github/workflows/ci.yml` 时，先更新
[CI/CD 自动搭建设计](../../docs/architecture/cicd-autosetup.md)，再修改实现并运行
`npm run quality`、`npm run check:workflows` 与 `npm run check:workflows:fixtures`。
这类工作不要求先存在目标项目台账，
也不把面向目标仓库的 `npm run cicd:probe` 当作代码开发阻塞项。

把 CI/CD 落到使用本脚手架生成的具体项目时，必须走 `setup-cicd` skill 的闭环。

禁止手写或直接修改带 `managed-by` 标记的 workflow，以及台账驱动生成的
`release-please-config.json`。理由：安全骨架（最小权限、钉 SHA、secrets 写法、显式
shell、假绿防护）由渲染器固化；目标项目要改就改台账再生成。
`.release-please-manifest.json` 是例外：bootstrap 后由 Release PR 更新，生成器只校验、
不覆盖。
已有手写 workflow/config 不因写入台账自动变成生成器所有；同名冲突、symlink 和旧
managed 产物必须先列给使用者确认，生成器不得自行覆盖或删除。

正确路径：`npm run cicd:probe` → 与用户确认探测不出来的项 → 写
`docs/contracts/cicd-answers.json` → `npm run gen:cicd` → `npm run quality` →
`npm run check:workflows` → 实测转绿。

## 三、绝不臆测的四件事

探测器只负责给事实，下面四件必须由用户拍板：

- **构建与测试命令**：从项目已声明的脚本里读，或问用户。不得由 Agent 发明。
- **部署目标**：Pages / Cloudflare / Vercel / 容器 / 包发布 / 自建，各自的凭证与回滚方式完全不同。
- **发布节奏**：什么触发发布、要不要人工闸门。
- **Release 参数**：release type、当前版本、版本号真相源、历史起点、tag 规则和 token
  模式必须由使用者确认；脚手架的 `package.json` 不能被当成所有项目的产品版本源。
  第二增量只支持已建立版本源映射的 `node` 与 `simple`，不能把其他类型原样透传。

探测不到构建系统就停下来问，不要猜——GitLab Auto DevOps 的 Auto Test 就是因为猜命令而被弃用。

## 四、远端写入前必须先体检

把 CI/CD 落到目标项目时，在写台账或生成物之前先跑 `npm run cicd:probe` 看阻塞项。
框架维护仍按第二节豁免。三条已知硬约束：

- token 缺 `workflow` scope 时，推送 `.github/workflows/*` 会被 GitHub 拒绝。需要用户执行 `gh auth refresh -h github.com -s workflow`（要开浏览器授权，属于必须暂停等用户的点）。
- 免费计划下 private 仓库不支持 environments、分支保护、rulesets、Pages。不支持的项要显式说明"因套餐跳过"，不许静默不配。
- `gh` 没有 `gh ruleset create`。rulesets、分支保护、environments、Pages 启用一律走 `gh api --input`；写 secret 走 stdin 而非 `--body`，避免密钥进 shell history。

`gh api` 对 403/404 一律 `exit 1` 且错误 JSON 走 stdout，判定要解析响应体的 `.status`，不能只看退出码。也不要用 `gh auth status` 判断认证——它超时时仍返回 0。

## 五、"绿了"的判据

`gh run watch` 退出 0 不算数。必须逐 job 逐 step 断言：按 SHA 找到 run（找不到判负）、`conclusion == "success"` 且 `status == "completed"`、期望的 job 全部出现且全部成功（`skipped` / `cancelled` / `null` 一律判负）、证据 step 存在且成功。

API 调用失败是 UNKNOWN，必须重试或上报，绝不能因为拿不到数据就默认放行。不允许在 CD 红色或状态未知时汇报任务完成。

## 六、改动纪律

- 带 `managed-by` 标记的 workflow 与 `release-please-config.json` 不要手工编辑。要改就改
  台账再 `npm run gen:cicd`，否则 `npm run quality` 会报漂移；manifest 按上面的所有权
  边界由 Release PR 演进。
- manifest 缺失但 config 或 release workflow 已存在时属于运行状态丢失，必须恢复；
  改名/停用后的旧产物要先经使用者确认清理，不能靠生成器静默删除。
- `kind: deploy` 的每个 step 都要显式写 `deployStep: true`（真实发布）或
  `deployStep: false`（安全准备/验证）；不得靠一个受保护步骤替未分类的新发布步骤充当
  `dry_run` 哨兵。
- 台账变更、部署目标增减、回滚方式变化，都要同步更新 `docs/`。
- 每个部署目标都必须写明回滚方式；包发布本质不可回滚，就照实写"只能发新版本并 yank"，不要编造回滚能力。
