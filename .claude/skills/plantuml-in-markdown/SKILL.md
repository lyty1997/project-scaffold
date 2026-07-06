---
name: plantuml-in-markdown
description: 在 markdown 里嵌入并调试 PlantUML 图（组件图、时序图、活动图、泳道图、状态图等）。当用户要求绘制/修改 markdown 内 plantuml 图、或报告 plantuml 语法错误/渲染失败时触发。强制"选对图类型 → 提取 → 编译 → 修复 → 写回"闭环验证，绝不依赖"看起来对"、也绝不默认泳道图。
---

# PlantUML in Markdown — 工程化闭环

## 触发场景

- 用户要求绘制 PlantUML 图并插入 markdown
- 用户反馈 "plantuml 图无法渲染 / 有语法错误 / 预览空白"
- 用户粘贴 plantuml 错误信息

## 黄金工作流（绝不跳过）

**每次写完或修改 plantuml 图，必须走完 4 步，否则视为未完成**：

1. **提取**：把每个 `@startuml ... @enduml` 块抽到独立 `.puml` 文件
2. **编译**：用 `java -jar plantuml.jar -failfast2 -pipe` 逐个编译，收集 stderr
3. **修复**：按报错行号对症下药（见下方"常见坑点"），修一张测一张
4. **写回**：修正后的源码用脚本替换 markdown 中对应代码块，并再次全量编译验证

用户只说 "看起来不错" 不算验证通过。**必须 exit 0 且生成非空 PNG/SVG 才算通过**。

## 可复用 jar 路径

jar 路径不写死在脚本里，通过环境变量 `PUML_JAR` 指定：

```bash
export PUML_JAR=/path/to/plantuml-x.y.z.jar
```

未设置 `PUML_JAR` 时，`scripts/extract_and_compile.sh` 会直接报错并提示如何设置，不会静默用错路径。

## 选对图类型（最先要做的决策）

**"默认用泳道图"是这套 skill 下一个最大的坑**——它不会让编译失败，但会让图没法承载本来要表达的信息，最后用户看图时抓不到重点。动手前先过一遍下面的映射表：

| 要表达的东西 | 合适的图类型 | 不合适的图类型（常见误用） |
|---|---|---|
| **静态结构 / 分层 / 组件依赖**（谁依赖谁，无先后） | **组件图** `package` + `[component]` + `-->` | 泳道图（会强加错误的时间顺序） |
| **跨组件的调用关系**（A 调 B，B 返回 X 给 A） | **时序图** `participant` + `activate` + `return` | 泳道图（丢失请求-响应对的语义） |
| **跨系统 / 跨节点的消息流**（HTTP、RPC、NCCL） | **时序图**（可用 `== 分段 ==` 划阶段） | 泳道图（分布式场景看不出两端的对称性） |
| **单向处理流水线 / 数据变换管线**（阶段不是执行者） | **活动图 + partition 分组** | 泳道图（把"阶段"误画成"执行者"） |
| **带循环、抢占、条件分支的算法流程** | **活动图** `while` + `if/else` + `partition` | 时序图（时序图画不了复杂控制流） |
| **决策树**（嵌套 if/else 挑分支） | **活动图纯决策树** | 泳道图（泳道列反而稀释决策节点） |
| **顺序管线 + 末尾条件**（Sampler 这类固定流水线） | **活动图管线** | 时序图（没有多参与者，时序图浪费） |
| **多参与者 + 每方内部多步**（端到端全链路那种大图） | **泳道图**（此时才是泳道的主场） | 时序图（参与者内部步骤多时 lifeline 会很散） |
| **状态机 / 请求生命周期**（WAITING → RUNNING → DONE） | **状态图** `state` + 转移 | 活动图（状态图能直接表达"状态"而非"动作"） |

经验规则：
- 看到自己准备写 `|泳道|` 时，先反问一句"这张图的参与者真的有并行的内部步骤吗？"——没有就不该用泳道。
- 看到"A → B → C → D → 结果" 这种纯接力，优先考虑**活动图 + partition**；只有真的是"A 调 B 并等返回"才用时序图。
- 架构图 ≠ 流程图。别把"vLLM 分五层"这种静态结构塞进 `start ... stop` 的时间轴里。

## 常见坑点（按出现频率排序）

### 1. 泳道名不能跨行 ← 最常见

PlantUML 活动图泳道名 `|名字|` 必须写在一行内。源码里写成多行会在该行直接报 "Syntax Error"。

```puml
# 错误 ✗
|HTTP Server
(api_server.py)|

# 正确 ✓
|HTTP Server\n(api_server.py)|
```

`\n` 字面量会被渲染成换行，效果等同。

### 2. 不能在 if/else/while 内切换泳道

活动图里，条件分支内部 `|新泳道|` 不被支持。

```puml
# 错误 ✗
if (spec decode?) then (yes)
  |RejectionSampler|
  :...;
endif

# 正确 ✓ - 把泳道切到 if 外，或用活动文本携带角色名
if (spec decode?) then (yes)
  :RejectionSampler:\n按 draft prob / target prob 做拒绝采样;
endif
```

