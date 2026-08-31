# 便携单文件文档

[English](portable-documents.md) | 中文

状态：active

最近更新：2026-08-31

适用范围：需要脱离仓库目录结构单独复制、发送或归档的 `docs/**/*.md`

## 决策

仓库内 Markdown 继续引用 Archify 的原生 PNG、交互 HTML 和 Typed JSON，以保持可维护性与可追溯性；需要对外携带时，使用确定性导出命令生成一份自包含 HTML。便携 HTML 把本地栅格图片编码为 `data:` 资源，因此复制单个文件即可阅读，不再要求同时移动 `docs/diagrams/`。

便携 HTML 是 `build/portable-docs/` 下的本地导出物，受 `.gitignore` 管理，不是新的内容真相源，也不提交仓库。Markdown 仍是唯一可编辑正文；图片仍以仓库内 Viewer 原生 PNG 为准。

## 工具选择

生成阶段使用本机 Pandoc 2.12 或更高版本解析 GFM Markdown。选择 Pandoc 是为了覆盖现有文档中的标题、列表、表格、代码块、引用、链接和图片，不在脚手架里维护一个不完整的自制 Markdown 解析器。

Pandoc 只是一项本地生成工具：

- 不加入 npm 依赖，不改变 `npm run quality` 的 Node.js 22 零依赖基线；
- CI 的便携导出门禁使用纯 Node fixture，不要求安装 Pandoc；
- 导出过程禁止远程图片、路径逃逸、symlink 和主动内容格式，不访问网络；
- 产物使用系统字体和内联 CSS，不加载字体、脚本、分析服务或 CDN。

## 输入、输出与链接语义

默认命令扫描所有真正包含 Markdown 行内本地图片语法的 `docs/**/*.md`。也可以在 `--` 后传一个或多个文档路径，只导出指定文档。

```bash
npm run export:portable-docs
npm run export:portable-docs -- docs/sharing/ai-coding-scaffold.md
```

输出保持 `docs/` 下的相对层级，但写入忽略目录：

```text
docs/sharing/ai-coding-scaffold.md
  -> build/portable-docs/sharing/ai-coding-scaffold.html

docs/architecture/overview.md
  -> build/portable-docs/architecture/overview.html
```

便携版以“单文件可阅读”为边界：

- 本地 PNG/JPEG/WebP/GIF 图片原字节内嵌，并保留 alt 文本；
- 页内 `#anchor` 与 `https://`、`http://`、`mailto:`、`tel:` 链接保持可点击；
- 仓库内交互 HTML、Typed JSON 和其他相对链接改成带原路径提示的不可点击文字，避免移动后留下伪装成可用的断链；
- 不把交互 HTML 或 JSON 再塞进便携版。需要搜索、路径追踪、主题切换或继续编辑时，仍应使用仓库三联产物。

## 安全与大小边界

导出器只接受仓库内普通 Markdown 文件和仓库内普通栅格图片。图片必须通过真实路径检查，不能是 symlink；单图不超过 16 MiB，单文档图片总量不超过 32 MiB。拒绝以下输入：

- HTTP(S)、协议相对、`data:` 或其他远程/内联图片目标；
- 绝对路径、逃逸仓库的 `..` 路径、查询参数和 URL fragment；
- SVG、HTML、脚本、iframe、object 等可能携带主动内容的资源；
- 没有图片或图片 alt 文本为空的 Markdown。

生成后的 HTML 必须满足：所有 `<img src>` 都是与原图字节一致的 `data:image/...;base64`，不存在本地 `src`、本地 `href`、外部样式、脚本、iframe 或 CSS 外链。产物记录输入摘要、源路径、图片数量和 Pandoc 版本，导出器写盘前会重新验证这些回执。

## 验证

- `npm run check:portable-docs`：纯 Node 正负 fixture，验证图片扫描、输入摘要、原字节内嵌、本地链接剥离、路径与协议边界。
- `npm run export:portable-docs`：每个候选先写临时文件，通过完整性检查后再原子替换输出；失败保留旧产物。
- 修改模板、样式、过滤器或导出器后，实际打开桌面端和移动端关键视口，确认正文、表格、代码块和图片无溢出，并确认浏览器没有本地或网络资源请求。

当前能力不新增用户数据收集、遥测、运行时第三方服务或持久化凭证。
