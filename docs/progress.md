# 项目进度

本文件是 __PROJECT_NAME__ 的项目进度真相源，按时间倒序记录每次任务的完成内容与遗留项。每次任务结束或中断时更新。

条目格式：`时间戳 / 主题 / 完成内容 / 遗留项`。

下面按新任务倒序追加条目。

## 2026-07-06 / PlantUML 渲染产物自动生成 + 新鲜度门禁

- 完成：补上上一条遗留的自动化缺口——新增 `scripts/quality/lib/plantuml.mjs`（提取 plantuml 块 + 关联紧跟其后的 `![](path.svg)` 图片引用 + 编译，供多个脚本共用）；`scripts/quality/render-diagrams.mjs` 提供 `npm run gen:diagrams`（编译并覆盖写入图片引用指向的 SVG，改完图源码跑一次即可，不用再手工 `java -jar`）与 `npm run check:diagrams:fresh`（`--check` 只读模式，按字节比较已提交 SVG 和重新编译结果，不一致就报出具体文件并提示跑 `gen:diagrams`）；`check-diagrams.mjs` 同步改为复用共享提取/编译逻辑，行为不变（只认编译退出码，不比较字节，避免跨 PlantUML 版本误报）；`.github/workflows/ci.yml` 的 `diagrams` job 新增一步用锁定版本 jar 跑 `check:diagrams:fresh`；用 CI 锁定的 1.2024.7 版本重新生成了 `docs/diagrams/architecture-overview.svg`、`docs/diagrams/dev-workflow-loop.svg`（此前是用个人机器上的 1.2026.1 生成的，版本号会写进 SVG 头，两版本字节不同，已用锁定版本重新渲染避免新增的 fresh 门禁一上线就报旧文件过期）；本地分别用两个 PlantUML 版本验证过 `check:diagrams`（版本无关，稳定通过）和 `check:diagrams:fresh`（锁定版本下通过）；`.claude/rules/markdown-diagrams.md`、`codex-rules/rules/markdown-docs.md`、`CLAUDE.md` 同步更新说明。
- 遗留：无新增遗留项；`.claude/rules/` 与 `codex-rules/rules/` 同主题内容不完全一致的分层问题仍维持原状，未在本次改动范围内处理。

## 2026-07-06 / 图表工具统一为 PlantUML + CI 编译门禁

- 完成：解决上一条遗留的 Mermaid/PlantUML 冲突——用户明确选择全面用 PlantUML；`codex-rules/rules/markdown-docs.md` 图表章节改为强制 PlantUML（禁用 Mermaid/ASCII art/截图/二进制贴图），并指向 `.claude/rules/markdown-diagrams.md` 细则；`docs/architecture/overview.md` 里的示例架构图从 Mermaid flowchart 改画成 PlantUML 组件图；新增 `scripts/quality/check-diagrams.mjs`（独立于 `npm run quality` 之外，扫描全仓库 Markdown 里的 ` ```plantuml ` 块并用 `java -jar $PUML_JAR` 真实编译，零图表时跳过，有图表但未设 `PUML_JAR` 时报错而非静默跳过）；`.github/workflows/ci.yml` 新增独立 `diagrams` job（仅 ubuntu-latest），下载并校验 SHA256 的 PlantUML 官方 release jar（1.2024.7）后跑 `check:diagrams`；`docs/architecture/overview.md`、`docs/architecture/dev-workflow.md` 的图表都补了渲染好的 `docs/diagrams/*.svg` 引用，本地已用两个 PlantUML 版本（个人 1.2026.1、CI 锁定的 1.2024.7）分别验证两张图都编译通过；`npm run quality` + `check:diagrams` 全量通过。
- 遗留：`check:diagrams` 只保证语法编译通过，不校验 `docs/diagrams/` 下的渲染图片是否与最新源码同步，改图后仍需人工重新渲染并提交对应 SVG，尚无自动化兜底；`.claude/rules/` 与 `codex-rules/rules/` 同主题内容不完全一致（如 tool-failure、git-workflow）的分层遗留问题维持原状，未在本次改动范围内处理。

## 2026-07-06 / 引入 .claude/ 项目级配置（rules/skills/hooks）

- 完成：将用户个人全局 `~/.claude/` 的 rules（10 个主题文件）、skills（`plantuml-in-markdown`、`view-gel-image`）、hooks（`pre-edit-validate.py`、`post-edit-safety.py` + `settings.json` 挂载）复制为项目级 `.claude/` 副本（Claude Code 原生自动加载机制，与 `~/.claude/` 全局副本并存、互不影响）；脱敏所有硬编码个人绝对路径——PlantUML jar 路径改为必须显式设置的 `PUML_JAR` 环境变量（未设置时报错提示而非静默用错路径），hook/规则文件里的 `~/.claude/...` 引用改为 `.claude/...` 项目内路径，`settings.json` 里 hook 命令改用 `${CLAUDE_PROJECT_DIR}` 占位符；`.claude/settings.json` 只保留 hooks 挂载，不带个人 UX 偏好（model/effort/permissions 等）；`.gitignore` 新增 `.claude/settings.local.json`；`CLAUDE.md` 补充 `.claude/` 目录说明和与 `codex-rules/` 的分层关系；`npm run quality` 全量通过。
- 遗留：`.claude/rules/markdown-diagrams.md`（强制 PlantUML，禁用 Mermaid）与既有 `codex-rules/rules/markdown-docs.md`（默认用 Mermaid）在图表工具选型上直接冲突，两套规则并存未合并，需要用户明确本仓库图表工具的最终选择后再对齐；`.claude/rules/` 与 `codex-rules/rules/` 同主题内容不完全一致（如 tool-failure、git-workflow），目前按用户要求保持两层分离未合并。

## 2026-07-05 / 脚手架自审与修复

- 完成：多智能体审查后修复一批问题——新增 `.gitattributes` 统一换行（修复 `pre-commit`/`sync.sh` 在 Linux 上因 CRLF 触发 `bad interpreter`）；密钥扫描覆盖 `.sh`/`.ps1`/`.py`/无扩展名文件并增强正则（不带引号赋值、URL 内嵌凭证、`client_secret` 等）；契约匹配改用 Unicode 词边界并对错误正则容错；Markdown 门禁跳过围栏/行内代码、索引改按链接目标判定；`check:js` 覆盖 `init.mjs` 与 `lib/files.mjs`；`LICENSE` 参数化，`init` 自动填年份/归属者并支持重跑只补预览；去除 CI 与内容规则中的原项目身份泄漏，CI 增加 `dev` 分支与 Windows 矩阵；`preview.sh` 防止误接管抢占端口的外来进程；`restart-remote.ps1` 消费 `REMOTE_USER`/`SSH_KEY_NAME` 并做分支/路径注入校验；新增 `CONTRIBUTING.md` 与占位 `public/index.html`。
- 遗留：CODEOWNERS owner 真实性无法离线校验（依赖 GitHub 设置）；测试框架与依赖/锁文件策略待技术选型后落地，见 [待决策问题](architecture/open-decisions.md)。
