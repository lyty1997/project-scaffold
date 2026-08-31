# 项目进度

[English](progress.md) | 中文

本文件是 __PROJECT_NAME__ 的项目进度真相源，按时间倒序记录每次任务的完成内容与遗留项。每次任务结束或中断时更新。

条目格式：`时间戳 / 主题 / 完成内容 / 遗留项`。从 2026-07-14 起，Agent 不得替用户做未经明确确认的判断；遇到不确定事项时，应先写清已知事实、可选方案及影响并请用户决策，未确认前不实施依赖该决定的部分。历史条目中的“我替你做的判断（可否决）”仅保留当时记录，不再作为后续工作方式。

下面按新任务倒序追加条目。

## 2026-08-31 CST / Archify 与 PlantUML 互补图表系统

- 决策：把原先“Archify 取代 PlantUML”改为明确的互补矩阵。Archify 负责精美交互总览、复杂工作流/数据流/生命周期、主题、搜索、路径追踪与 canonical PNG；PlantUML 负责 Markdown 内联、易 diff 的 ERD/Class、精确状态机、局部时序/活动图和快速批量编译。同一张图只允许一份可编辑真相源。
- 实现：新增项目级 `plantuml-in-markdown` Skill 及中文参考、安全的 Markdown 提取/编译器、原子 SVG 渲染器、提交的 smoke fixture、`check:plantuml` / `gen:plantuml`、Archify 专项命令别名、组合图表命令，以及校验 SHA-256 后才下载 PlantUML 1.2026.1 的 CI job。PlantUML 禁止 include/import，不加入不可跨机器复现的 SVG 字节新鲜度门禁。
- Archify 共存：更新 vendored Skill，把明确的 PlantUML 与内联围栏请求路由到互补工作流；登记第四项项目本地修改并刷新 vendored tree 摘要；现有 7 张 Archify 图继续遵守 9/9、浏览器复核和 canonical PNG 契约。
- 验证：PlantUML fixture 完成“提取 → 编译 → 写回 → 全量重编”，生成非空 116×290 PNG 与 SVG，并通过人工可读性复核。`check:plantuml` 通过；组合 `check:diagrams` 通过 7 份 Archify showcase 9/9 源与 1 个安全编译的 PlantUML 块；仓库 workflow 通过 actionlint v1.7.12；完整 `npm run quality` 在托管沙箱外通过（沙箱会以 EPERM 阻止 fixture 启动嵌套 Node）。
- CI 跟进：首次推送仅因 CI 能看到 tracked `.agents/skills/archify/agents/openai.yaml` 的中文，而托管 Codex 挂载在本地遮蔽该路径而失败。现已把元数据改成英文，并让 `check:localization` 在工作树挂载遮蔽 `.agents` 时从 Git 索引读取 staged 字节，消除本地与 CI 的可见性差异。
- 数据与外部服务：未新增运行时服务、遥测、用户数据收集或 npm 依赖。CI 新增 Java 设置与固定官方 PlantUML JAR 的摘要校验下载；图表编译本身离线且自包含。

## 2026-08-31 CST / 仓库文档默认英文并持续维护中文译本

- 文档：把现有中文项目 Markdown 保留为持续维护的 `-zh.md` 译本，规范路径改为自然英文。根入口、`docs/`、Codex 规则、Claude 规则与 Skills、贡献资料和 PR 模板都加入双向语言链接；自动加载的 Claude 中文规则单独放在 `.claude/rules-zh/`，两份文档索引各自只列本语言。
- 代码与契约：第一方注释、docstring、交互提示、诊断、fixture、开发脚本和公开 UI 文案全部改为英文；提交钩子与 Release Please 标题契约统一为英文 Conventional Commit。新增 `check:localization`，阻止默认英文表面出现未放行 Han 并强制文档配对同步，同时把中文 locale fixture、契约词和初始化器双语输出明确保留为功能数据。
- 图表与 UI：7 份 Archify 源全部改为英文并设 `meta.locale: "en"`，重新生成新鲜的交互 HTML 与 Viewer 原生 canonical PNG，逐图检查最终 PNG 和深浅主题浏览器证据。真实 390×844 渲染发现较长英文路径导致移动端溢出；补响应式换行后，390×844 与 1440×900 的 Chrome 指标均为 `scrollWidth` 等于视口宽度。
- 验证：`npm run quality` 在托管沙箱外通过；沙箱内执行已进入 CI/CD fixture，但嵌套 Node 被 EPERM 阻止。`npm run check:archify` 对 7 份源通过 showcase 9/9、HTML 新鲜度和原生 PNG 尺寸校验。文档、本地化、便携文档、契约、密钥、站点、CI/CD、语法、hooks、Python、换行与真实浏览器检查均通过。
- 数据与外部服务：本次本地化不新增用户数据收集、遥测、运行时第三方服务、npm 依赖或网络依赖。

