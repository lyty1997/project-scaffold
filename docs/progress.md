# 项目进度

本文件是 __PROJECT_NAME__ 的项目进度真相源，按时间倒序记录每次任务的完成内容与遗留项。每次任务结束或中断时更新。

条目格式：`时间戳 / 主题 / 完成内容 / 遗留项`。

下面按新任务倒序追加条目。

## 2026-07-05 / 脚手架自审与修复

- 完成：多智能体审查后修复一批问题——新增 `.gitattributes` 统一换行（修复 `pre-commit`/`sync.sh` 在 Linux 上因 CRLF 触发 `bad interpreter`）；密钥扫描覆盖 `.sh`/`.ps1`/`.py`/无扩展名文件并增强正则（不带引号赋值、URL 内嵌凭证、`client_secret` 等）；契约匹配改用 Unicode 词边界并对错误正则容错；Markdown 门禁跳过围栏/行内代码、索引改按链接目标判定；`check:js` 覆盖 `init.mjs` 与 `lib/files.mjs`；`LICENSE` 参数化，`init` 自动填年份/归属者并支持重跑只补预览；去除 CI 与内容规则中的原项目身份泄漏，CI 增加 `dev` 分支与 Windows 矩阵；`preview.sh` 防止误接管抢占端口的外来进程；`restart-remote.ps1` 消费 `REMOTE_USER`/`SSH_KEY_NAME` 并做分支/路径注入校验；新增 `CONTRIBUTING.md` 与占位 `public/index.html`。
- 遗留：CODEOWNERS owner 真实性无法离线校验（依赖 GitHub 设置）；测试框架与依赖/锁文件策略待技术选型后落地，见 [待决策问题](architecture/open-decisions.md)。
