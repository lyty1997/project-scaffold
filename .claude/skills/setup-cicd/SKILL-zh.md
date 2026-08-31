---
name: setup-cicd
description: 按项目实际形态现场生成并落地 CI/CD（构建、部署、发版、回滚），不套预置模板。当用户要求"搭 CI/CD""配部署流水线""加发版流程""这个项目怎么上线/发布"，或 cicd-reminder hook 提示"已有源码但没有 CI/CD 台账"，或初始化后要补这一段时触发。强制"权限体检 → 探测 → 与用户拍板 → 写台账 → 生成 → 本地门禁 → 临时分支实测转绿 → 远端配置 → 回写台账"闭环；探测不出来的一律问，不猜。
---

# CI/CD 现场搭建

[English](SKILL.md) | 中文

## 触发场景

- 用户要求搭 CI/CD、配部署、加发版或回滚流程。
- `cicd-reminder` hook 提示项目已有源码但没有 `docs/contracts/cicd-answers.json`。
- `npm run init` 时选了"以后再搭"，现在要补。
- 已有 CI/CD 需要新增目标或改动流水线（同样走本闭环，改台账而不是改产物）。

## 前提

先读设计真相源 [`docs/architecture/cicd-autosetup-zh.md`](../../../docs/architecture/cicd-autosetup-zh.md) 与行为约束 [`.claude/rules/cicd-workflow-zh.md`](../../rules-zh/cicd-workflow-zh.md)。

核心前提：**这里没有"C++ 项目的现成 ci.yml"可抄**。安全骨架由 `scripts/cicd/render.mjs` 固化，工具链与命令由探测事实加用户拍板产生。你要做的是把事实问清楚、写进台账，而不是发明一份 YAML。

## 黄金工作流（绝不跳过；跳步就是把问题埋进流水线）

1. **权限体检**（必须在写任何文件之前）
   跑 `npm run cicd:probe`。它退出码非零就说明有阻塞项，先解决再往下：
   - token 缺 `workflow` scope → 让用户跑 `gh auth refresh -h github.com -s workflow`（要开浏览器授权，**停下来等用户**，不要试图绕过）。
   - 非仓库 admin → 开 Pages、建 environment、配分支保护都会失败，先说明清楚。
   - private 仓库 + 免费计划 → environments、分支保护、rulesets、Pages 均不可用，把受影响的项显式列出来说"因套餐跳过"，不要静默不配。

2. **读探测事实**
   看 `.cicd/probe.json`：构建系统标记、源码分布、静态入口、已有 workflow、远端现状。把它当事实清单，不要当结论。

3. **与用户拍板探测不出来的项**（这一步不能省）
   至少确认：构建命令、测试命令、部署目标、发布触发方式。启用 Release Please 时还要确认
   release type、当前版本、版本号真相源、需同步的版本文件、历史起点/tag 规则，以及
   `GITHUB_TOKEN` / PAT 凭证模式。GitHub App 需要额外生成短期 token，当前渲染器尚未
   支持，不能把普通 secret 模式当成 App 支持。命令要么从项目已声明的脚本里读，要么问用户，
   **不得发明**。用户此刻答不上来的，就先不生成对应 workflow，把它记进
   `docs/architecture/open-decisions.md` 与 `docs/architecture/open-decisions-zh.md`，不要为了"看起来完整"硬编一个。

   选目标时优先推荐零长期凭证的三类（GitHub Pages、GHCR、artifact attestations）——它们能真正做到全自动闭环。其余目标要提前告诉用户"信任关系必须你去对方平台配"，尤其 Cloudflare 完全没有 OIDC、连创建 API token 都没有 API。

4. **写台账 `docs/contracts/cicd-answers.json`**
   字段至少包含 `workflows`（含 `id` / `file` / `kind` / `displayName` / `on` /
   `permissions` / `jobs`）、`targets`（每个都必须有 `rollback`）、`secrets`（每个都要写
   `source`）。`kind: deploy` 的每个 step 都必须显式分类：真实发布写
   `"deployStep": true`，安全的 checkout / 构建 / 验证写 `false`；渲染器会给前者自动
   加上"PR 不发布 + 手动触发默认演练"的闸门，且至少要有一个 `true`。

   启用 Release Please 时再加 `releasePlease`：`workflowFile`、`targetBranch`、
   `credential`、受限 `config`、`initialManifest`、`versionSources`。第二增量只支持
   `node` 与语言无关的 `simple` release type；其他类型先扩版本源映射与 fixture，不能
   原样透传。`config.packages`、
   `initialManifest`、`versionSources` 的 package path 必须完全一致；每个 package 必须
   显式给出 `release-type`，`config` 必须显式给出 `include-v-in-tag` 与
   `include-component-in-tag` 两个布尔值。可选的 `bootstrap-sha` 必须是完整 40 位小写
   SHA；`skip-github-pull-request` 不是 config 字段，任何值都不得写入；
   `skip-github-release` 只能显式为 `false`。默认
   token 不需要登记 secret；选择 PAT 时只登记 secret 名与来源，不写凭证值。

   写台账前盘点同名 workflow、`release-please-config.json`、manifest 与旧 managed 产物。
   已有手写文件不会自动被接管；让使用者选择改名，或明确确认备份与迁移。改名/停用留下的
   旧 workflow/config/manifest 也不能自动删除。