## 2026-08-31 CST / 带本地插图的 Markdown 支持便携单文件导出

- 问题：仓库 Markdown 通过相对路径引用 `docs/diagrams/*.archify.png`、交互 HTML 和 Typed JSON；这对维护和追溯正确，但单独移动 `.md` 会断图，使用者必须同时搬运原目录结构。
- 决策：不破坏仓库三联产物，新增按需生成的自包含 HTML。Markdown 与 Viewer 原生 PNG 仍是真相源；便携产物写入已忽略的 `build/portable-docs/`，不提交、不被初始化器替换，也不反向改写仓库链接。便携版保留外部链接和页内锚点，把仓库相对链接降级为带原路径提示的文字。
- 实现：新增 `scripts/docs/export-portable.mjs`、受控 HTML 模板和 Pandoc Lua link filter；`npm run export:portable-docs` 默认发现全部含本地 Markdown 图片的文档，也可在 `--` 后指定源。生成阶段使用本机 Pandoc 2.12+ 解析 GFM，图片按原字节写成 `data:`，候选通过检查后才原子替换旧文件。当前自动发现并导出架构概览、跨机预览、CI/CD 自动搭建和技术分享 4 份文档。
- 安全边界：纯 Node 前置扫描拒绝远程/内联图片、路径逃逸、symlink、SVG/主动格式、原始 HTML、空 alt、单图超过 16 MiB或单文档图片总量超过 32 MiB；写盘前检查输入摘要、Pandoc 版本、图片数量，逐张解码比对 MIME 与原图字节，并拒绝脚本、iframe、base/form、`srcset`、本地或不安全 `href/src`、CSS `@import`/外链。正负 fixture 还覆盖代码围栏与行内代码忽略、emoji 前缀索引、单双引号属性绕过、字节漂移和过期摘要。
- 产物与渲染：四份最终 HTML 为 408,216–2,803,329 字节，连续两次生成 SHA-256 完全一致。Chrome 在 1440×1000 和 390×844 共 8 个视口验证图片全部解码、页面无横向溢出、本地链接与资源请求均为 0；人工查看发现长文章目录占据首屏，修正为视口限高滚动区后复查通过，首张内嵌 Archify 图在桌面和手机上均完整显示。
- 最终门禁：`npm run quality` 全绿，其中 `check:portable-docs` 确认 4 份生产源可发现且正负 fixture 全部符合预期；`npm run check:diagrams` 继续通过 7 份 Archify 源的 `showcase` 9/9、HTML 新鲜度和原生 PNG 尺寸检查。
- 数据与外部服务：未新增 npm 依赖、用户数据收集、遥测或运行时第三方服务；Pandoc 仅是本地生成工具，基础 CI 与 `npm run quality` 仍只依赖 Node.js 22。

## 2026-08-30 CST / 补齐 Archify 的 Claude 与 Codex 双原生集成