### 3. `note right` 位置

`note right\n...\nend note` 块必须紧跟在某个 `:action;` 之后，不能作为首条语句，不能跨泳道悬空。

### 4. repeat...repeat while 的 label

```puml
# 老语法（仍兼容但易混淆）✗
repeat while (cond?) is (yes)
->no;

# 推荐写法 ✓
repeat while (cond?) is (yes) not (no)
```

### 5. 中文标题 / 特殊字符

- 中文本身没问题，PlantUML UTF-8 安全。
- 但 `()` `*` `/` 在泳道名、**以及多行活动文本 `:text;`** 里都可能被误解析——
  尤其是在文本里用 `/` 做并列分隔时（如 `在线 FP8 / Marlin 布局 / scale 装配`），
  解析器会截断报 "Syntax Error"。
  **修法**：要么改用 `,` 或 `或` 做分隔，要么把整段压成一行用 `\n` 换行。
- 箭头用 `->` 而非 `→`（`→` 在部分版本里被解析成连接线语法）。

### 6. 空 else 分支

```puml
# 某些版本告警 ✗
if (cond?) then (yes)
  :...;
else (no)
endif

# 更稳 ✓
if (cond?) then (yes)
  :...;
endif
```

### 7. 图类型自动推断失败

报错 `(Assumed diagram type: activity)` 是提示它猜不准。检查是否混用了 `start/stop`（活动图）和 `class/actor`（其它图）。单张图只用一套语法。

### 8. 时序图 initiator 不要显式 activate

时序图里，**发起消息的 participant 默认就处于 activated 状态**，再手动 `activate X` 会报
`Activate/Deactivate already done on X`。

```puml
# 错误 ✗
activate CPU
CPU -> CPU : schedule()
CPU -> GPU : execute()
activate GPU

# 正确 ✓ - 只对被调方 activate/deactivate
CPU -> CPU : schedule()
CPU ->> GPU : execute(non_block=True)
activate GPU
CPU -> CPU : get_grammar_bitmask()   // GPU 忙时 CPU 并行
GPU -->> CPU : forward 完成
deactivate GPU
```

想表达"CPU 调用 → GPU 异步忙 → CPU 继续干别的 → GPU 返回"这种重叠语义，用 `->>` / `-->>`
异步箭头 + 只在 callee 侧 `activate/deactivate` 即可。


## 提取 & 编译脚本

见 `scripts/extract_and_compile.sh`，一条命令搞定提取+编译+汇报：

```bash
bash scripts/extract_and_compile.sh path/to/doc.md [out_dir]
```

输出每张图的 `OK/FAIL`、尺寸、错误行号。

## 写回脚本

见 `scripts/write_back.py`，按顺序把 `<out_dir>/g01.puml ... gNN.puml` 写回 markdown 原位置。

```bash
python3 scripts/write_back.py path/to/doc.md out_dir
```

## 用户侧渲染配置（VSCode / Markdown Preview Enhanced）

工作区级 `.vscode/settings.json`：

```json
{
  "markdown-preview-enhanced.plantumlJarPath": "/path/to/plantuml-x.y.z.jar"
}
```

或改用在线服务器免去 jar 依赖：

```json
{
  "markdown-preview-enhanced.plantumlServer": "https://kroki.io/plantuml/svg/"
}
```

## 平台渲染情况备忘

| 平台 | 支持 ` ```plantuml ` 围栏 | 备注 |
|---|---|---|
| 语雀 | 支持 | 用户已验证，默认渲染 |
| GitLab | 支持 | 需管理员启用 PlantUML 服务 |
| Markdown Preview Enhanced (VSCode) | 支持 | 需配置 jar 路径或服务器 |
| GitHub | 不支持 | 需 CI 预渲染成 SVG/PNG 再引用 |
| Typora | 支持 | 需开启 diagrams 选项 |

## 反模式（禁止）

- **默认用泳道图** —— 泳道图只在"多参与者 + 每方内部多步"时才是对的。静态结构、跨系统消息、单向管线、决策树都有更合适的图类型，先查"选对图类型"一节再动手。
- 写完图直接交付，不经编译验证 —— 是这套 skill 存在的唯一理由。
- "我觉得应该能渲染"：plantuml 的错误都是硬错误，不渲染就是不渲染。
- 在 markdown 里反复改、反复让用户截图报错 —— 改动前就应在本地编译验证。
- 把泳道名按可读性硬拆多行 —— 受这个单一规则困扰的图占了绝大多数问题。

## 检查清单

收工前对照一遍：

- [ ] 每张图的类型和它要表达的信息匹配（查"选对图类型"表；不能无脑泳道）
- [ ] 每张图独立编译通过（exit 0，无 stderr）
- [ ] PNG/SVG 生成且尺寸非零
- [ ] 若含泳道图：目视确认泳道列数、箭头方向符合预期
- [ ] markdown 内代码块用 ` ```plantuml ` 开头（非 ` ```puml` 或 ` ```uml`，防止平台兼容问题）
- [ ] 确认用户的目标渲染平台（语雀 / GitLab / MPE / GitHub）