5. **生成并过本地门禁**
   `npm run gen:cicd` → `npm run quality` →
   `ACTIONLINT_BIN=/absolute/path/actionlint npm run check:workflows`。渲染器会因违反不变量而
   硬失败（未钉 SHA 的第三方 action、`pull_request_target`、可能产生假绿的
   `continue-on-error`、
   错误的 secrets 写法）——**这些报错要按提示改台账，不要去改渲染器或放宽扫描器**。
   Release Please 的 config 每次确定性生成；manifest 只在完整 bundle 首次不存在时初始化。
   若 config 或 release workflow 已存在但 manifest 缺失，这是运行状态丢失，必须恢复，
   不得用 `initialManifest` 重建。所有权、symlink、旧产物或事务写盘报错都要解决根因。

6. **临时分支实测转绿**
   建 `ci-verify/<时间戳>` 分支 → push → `gh pr create --draft` 触发 `pull_request`（不要用 `gh workflow run --ref`：`workflow_dispatch` 要求文件已在默认分支，否则 404 且错误文案具误导性）→ 用 `git rev-parse HEAD` 的 SHA 精确定位 run。首次跑必须让部署步骤走演练。

7. **按真绿判据断言**（见下节）。红了就取日志定位、修台账、重新生成、再推，直到全绿。修复过程中每次提交都要用本仓库的英文提交主题格式，否则 `commit-msg` hook 会直接拒绝、循环卡死。

8. **远端配置**
   `gh secret set <NAME>` 走 stdin 不用 `--body`（避免密钥进 shell history）；Pages 用 `gh api -X POST /repos/{owner}/{repo}/pages -f build_type=workflow`（409 表示已开，是预期分支）；environments / rulesets / 分支保护一律 `gh api --input`（**没有 `gh ruleset create` 这个命令**）。每一项都记录成功或跳过原因。

9. **回写台账与文档**
   更新台账的变更记录、`docs/progress.md` 与 `docs/progress-zh.md`；涉及部署方式变化时同步 `docs/`。本地提交，**不自动 push**，是否合并问用户。

## 什么才算验证通过

用户说"看起来不错"不算，`gh run watch` 退出 0 也不算。必须同时满足：

- [ ] `npm run cicd:probe` 无阻塞项
- [ ] `npm run quality` 通过（含 `check:cicd`）
- [ ] 固定版本的 actionlint 二进制运行 `npm run check:workflows` 通过
- [ ] 按 SHA 找到了对应 run（**找不到判负，不是通过**），且 `event` 与 workflow 名对得上
- [ ] `run.conclusion == "success"` 且 `status == "completed"`
- [ ] 期望的 job 全部出现且逐个成功；出现 `skipped` / `cancelled` / `null` 一律判负
- [ ] 指定的证据 step 存在且成功（用 artifact 或日志哨兵，**不要用 `$GITHUB_STEP_SUMMARY`**）
- [ ] 台账里每个部署目标都写明了回滚方式
- [ ] 启用 Release Please 时，config/manifest/versionSources 的 package key 一致且登记路径
      存在；本地门禁确认主版本文件与当前 manifest 一致。真实 Release PR 还要逐个确认
      extra-files 被更新到同一版本。tag 或 GitHub Release 只在使用者明确授权的项目中验收
- [ ] Release Please 使用默认 `GITHUB_TOKEN` 时，机器人 PR 的待批准 workflow run 已由
      有写权限的人点击 **Approve workflows to run**，再按逐 job/step 的真绿标准验收

`gh api` / `gh run` 调用失败时最多重试 3 次并退避，严格区分“API 调用失败（UNKNOWN）”和“检查结论为失败”——拿不到数据绝不默认放行。

## 常见坑点

- **`gh api` 对 403/404 一律 `exit 1`，错误 JSON 走 stdout**：判定要解析响应体的 `.status`，不能只看退出码。也不要用 `gh auth status` 判认证——它超时时仍返回 0。
- **`GITHUB_TOKEN` 触发行为有例外但仍需人工闸门**：机器人创建或更新 PR 会产生
  approval-required 的 `pull_request` run，必须由有写权限的人批准；其他由默认 token
  产生的提交/tag 事件不会触发下游 workflow。后续要增加包发布，应与 release-please 的
  `release_created` 输出放在同一 workflow，不能靠 tag 再触发一条链。
- **secrets 写法只有一种合法形式**：`${{ secrets.NAME }}`，花括号内留空格、外面不加引号。无空格或带引号都会被本仓库密钥扫描判为泄漏，`npm run quality` 直接红。
- **不写 `shell:` 时 Linux 默认是 `bash -e`（无 pipefail）**，`false | true` 会静默通过。渲染器会自动补 `shell: bash`，不要在台账里手动去掉。
- **部署类 workflow 的 `cancel-in-progress` 必须是 false**：否则后一次运行会把正在进行的部署干成 cancelled，留下半完成状态。
- **`dry_run` 是布尔 input**：部署 guard 必须直接判断 `!inputs.dry_run`，不能与字符串
  `"true"` 比较；后者会因表达式类型转换让默认演练误执行真实部署。
- **包发布本质不可回滚**：npm / PyPI 只能发新版本加 deprecate / yank。台账里照实写，不要编造回滚能力。
- **Pages 没有原生 rollback**，只能重跑旧 commit 的部署 run；`github-pages` environment 有并发锁，卡住时需要 API force-cancel。
- **台账驱动产物不要手工编辑**：带 `managed-by` 标记的 workflow 与
  `release-please-config.json` 都由台账确定，改动会被 `check:cicd` 判为漂移。要改就改台账
  再 `npm run gen:cicd`。`.release-please-manifest.json` 是例外，bootstrap 后由 Release PR
  更新，生成器只校验、不覆盖。
- **冲突和残留不能靠生成器删除**：非 managed 同名文件、无法证明归属的 config、symlink、
  以及台账改名/停用后的旧产物都会在写盘前失败。先把精确清单给使用者确认，再迁移或删除。