- 缺口：前一轮只有 `.claude/skills/archify/` 的 Claude 原生入口，Codex 规则虽能链接该目录，但仓库缺少 Codex 官方扫描的 `.agents/skills` 入口，不能称为完整的双 Agent 集成。
- 实现：保留 `.claude/skills/archify/` 作为唯一 vendored 实现，新增 `.agents/skills/archify/SKILL.md` 作为 Codex 原生发现桥接入口，并增加 `agents/openai.yaml` 的显示名称、简介和默认 `$archify` 提示。桥接入口强制完整读取 canonical Skill、按其目录解析脚本与引用，并显式继承文档 PNG 必须走 Viewer 原生 **Export → PNG** 的约束；没有复制 5.9 MB 渲染器与资源。
- 跨平台：Codex 官方支持 symlink Skill，但 Git 在未启用 symlink 的 Windows checkout 中可能把目录链接退化为普通文本，因此入口采用普通 `SKILL.md` 文件。`docs/contracts/archify.json` 升级为 schema v2 并记录 Claude/Codex 双入口、Codex UI 元数据和 canonical 目标；`check:diagrams` 会拒绝缺失入口、symlink/非普通文件、错误名称、错误目标或丢失 `$archify` 元数据。
- 环境边界：当前 Codex 会话把仓库 `.agents` 挂载为只读空目录，两个新增文件因此以普通文件模式写入 Git 索引并设置 `skip-worktree`，防止挂载遮蔽被误记为删除；门禁仅在工作树路径被遮蔽时从索引读取同一字节。文件从索引检出到隔离临时目录后，`skill-creator` 校验通过。
- 验证：`npm run check:diagrams` 通过 7 份图表的 `showcase` 9/9、HTML 新鲜度、原生 PNG 尺寸、离线边界和双 Skill 入口检查；`npm run quality` 全绿。实现提交已由 `dev` fast-forward 合并到 `main`；dev CI run `33318203756` 与 main CI run `33318297445` 均成功。
- 数据与外部服务：未新增用户数据收集、遥测、运行时第三方服务或 MCP 依赖。

## 2026-08-30 CST / 文档主图改用 Archify Viewer 原生 PNG

- 问题：首轮集成把 `visual-check` 生成的 1440×900 整页截图复制为 `.archify.png`，图片包含标题栏、引导视图和导航控件，不符合“文档插入原生导出 PNG”的要求。
- 修复：新增 `scripts/quality/lib/archify-native-export.mjs`，在真实 Chrome 中调用交互成品自带的 `Archify.exportMenu.run("png")`；只拦截浏览器下载传输以取得 Blob，不改动 Viewer 的 `serializeSvg → 4×/安全倍率 rasterize → PNG` 原生生成链。导出回执必须为 `format=png`、`canonical=true`，Blob 字节数必须与文件一致。
- 防回归：`check:diagrams` 从 HTML 主 SVG 读取 viewBox，复用 Viewer 的 1600 万像素安全倍率算法，再检查 PNG IHDR 尺寸；因此 1440×900 Viewer 截图无法再冒充文档主图。`visual-check` 的深浅主题整页截图只保留在 `/tmp` 证据目录，不写入 `docs/diagrams/`。
- Skill 同步：更新 `.claude/skills/archify/SKILL.md` 与 `references/delivery-contract.md`，把“禁止用 `visual-check` 截图充当文档 PNG、必须走 `Archify.exportMenu.run("png")`、回传尺寸/倍率/`canonical=true`”纳入后续 Agent 的正式交付行为；`LOCAL_CHANGES.md` 和机器契约新增第三项本地差异，vendored 目录摘要同步更新。`skill-creator` 的 `quick_validate.py` 校验通过。
- 结果：重新原生导出 7 张文档 PNG，倍率按图面为 3× 或 4×，尺寸从 3920×2160 到 5988×2608；逐张人工查看确认完整图未裁切，且不含 Viewer 标题栏、章节栏、菜单或导航控件。`npm run check:diagrams` 通过全部 7 份 `showcase` 9/9、HTML 新鲜度与原生 PNG 尺寸检查。
- 数据与外部服务：未新增用户数据收集或运行时第三方服务；导出使用项目已固定的本机 Chrome 与离线 HTML。

## 2026-08-30 CST / Archify 图表系统集成并替换 PlantUML

