# TypeScript 编码质量与安全规范

[English](../rules/typescript-coding-rules.md) | 中文

## 一、类型安全

### 编译器配置（强制）
`tsconfig.json` 必须启用：`strict` / `noUncheckedIndexedAccess` / `exactOptionalPropertyTypes` / `noImplicitOverride` / `noFallthroughCasesInSwitch` / `forceConsistentCasingInFileNames` / `verbatimModuleSyntax` / `noPropertyAccessFromIndexSignature`

### 静态纪律
- 禁止 `any`（用 `unknown` + 收窄）、`@ts-ignore`（用 `@ts-expect-error` + 注释）、`as` 断言（用 type guard / zod；`as const` 和测试 mock 除外）
- 函数返回值必须显式标注；泛型必须有约束 `<T extends X>`
- 联合类型 >3 分支 → discriminated union + `assertNever` exhaustive check
- 业务 ID / 金额 / 时间戳 → branded type 防混用

### 运行时校验（系统边界）
- 外部输入（API / 用户输入 / 环境变量 / 文件解析）必须 zod schema 校验
- 类型单源派生：`type Foo = z.infer<typeof FooSchema>`
- 环境变量禁止直接 `process.env.XXX`，必须走统一校验层

## 二、错误处理
- 禁止空 `catch {}`；`catch(err: unknown)` 必须收窄后处理或重新抛出
- 业务错误继承 `AppError` 基类（携带 `code` + `message`），禁止裸抛字符串
- 可预期失败用 Result / discriminated union 返回，不用异常
- HTTP status code 映射集中一处，禁止业务逻辑中硬编码

## 三、不可变性与防御性
- 函数参数对象/数组标注 `Readonly<T>`；配置常量用 `as const`
- 禁止原地修改参数，用 spread / `structuredClone` 返回新对象
- 数组优先 `map`/`filter`/`toSorted`/`toSpliced`，避免 `sort`/`splice` 原地修改
- `?.` 后必须处理 `undefined`；`Map.get()` / 索引访问必须判空
- `switch` 必须有 `default` 或 exhaustive check

## 四、资源安全
- 事件监听器 / `setInterval` / `setTimeout` 必须在作用域结束时清理
- 数据库连接 / Stream 在 `finally` 或 `using` 中释放；Stream 必须监听 `error`
- 可取消异步操作用 `AbortController`；Node.js 文件操作用 `fs/promises`

## 五、并发安全
- 禁止 fire-and-forget：async 调用必须 `await` 或 `.catch()`
- `Promise.all` 会短路 → 需全部结果时用 `Promise.allSettled`
- 共享状态并发修改用队列（`p-limit` / `p-queue`）；React 异步操作用 `AbortController` 在卸载时取消

## 六、安全漏洞防护
- 禁止 `eval()` / `new Function()` / `innerHTML`；HTML 必须用框架转义
- URL 用 `URLSearchParams` 构造；SQL 用参数化查询；禁止字符串拼接
- 敏感信息禁止硬编码，走环境变量 + zod 校验；日志禁止输出密钥/token

## 七、ESLint 规则集（强制启用）
`@typescript-eslint/strict-type-checked` + `@typescript-eslint/stylistic-type-checked`，额外启用：`no-floating-promises` / `no-misused-promises` / `restrict-template-expressions` / `no-unnecessary-condition` / `prefer-nullish-coalescing` / `switch-exhaustiveness-check`

## 八、测试规范
- 框架：`vitest`（优先）或 `jest`；覆盖率：核心模块 ≥ 80%
- 位置：`tests/` 目录，结构镜像 `src/`，文件名 `*.test.ts`
- 异步测试必须 `await` 断言；外部服务用 mock / testcontainers 隔离

发现错误时，逐条修复后再继续，不要忽略警告。
