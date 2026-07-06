# 项目进度

本文件是 __PROJECT_NAME__ 的项目进度真相源，按时间倒序记录每次任务的完成内容与遗留项。每次任务结束或中断时更新。

条目格式：`时间戳 / 主题 / 完成内容 / 遗留项`。任务中如果 Agent 替用户做了未经明确确认的判断（例如自行选定某个细节实现方式），建议在条目里加一句"我替你做的判断（可否决）"，方便用户回看时能一眼看出哪些地方可以推翻重来。

下面按新任务倒序追加条目。

## 2026-07-07 / 修复 CI：diagrams 新鲜度校验因 PlantUML 版本错配而红

- 现象：把领先本地的 4 个提交推上 origin/main 后，CI 首次在"有 plantuml 图表"的状态下真正跑，diagrams job 的 "Check rendered SVGs are up to date"（`check:diagrams:fresh`）报 2 个 SVG（`dev-workflow-loop.svg`、`architecture-overview.svg`）与锁定版本重编字节不一致。Quality gates（Ubuntu/Windows）与 `check:diagrams`（纯编译）均通过，仅字节比较步骤红。
- 根因（与本次 license/双语改动无关）：`check:diagrams:fresh` 逐字节比对"重编结果 vs 已提交 SVG"，而 CI 锁 `1.2024.7`、实际开发/生成环境用 `1.2026.1`（`.claude/rules/markdown-diagrams.md` 的 jar 即 1.2026.1），版本号写进 SVG 头导致字节必然不同；叠加图表 SVG 提交后源码又改过没重新 `gen:diagrams`，SVG 相对当前源码已过期（本地用 1.2026.1 重编同样对不上，坐实是"过期 + 版本错配"双因）。这批图表提交此前从没 push、CI 从没在有图表状态下跑过 fresh，所以问题一直潜伏。
- 修复（根治，非治标）：把 `.github/workflows/ci.yml` 的 `PUML_VERSION` 由 `1.2024.7` 对齐到 `1.2026.1`、`PUML_SHA256` 换成官方 release jar 的校验和 `89c1…3092`（已 curl 下载官方 jar 验证 URL 有效、且与本地 `~/work/envcfg/plantuml-1.2026.1.jar` 的 sha256 逐字相同）；用 1.2026.1 `npm run gen:diagrams` 重新渲染 2 个 SVG。本地用同一 jar 复验 `check:diagrams`（2 块编译过）+ `check:diagrams:fresh`（2 个 SVG up to date）均通过。坑与修法记入 `codex-rules/known-issues.md`。
- 我替你做的判断（可否决）：选择把 **CI 锁定版本升到 1.2026.1**（对齐你本地实际用的版本），而不是把 SVG 降级到 1.2024.7 重生成——因为你的开发环境和 `.claude` 绘图规则都是 1.2026.1，让 CI 校验版本跟随生成版本才能根除错配，否则你下次本地 `gen:diagrams` 又会破坏 CI。
- 遗留：CI 仍有 "Node.js 20 is deprecated"（`actions/checkout@v4`/`setup-node@v4`/`setup-java@v4` 底层 node20）的**警告**（非失败），本次未动 action 版本，避免夹带无关改动；如需消除可单独把这些 action 升到 v5。若 push 后 fresh 仍红（本地 1.2026.1 与 CI runner 的 Java/字体环境差异导致字节不同），说明 fresh 的字节比较策略跨环境脆弱，需另立任务改用"结构等价"而非"字节相等"比较。

## 2026-07-07 / 提交信息改中英双语（英文在前）+ 许可证换 Apache-2.0

- 完成（两条脚手架约定变更）：
  1. **提交信息中英双语、英文在前**：约定主题行格式改为 `<type>(<scope>): <English 主题> / <中文主题>`（用 ` / ` 分隔）。`.githooks/commit-msg` 正则从 `...: .+$` 收紧为 `...: .*[A-Za-z].* / .+$`——强制"英文段（至少一个 ASCII 字母）在前 + ` / ` 分隔 + 后段非空"，merge/revert/Reapply/fixup!/squash!/amend! 等 git 自动主题行仍豁免。用真实钩子跑了 11 个场景端到端验证：合规双语、英文段含 `A/B`、英文段含 ` / `、三种豁免前缀全部放行；中文单语、英文单语、英文段空、缺 scope、无 type 前缀全部拦截。同步更新 `AGENTS.md`（共享真相源）、`codex-rules/rules/git-workflow.md`、`.claude/rules/git-workflow.md`、`.claude/rules/language.md`、`CONTRIBUTING.md`、`SCAFFOLD.md`、`docs/architecture/stack-recipes/typescript.md`（补注 commitlint 备选方案不校验双语结构）。
  2. **许可证 MIT → Apache License 2.0**：`LICENSE` 换成 Apache 官方 2.0 全文（curl 取 apache.org 原始 `.txt` 保证逐字准确），仅把附录版权行改为脚手架占位符 `Copyright __COPYRIGHT_YEAR__ __COPYRIGHT_HOLDER__`，`init.mjs` 的占位符替换链路照常生效；`package.json` 补 `"license": "Apache-2.0"` SPDX 标识；`README.md` 加"许可证"小节。