- 决策与评估：先用本机 PlantUML 1.2026.1 对仓库原有 7 张图逐张提取并真实编译，全部通过，确认替换不是修复语法错误；再用同一语义评估 Archify。中等密度“架构概览”完整保留原图 6 个节点和 8 条关系，`showcase` 9/9、0 error / 0 warning；一份 11 节点高密候选因 1440px 桌面文字仅 5.894px 被门禁拒绝，后经压缩重复文案、保持 14 条关系并修正边界后通过。深浅主题、四档桌面包含性和真实截图复核确认视觉改善；Finder、Guided Views、Route Probe、Relationship Lens 与 i18n 选择性回归为 31 pass / 1 条真实浏览器条件跳过，随后设置本机 Chrome 单独运行中文 Finder、Route、Export 与无障碍回归 9/9 通过。
- 固定上游：按用户指定克隆 `tt-a1i/archify`，完整历史与普通浅克隆都在远端 blob 传输时长时间无进展，最终用 `gh repo clone ... -- --depth 1 --filter=blob:none --no-checkout` 成功取得并按需检出核心 Skill；固定提交 `4ac500a498267f18bda42b3c82b51edb8f9c1baf`、版本 `2.16.0-dev.0`，以 MIT 许可 vendored 到 `.claude/skills/archify/`，机器契约为 `docs/contracts/archify.json`。
- 离线与隐私：上游模板虽称自包含，实际仍请求 Google Fonts，禁网时导致 Chrome `loadEventFired` 超时，也会在读者打开本地图时产生第三方请求。本地修改删除远程字体并使用系统字体栈，同时在 Skill 中关闭自动更新检查；修改记录写入 `LOCAL_CHANGES.md`，门禁会检查该离线边界。未新增用户数据收集、遥测或运行时第三方服务。
- 工具链：新增 `scripts/quality/lib/archify.mjs` 与 `review-diagrams.mjs`，重写 `check-diagrams.mjs` / `render-diagrams.mjs`；`check:diagrams` 逐图原子交付到临时目录，要求 9/9 并把结果与提交 HTML 做字节比较，同时检查 PNG 和远程资源；`gen:diagrams` 原子刷新 HTML；`review:diagrams` 在临时目录跑四档桌面与深浅主题 Chrome 检查，成功后只刷新仓库内静态预览。CI `diagrams` job 改为 Node 22 + vendored Archify，不再下载 Java/JAR。
- 文档应用：将“架构概览”“跨机协同预览”“CI/CD 自动搭建”和技术分享中的 4 张图全部迁移为 7 组 Typed JSON / 交互 HTML / PNG 预览：3 张 `architecture`、3 张 workflow schema v2、1 张 `sequence`；移除 Markdown 内全部 PlantUML 代码块、旧 SVG、项目级 PlantUML Skill 和共享编译库。文档、Claude/Codex 规则、README、脚手架说明与质量门禁已改为 Archify 三联产物契约。
- 视觉验收：7 张图均通过 `showcase` 9/9、0 error / 0 warning；Chrome 在 1440×900、1600×1000、1920×1080、2048×1320 无横纵溢出，最小/最大视口的深浅主题截图已逐张人工查看。视觉修正轮数：架构概览、演进图、四层图、协同时序图各 1 轮；任务闭环、复用流程、CI/CD 流程为 0 轮。
- 质量修复：vendored/runtime HTML 中的普通 `token = functionCall(...)` 触发了原密钥扫描器的“不带引号赋值”误报；将规则收紧为值必须结束于行尾或注释，继续覆盖 env / shell / 配置字面量，并用 2 个应命中、2 个源码表达式不应命中的用例复核。`npm run check:secrets` 已通过。
- 最终验证：`npm run check:diagrams` 通过 7 份源的 `showcase` 9/9、HTML 字节新鲜度、PNG 与离线边界检查；`npm run quality` 全绿，覆盖 JS 语法、Markdown 索引与链接、契约、密钥、静态站点和 CI/CD fixture。另下载 CI 固定的 actionlint v1.7.12 到临时目录，SHA256 与 `8aca8d...a3d8` 一致，仓库 workflow 与正负 fixture 均通过真实 actionlint。
- 分支与遗留：所有改动位于本地 `dev` 分支；仓库此前没有本地或远端 `dev`，本轮只创建本地分支，未自行 push。上游固定的是用户要求克隆时的 `main` 开发版，后续升级必须显式审查并重放三项本地修改，不能自动更新。

## 2026-07-30 CST / AI 编码脚手架技术专栏文章

