# Git 工作流
## 分支
- `main`：稳定发布，不直接提交
- `dev`：开发主干
- `feature/s{N}-{描述}` / `bugfix/{描述}` / `release/{版本}`

## 提交格式
```
<type>(<scope>): <English 主题> / <中文主题>
```
主题行中英双语、英文在前，用 ` / ` 分隔英文与中文两段（例：`feat(scaffold): add stack recipe / 新增技术栈配方`）。
type: `feat|fix|docs|style|refactor|test|chore`  scope 按项目模块自定（本仓库当前常用 `scaffold`），`.githooks/commit-msg` 强制"有 scope + 英文段在前 + ` / ` 分隔 + 后段非空"，不校验 scope 枚举
- 不要带上"Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

## 提交前
- 运行风格检查和测试，确保无敏感信息
- 本仓库已用 `.githooks/commit-msg` 把提交格式变成机器强制（`git config core.hooksPath .githooks` 后生效），不合规格式会被直接拒绝

## push / merge 后 — 必须观察 CI
- push 到 `main`/`dev`，或合并 PR 后，必须主动观察 `.github/workflows/ci.yml` 的运行结果，不能推完/合完就视为任务结束
- 有 PR 时用 `gh pr checks <PR号> --watch` 跟踪；直接 push 到分支时用 `gh run watch`（或先 `gh run list --branch <分支名>` 找到对应 run 再 `gh run watch <run-id>`）
- CI 未通过（`quality` matrix 任一 OS 失败、或 `diagrams` job 失败）：定位失败原因 → 本地修复并重跑 `npm run quality`（涉及图表改动再跑 `npm run check:diagrams`，并用 `npm run review:diagrams -- <source-file>` 完成真实浏览器复核）→ 重新推送 → 再次观察，直到全部转绿
- 不允许在 CI 红色或状态未知的情况下汇报任务完成
