# Markdown 绘图规范

## 一、强制工具：Archify

凡需要在 Markdown 中表达架构、工作流、调用时序、数据流或生命周期，统一使用项目内 `.claude/skills/archify/`。不新增 PlantUML、Mermaid、手写 SVG 或没有可编辑源的截图；极简 `tree` 风格目录树仍可使用 ASCII。

每次新增、修改、迁移或调试图表，必须先调用 `archify` Skill，并完整遵守其“选类型 → 读 Schema 与同类示例 → 写 Typed JSON → 逐次 validate → deliver → visual-check → 人工看图”闭环。不能用“页面能打开”代替 `showcase` 回执，也不能用自动截图代替人工视觉复核。

## 二、图类型选择

| 表达内容 | Archify 类型 |
| --- | --- |
| 静态组件、分层、依赖、信任边界 | `architecture` |
| 责任、步骤、分支、审批、CI/CD | `workflow`（新图使用 schema v2） |
| 请求、返回、异步消息与时间顺序 | `sequence` |
| 数据管线、血缘、敏感数据与消费者 | `dataflow` |
| 状态、事件、等待、重试与终态 | `lifecycle` |

不要为了沿用旧图外观而选错类型；迁移时保留语义和事实，不机械转写旧 DSL。

## 三、真相源与文档引用

同一张图在 `docs/diagrams/` 使用相同 basename：

```text
<name>.<type>.json
<name>.archify.html
<name>.archify.png
```

- Typed JSON 是唯一可编辑真相源。
- HTML 是可搜索、聚焦、追踪路径、切换主题和导出的交互成品。
- PNG 必须来自 Viewer 原生 `Download PNG` 导出，不含标题栏、菜单或导航控件；`visual-check` 整页截图只作临时验收证据。
- Markdown 使用预览图链接到 HTML，并另给 JSON 源链接；配套文字说明图的事实边界。

示例：

```markdown
[![图表静态预览](../diagrams/example.archify.png)](../diagrams/example.archify.html)

[打开交互图](../diagrams/example.archify.html) · [查看 Typed JSON 图表源](../diagrams/example.architecture.json)
```

## 四、生成与验收

- `npm run check:diagrams`：全部 JSON 做 `showcase` 9/9 校验，检查 vendored Skill 的离线边界，并比较重新交付的 HTML 与提交产物。
- `npm run gen:diagrams`：原子刷新全部交互 HTML。
- `npm run review:diagrams -- <source-file>`：刷新指定 HTML，用 Chrome/Chromium 检查四档桌面并抓取临时深浅主题证据，再调用 Viewer 原生 PNG 导出更新文档主图。

最终必须同时满足：0 error / 0 warning、四档桌面无溢出、最小节点文字达到门禁、深浅主题与原生 PNG 均实际查看、原生导出回执 `canonical=true`、Markdown 三联链接有效。PNG 不做跨机器字节比较。

## 五、离线与升级边界

当前 Skill 固定版本和本地修改见 `docs/contracts/archify.json` 与 `.claude/skills/archify/LOCAL_CHANGES.md`。生成物不得请求 Google Fonts 或其他远程资源，图表工作不得运行自动更新检查。升级必须是显式维护任务，重新审查上游、重放本地修改并走完全部验收。