- 完成：新增[技术专栏文章](sharing/ai-coding-scaffold-zh.md)，以个人网站的书面分享方式说明脚手架的设计动机、四层基础架构、任务闭环、项目复用流程、需要调整的项目事实和随基础模型能力提升的五个演进方向；新增四层架构、任务闭环、复用流程和演进方向四组 PlantUML 图文表达，并在文章中明确区分已实现能力、占位能力与真实绿地项目尚待补充的远端验收。
- 验证：四张新图按“提取 → 逐图编译 → 写回 → 全量重编”闭环通过，并生成非空 PNG/SVG；仓库标准 `check:diagrams` 确认全部 7 个 PlantUML 块可编译；`npm run quality` 全绿，覆盖脚本语法、Markdown 链接与索引、契约词、密钥、静态站点和 CI/CD 门禁及夹具。
- 数据与外部服务：未新增用户数据收集或运行时第三方服务。

## 2026-07-26 CST / CI/CD 自动搭建能力（第二增量本地实现）

- 完成 `actionlint` 独立门禁：`.github/workflows/ci.yml` 新增 Ubuntu `workflow-lint` job，固定下载 actionlint v1.7.12 并校验归档 SHA256，同时确认 ShellCheck 可用；新增 `npm run check:workflows` 薄包装，外部二进制缺失、非法绕过参数或 actionlint finding 都会失败。正负 fixture 还会把渲染器生成的 Release Please 与布尔 `dry_run` 部署 workflow 交给真实 actionlint。
- 完成台账驱动的 Release Please 生成：固定 `googleapis/release-please-action` v5.0.0 提交 SHA，支持已建立版本源映射的 `node` / `simple`，生成 workflow、config，并仅在首次 bootstrap 创建 manifest；支持默认 `GITHUB_TOKEN` 或已登记来源的 PAT secret，不把 GitHub App 写成已支持能力。未初始化的脚手架根仓库没有产品版本真相源，因此没有提交活的 Release workflow/config/manifest。
- 收紧生命周期与失败边界：拒绝手写同名文件、symlink、无法证明归属的 config、旧 managed 残留和 manifest 状态丢失；多文件写入使用 staging、备份、原子替换与失败回滚。版本源、package owner、extra-files、SemVer、Git branch、跨平台 workflow 文件名及受限 config schema 都有回归用例，根级非法配置不能被 package override 掩盖。部署 `dry_run` guard 按 boolean 语义生成，`kind: deploy` 的每个 step 必须显式分类为真实发布或安全准备，且至少有一个受保护发布步骤。全局安全扫描还会处理跨行 YAML 标量、双引号 Unicode 转义和 `on` 区域 block scalar，并拒绝 workflow 使用 YAML alias / anchor、显式 mapping key 或显式 tag key，避免隐藏 `continue-on-error` 或 `pull_request_target`。
- 评估 `zizmor`：用校验过 SHA256 的 v1.28.0 官方二进制对当前仓库执行 regular persona 离线扫描，报告 8 项（1 项 suppressed），显示的 7 项 high 均来自 GitHub 官方 Action 使用 v5 tag。它从 v1.20.0 起默认要求所有 Action（含 `actions/*`）钉 SHA，与当前“官方 Action 允许版本 tag、第三方 Action 钉 40 位 SHA”策略不同；本轮不加入常驻或 non-blocking 假门禁，待项目决定全面钉 SHA 并配套自动更新后再引入。
- 验证：`npm run quality` 全绿；真实 actionlint 对仓库 workflow 与持久化 fixture 均通过；`npm run gen:cicd` 在无台账的脚手架根目录明确跳过，未生成产品 Release 配置。真实绿地项目的临时分支、Release PR、tag 与 GitHub Release 尚未执行，仍需在具体项目确认版本源、凭证模式和发布节奏后完成远端验收。
- 数据与外部服务：未新增用户数据收集，也未给脚手架启用新的运行时第三方服务；CI 会下载并校验官方 actionlint 归档，目标项目只有在台账显式启用后才使用 release-please。

## 2026-07-26 CST / CI/CD 自动搭建能力（第一增量）