- 验证：`npm run quality` 五道门禁全绿（check:js / check:docs / check:contracts / check:secrets / check:site）。
- 我替你做的判断（可否决）：（a）双语放在**同一主题行**用 ` / ` 分隔，而非"英文主题行 + 中文正文"——因为你说"英文在前"更贴合同行可见的主题行；如果你更想要英文主题 + 中文 body，说一声我改钩子和文档。（b）钩子只做**结构**校验（英文在前 + 分隔 + 后段非空），不做 CJK 逐字检测——后者在纯 shell 跨平台（CI 含 Windows）下脆弱，且与现有钩子"只校验结构不校验语义"的风格一致，第二段是不是中文由人把关。（c）没有新增 `NOTICE` 文件——Apache-2.0 不强制，且空 `NOTICE` 会平添传递义务，判断为过度工程；将来有第三方署名需求时再加。
- 遗留：`docs/progress.md` 历史条目（2026-07-06）里引用的旧格式 `<type>(<scope>): <主题>` 属历史记录，如实反映当时行为，未改写。

## 2026-07-06 / 定版 review：修复吸收配方提交的三处小瑕疵

- 完成：对"吸收三份外部项目配方"提交做定版 review（门禁全绿、钩子模式位 100755、抽查配方与 DocRestore-pro/Augur_Maestro/Narrative_Maestro 真实配置逐项一致），修掉发现的三处小瑕疵：（1）`docs/architecture/stack-recipes/typescript.md` 两段 vitest 配置片段补上缺失的 `import { defineConfig } from "vitest/config"`，兑现"可直接复制粘贴"的承诺；（2）`.githooks/commit-msg` 豁免清单从 merge/revert 扩展到 `Reapply "` 与 `rebase --autosquash` 的 `fixup!`/`squash!`/`amend!` 前缀（这些主题行都是 git 自动生成的），`codex-rules/rules/git-workflow.md` 同步更新豁免说明，并在临时仓库重新端到端验证 9 种场景（合规/autosquash/Reapply/merge/revert 放行，乱写/缺 scope 仍被拦截）；（3）`.claude/rules/git-workflow.md` 里从其他项目带来的陈旧 scope 枚举（`core|agents|memory|skills|tools|tui|meeting`，与本仓库实际使用的 `scaffold` 不符）改为"scope 按项目模块自定，钩子只强制有 scope 不校验枚举"，与钩子实际行为对齐。
- 遗留：无。

## 2026-07-06 / 从三个外部项目吸收通用脚手架配方

- 完成：调研 DocRestore-pro、Augur_Maestro、Narrative_Maestro 三个项目的工程基建（.claude/rules/hooks、codex-rules/、pre-commit、CI、docs 组织方式等），提炼与本仓库不重复的通用配方并落地：（1）新增 `codex-rules/rules/issue-workflow.md`，修复 Codex 侧此前完全没有 issue 拆解规范的不对称，并在 `codex-rules/global-AGENTS.md`、`AGENTS.md` 补索引；（2）`docs/architecture/overview.md`"演进原则"新增模块设计高内聚低耦合 + docs 单一真相源 spec 的原则；（3）`codex-rules/rules/markdown-docs.md` 新增大文档"进行中/归档"拆分约定；（4）`docs/README.md` 新增"按问题找文档"反查表；（5）PR 模板加"对应设计文档"字段，`docs/progress.md` 条目格式说明加"我替你做的判断（可否决）"提示；（6）`docs/architecture/open-decisions.md`"工程基建"补 CI job 拆分与迁移一致性的演进指引；（7）新增 `docs/architecture/stack-recipes/`（python.md、typescript.md、migration-ledger-check.md），把 `.claude/rules/python-coding-rules.md`/`typescript-coding-rules.md` 已经文字规定的规范配上具体可复制的配置，明确标注"可选、按需启用"；（8）新增零依赖 `.githooks/commit-msg`，把此前只是文档约定的 `<type>(<scope>): <主题>` 提交格式变成机器强制门禁，用真实 git 仓库端到端验证过合规/不合规/merge/revert/空信息共 6 种场景；（9）`CLAUDE.md` 改用 `@AGENTS.md` 原生导入消除双份维护漂移风险，把此前只在 `CLAUDE.md` 的常用命令/目录职责/文档一致性门禁详情合并进 `AGENTS.md` 使其成为唯一真相源，`CLAUDE.md` 只保留 Claude-only 的 `.claude/` 说明段落。过程中发现一个预先存在的真实 bug：`.githooks/pre-commit` 在 git 索引里的文件模式是 `100644`（非可执行），导致配置 `core.hooksPath` 后该 hook 被 git 静默忽略、从未真正运行过；已用 `chmod +x` + `git add --chmod=+x` 修复并记入 `codex-rules/known-issues.md`，新增的 `commit-msg` 同步设置了可执行位。全程每步改动后都跑 `npm run quality` 验证未破坏门禁。
- 我替你做的判断（可否决）：迁移一致性门禁按你在 AskUserQuestion 里认可的方向做成了独立参考脚本文档，没有接入 `check-contracts.mjs` 主链路——因为本仓库目前没有任何迁移工具，硬编到核心质量脚本里属于给零消费者的功能预留通用性，判断为过度工程；`commit-msg` 的 type 枚举沿用了已有 `git-workflow.md` 里的六个 type，没有额外扩展列表。
- 遗留：无新增遗留项；`.claude/rules/` 与 `codex-rules/rules/` 同主题内容不完全一致的分层问题仍维持原状（这是既有的、经用户确认保留的设计，不是本次遗留）。

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
