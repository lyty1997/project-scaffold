# CI/CD 搭建与维护

设计真相源：[CI/CD 自动搭建](../../docs/architecture/cicd-autosetup.md)。本文只写 Agent 必须遵守的行为约束。

## 一、什么时候必须主动提出搭 CI/CD

不要等用户想起来。命中以下任一情形，先提出建议再继续手上的活：

- 项目刚定下技术栈，或第一次落地可构建的源码（`CMakeLists.txt` / `pyproject.toml` / `package.json` 有构建脚本 / `Dockerfile` 等）。
- 引入第一个第三方依赖，或第一次出现可发布的产物（二进制、wheel、镜像、静态站点）。
- 用户提到部署、发版、上线、回滚、"发给别人用"。
- 仓库已有源码但 `docs/contracts/cicd-answers.json` 不存在。

用户明确说暂时不搭时，把决定和理由写进 [待决策问题](../../docs/architecture/open-decisions.md)，不要让它悬着，也不要反复追问。

## 二、搭建必须走 `setup-cicd` skill 的闭环

禁止手写 `.github/workflows/*.yml` 交付。理由：安全骨架（最小权限、钉 SHA、secrets 写法、显式 shell、假绿防护）由渲染器固化，手写必然漏项，而漏的那项通常要等真出事才发现。

正确路径：`npm run cicd:probe` → 与用户确认探测不出来的项 → 写 `docs/contracts/cicd-answers.json` → `npm run gen:cicd` → 校验 → 实测转绿。

## 三、绝不臆测的三件事

探测器只负责给事实，下面三件必须由用户拍板：

- **构建与测试命令**：从项目已声明的脚本里读，或问用户。不得由 Agent 发明。
- **部署目标**：Pages / Cloudflare / Vercel / 容器 / 包发布 / 自建，各自的凭证与回滚方式完全不同。
- **发布节奏**：什么触发发布、要不要人工闸门。

探测不到构建系统就停下来问，不要猜——GitLab Auto DevOps 的 Auto Test 就是因为猜命令而被弃用。

## 四、远端写入前必须先体检

在写任何文件之前先跑 `npm run cicd:probe` 看阻塞项。三条已知硬约束：

- token 缺 `workflow` scope 时，推送 `.github/workflows/*` 会被 GitHub 拒绝。需要用户执行 `gh auth refresh -h github.com -s workflow`（要开浏览器授权，属于必须暂停等用户的点）。
- 免费计划下 private 仓库不支持 environments、分支保护、rulesets、Pages。不支持的项要显式说明"因套餐跳过"，不许静默不配。
- `gh` 没有 `gh ruleset create`。rulesets、分支保护、environments、Pages 启用一律走 `gh api --input`；写 secret 走 stdin 而非 `--body`，避免密钥进 shell history。

`gh api` 对 403/404 一律 `exit 1` 且错误 JSON 走 stdout，判定要解析响应体的 `.status`，不能只看退出码。也不要用 `gh auth status` 判断认证——它超时时仍返回 0。

## 五、"绿了"的判据

`gh run watch` 退出 0 不算数。必须逐 job 逐 step 断言：按 SHA 找到 run（找不到判负）、`conclusion == "success"` 且 `status == "completed"`、期望的 job 全部出现且全部成功（`skipped` / `cancelled` / `null` 一律判负）、证据 step 存在且成功。

API 调用失败是 UNKNOWN，必须重试或上报，绝不能因为拿不到数据就默认放行。不允许在 CD 红色或状态未知时汇报任务完成。

## 六、改动纪律

- 生成物带 `managed-by` 标记，不要手工编辑。要改就改台账再 `npm run gen:cicd`，否则 `npm run quality` 会报漂移。
- 台账变更、部署目标增减、回滚方式变化，都要同步更新 `docs/`。
- 每个部署目标都必须写明回滚方式；包发布本质不可回滚，就照实写"只能发新版本并 yank"，不要编造回滚能力。