- 背景：脚手架此前只有 CI（内容质量门禁），CD 完全空白，也没有任何机制在绿地项目长出源码时提醒该搭。用户要求"提醒到 + 全自动搭完 + 适配任意技术栈（gcc/C/C++/Python/TypeScript/HTML × Pages/Cloudflare/Vercel/容器/包发布/自建）"，并明确"按需适配对应的项目，而不是在这里建现成的"。
- 设计：新增 [CI/CD 自动搭建](architecture/cicd-autosetup-zh.md)。核心判断是把一份 CI/CD 拆成「结构与安全骨架」（不随技术栈变，代码化固化在渲染器里）和「工具链与命令」（每个项目都不同，靠探测事实 + 用户拍板产生，写进 JSON 台账）。因此仓库里不存在任何成品 workflow 模板，加新技术栈不需要加文件。真相源是 `docs/contracts/cicd-answers.json`，YAML 只是产物——这也绕开了 Node 22 无内置 YAML 解析器与零依赖承诺的冲突（生成器只写不读 YAML）。
- 完成（第一增量）：`scripts/cicd/probe.mjs`（探测器，本地信号 + 8 个远端只读端点 + token scope 体检，有阻塞项非零退出）；`scripts/cicd/render.mjs`（渲染器 + 约 100 行受限 YAML 序列化器，固化最小权限、第三方 action 钉 40 位 SHA、`${{ secrets.X }}` 写法、显式 `shell:`、禁 `pull_request_target`、禁 `continue-on-error: true`、部署步骤 dry_run 闸门、部署类 `cancel-in-progress: false`）；`scripts/quality/check-cicd.mjs`（进 `quality`，安全红线覆盖全部 workflow，漂移检测靠"重新渲染 + 字节比对"只覆盖 managed 产物）；三层提醒（`init.mjs` 可选章节 + 待办落 `open-decisions.md`、`.claude/rules/cicd-workflow.md` 与 codex 侧同名规则 + 路由表、新增独立 hook `.claude/hooks/cicd-reminder.py`）；`.claude/skills/setup-cicd/SKILL.md` 九步闭环。
- 验证证据：探测器实跑抓出真实阻塞项（本机 token scope 为 `gist, read:org, repo`，缺 `workflow`，会导致 push workflow 文件被拒）；渲染器 fixture 自测覆盖正常路径（C++ CMake 矩阵 + Pages 部署）与异常路径（8 条违规全部拦下），产物经 pyyaml 解析校验通过；门禁 5 种失败模式（漂移、secret 未登记、缺回滚方式、台账丢失、managed 残留）逐条验证报错；hook 5 个判定用例（未初始化/应提醒/当天去重/已有台账/非 Write-Edit）全部符合预期；`init.mjs` 在全新副本上验证 y/N 两个分支，待办记录幂等。
- 过程中修掉的两个真 bug（由 fixture 自测暴露，不是"看起来对"能发现的）：部署步骤的 `if` 与用户自带条件合成时把 `&&` 落在了 `${{ }}` 外面，生成的是非法表达式；`env:`/`with:` 是嵌套对象，原实现只扫顶层字符串，导致 secrets 写法违规整条漏检。
- 工程量判断：整体偏大，拆两个增量后第一增量为"刚刚好"。主动砍掉三项——"积木库 + 验证后自增长"（单人项目触发频次低，会腐烂成无人维护的垃圾场；台账文件本身已是零维护成本的沉淀）、staging/production 环境分层（用户未选）、`zizmor` 深度安全审计（渲染器已固化 SHA 钉法与禁 `pull_request_target`，第一增量收益有限）。
- 遗留：第二增量未开始——`actionlint` 独立 job 与 `npm run check:workflows`、`release-please` 接入（需先定版本号真相源）、按需评估 `zizmor`。另外整套链路尚未在真实绿地项目上端到端跑过一次"实测转绿 + 远端 apply"，这一步要等有实际项目时补，且需要先解决 token 缺 `workflow` scope 的问题。

## 2026-07-15 22:44 CST / CLAUDE.md 收敛为纯导入，消除重复状态

- 完成：CLAUDE.md 删去「Claude Code 专属配置」「导入内容里的 Codex 侧写法」「规则优先级」三节，只留单一真相源声明 + `@AGENTS.md` 导入，32 行降到 6 行。根因判断：`.claude/rules/`、`.claude/skills/`、`.claude/hooks/` 全部由 Claude Code 在启动时自动注入，CLAUDE.md 里那份清单是手抄副本；`a7879aa` 漏登记 `sync-shared-rules` 是这份重复状态的必然产物。消除重复状态优于加门禁去校验重复状态——原本提案的 `check:claude-md` 门禁因此撤回未实施。
- 查证（官方 memory 文档）：CLAUDE.md 启动时自动加载；`@` 导入在启动时随引用它的文件一起展开，上限 4 层；`.claude/rules/*.md` 是 Claude Code 原生自动发现位置，递归扫描、启动时加载、优先级等同 `.claude/CLAUDE.md`；用户级 `~/.claude/rules/` 先于项目级加载。故 `docs/README.md` 不为 `.claude/` 补索引不影响 Claude 加载规范——索引的受益人是人类读者，此项按用户决定不补。
- 用户决定：`apply_patch` 覆盖说明与 `.claude/rules/` 优先级链一并删除，AGENTS.md 一行不动。已知代价：Claude Code 仍会读到「手工编辑使用 `apply_patch`」这条它无法执行的指令；`.claude/rules/` 与 `codex-rules/rules/` 冲突时无裁决依据，可能退回「自行取更保守一方」。
- 完成：清理 `docs/architecture/dev-workflow.md:35` 对 CLAUDE.md 的凭空引用——原文称「与 [CLAUDE.md] 里给临时手动预览用的端口是两回事」，但 `git log -S'端口' -- CLAUDE.md` 显示 CLAUDE.md 从未有过端口说明。该失效引用长期未被拦截，因为 `check:docs` 只验链接可解析、不验声称内容是否属实。
- 验证：`npm run quality` 全绿；`check:docs` 确认 `./AGENTS.md` 链接可达。
- 遗留：无。

## 2026-07-15 21:18 CST / 精炼 Agent 规范并降低上下文噪声

- 完成：将根 `AGENTS.md` 收敛为始终适用的项目边界和最短工作闭环；将 `codex-rules/global-AGENTS.md` 改为按任务触点选读的路由表；去除启动检查、不确定性、文档先行、验证、语言、安全和 PlantUML 说明在多文件间的重复。
- 完成：把质量命令、CI 和 PlantUML 的实现说明迁移到按需读取的 `docs/architecture/quality-gates.md`，更新 `docs/README.md` 索引；精炼全部 Codex 主题规则和已知问题，并修正 `check-diagrams.mjs` 对已删除 SVG 新鲜度脚本的失效注释。
- 量化：`AGENTS.md + codex-rules/` 从 463 行、35,648 字节降到 235 行、14,992 字节，分别减少约 49% 和 58%；根 `AGENTS.md` 从 12,411 字节降到 3,100 字节，减少约 75%。
- 完成：同步 `CLAUDE.md`（经 `@AGENTS.md` 导入同一份规范，本次重构改动了它的前提）——新增「导入内容里的 Codex 侧写法」，声明 `apply_patch` 在 Claude Code 侧对应 Edit/Write：该条原在 `Codex 工作约束` 标题下有 Codex 限定，重构并入通用的「编辑与验证」后会无条件套到 Claude Code 上。
- 完成：`CLAUDE.md` 新增「规则优先级」，把 `.claude/rules/` 接入 `global-AGENTS.md` 本次固化的优先级链（同级于 `codex-rules/rules/`），并删去原先「冲突取更保守一方为准」这句——它与该链「同级冲突请用户决定」的口径相悖，且与自身后半句「不默认二选一」矛盾。
- 完成：补录 `CLAUDE.md` 漏登记的 `sync-shared-rules` skill（`a7879aa` 新增时未同步）。
- 验证：`git diff --check` 通过；`npm run quality` 全部通过（脚本语法、Markdown、契约、密钥扫描、静态站点）；`CLAUDE.md` 改动后重跑 `npm run quality` 仍全绿，新增的三个内部链接由 `check:docs` 校验可达。
- 遗留：`docs/README.md` 与 `AGENTS.md` 的真相源清单均已不提 `CLAUDE.md` / `.claude/`，Claude Code 这一层只能从 `CLAUDE.md` 自身发现；是否补回索引待定（与本次「AGENTS.md 只留跨 Agent 共识」的瘦身方向相悖，需用户决定）。

## 2026-07-14 13:15 CST / 明确 Codex 禁止臆测用户意图

- 完成：在根 `AGENTS.md`、`codex-rules/global-AGENTS.md`、`codex-rules/rules/codex-workflow.md` 和 `codex-rules/rules/language.md` 中明确：Codex 不得臆测或自行补全用户未表达的意图、偏好、优先级、验收标准、业务事实和授权；能查证的事实先查证，仍不确定或只能由用户取舍的事项必须写明已知事实、可选方案及影响，请用户决策；确认前不得实施依赖该决定的部分，也不得以“默认”“更保守”或“可否决判断”代替确认。
- 完成：修正本文件原先建议记录“我替你做的判断（可否决）”的工作方式；历史记录保留，但从本条起不再允许先替用户决定、事后再请用户否决。
- 遗留：无。

## 2026-07-07 / CI 保养：GitHub Actions 升到 v5

- 完成：`.github/workflows/ci.yml` 里 `actions/checkout`、`actions/setup-node`、`actions/setup-java` 全部由 `@v4` 升到 `@v5`（共 5 处），消除 "Node.js 20 is deprecated"（这些 action 底层 runtime 由 node20 → node24）的 CI 警告。输入参数（`node-version`/`distribution`/`java-version`）在 v5 保持不变，无需其它改动；这是纯警告清理，不影响门禁成败。
- 遗留：无。

## 2026-07-07 / 彻底修 CI：废弃 SVG 新鲜度字节门禁，只保留编译校验

- 背景：上一条把 CI 的 PlantUML 版本对齐到 1.2026.1 后 push，CI **仍红**在同一步。查 SVG 内容发现文字是 `textLength="41.9998"` 这类值、整图 `width/height` 按文字排版反推，都来自 **JVM 的 AWT 字体度量**——我本地和 CI runner（Temurin 21 + 不同已装字体）字体度量不同，同一版本 PlantUML 渲染出的 SVG 字节照样不同。结论：`check:diagrams:fresh` 的"字节相等"比较跨机器天生对不上，版本对齐是必要但不充分，这道门禁的设计前提（同版本→同字节）本身就是错的。
- 决策（已征询用户，选"不要比较 SVG 了，只管源头的 PlantUML"）：**废弃 SVG 新鲜度门禁**。改动：（1）`.github/workflows/ci.yml` 的 `diagrams` job 删掉 "Check rendered SVGs are up to date" 步骤、job 名改为 "Diagram compile check"，只保留 `check:diagrams`（编译校验）；PUML 版本保持 1.2026.1（编译步骤仍用，且与开发环境一致）。（2）`scripts/quality/render-diagrams.mjs` 删掉 `--check` 比较模式，退化为纯 SVG 生成器，并补注释说明为什么不做新鲜度校验。（3）`package.json` 删掉 `check:diagrams:fresh` 脚本（`gen:diagrams` 保留）。（4）同步改 `AGENTS.md`、`.claude/rules/markdown-diagrams.md`、`codex-rules/rules/markdown-docs.md` 里对该门禁的描述，`codex-rules/known-issues.md` 把原"版本错配"条目改写为最终结论 + 排查教训。
- 真相源边界（改动后）：markdown 里的 plantuml 源码是唯一真相源，`check:diagrams` 保证它能编译；`docs/diagrams/` 下的 SVG 只是给 GitHub 等不渲染内嵌 plantuml 的平台看的产物，改完源码本地 `gen:diagrams` 刷新提交即可，CI 不再回头字节校验它。
- 验证：本地 `npm run quality` 五道全绿；`PUML_JAR=…1.2026.1.jar npm run check:diagrams` 通过（2 块编译过）。CI 结果以 push 后实际 run 为准（本条目下的提交推上去后确认）。
- 订正：上一条（版本错配）标的"根治"实为不充分，真正根治是本条的废弃字节门禁；两条都保留，完整反映排查过程。

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
- 遗留：CODEOWNERS owner 真实性无法离线校验（依赖 GitHub 设置）；测试框架与依赖/锁文件策略待技术选型后落地，见 [待决策问题](architecture/open-decisions-zh.md)。
