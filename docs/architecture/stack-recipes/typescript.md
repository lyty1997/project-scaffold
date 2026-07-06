# TypeScript 技术栈参考配方

可选，仅在 [待决策问题](../open-decisions.md) 确定前端/后端技术栈选 TypeScript 后才需要落地。规则依据见 [`.claude/rules/typescript-coding-rules.md`](../../../.claude/rules/typescript-coding-rules.md)。落地后这是本仓库第一次引入第三方 npm 依赖，记得同步更新 `docs/architecture/open-decisions.md`"依赖与锁文件策略"一节。

## `tsconfig.json`：strict 全家桶

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "verbatimModuleSyntax": true,
    "noPropertyAccessFromIndexSignature": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

## `eslint.config.js`：flat config

```js
import tseslint from "typescript-eslint";

export default tseslint.config(
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
    },
  },
  {
    // 纯 Node 工具脚本不在 app 的 tsconfig 类型图里，单独关闭类型感知规则。
    files: ["scripts/**/*.{mjs,js}"],
    ...tseslint.configs.disableTypeChecked,
  },
);
```

## 测试：单测与 DB 集成测试物理隔离

```ts
// vitest.config.ts —— 默认命令跑这份，不碰真实数据库
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["tests/**/*.test.ts"], exclude: ["tests/db-integration/**"] },
});
```

```ts
// vitest.db.config.ts —— 单独命令跑，需要真实数据库
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/db-integration/**"],
    fileParallelism: false, // 同库文件间串行，避免并发 seed 冲突
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
```

`package.json` 对应两条独立命令：`test`（默认，跑 `vitest.config.ts`）和 `test:db`（跑 `vitest.db.config.ts`，CI 里放进需要起数据库服务的独立 job）。

## 提交信息机器门禁：两种选择

脚手架自带的 `.githooks/commit-msg`（见 [Git 工作流规范](../../../.claude/rules/git-workflow.md)）是零依赖 shell 实现，直接可用，无需额外配置。如果你的项目已经引入 npm 生态的 git hook 管理（如 husky），也可以换成等价的 `commitlint`：

```js
// commitlint.config.cjs
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [2, "always", ["feat", "fix", "docs", "style", "refactor", "test", "chore"]],
    "scope-enum": [2, "always", ["core", "web", "api", "shared", "docs", "infra", "tests"]],
    "body-max-line-length": [0], // 中文提交正文经常超长，不限制行长
  },
};
```

两者二选一即可，不要同时装两套校验同一件事。

注意：本仓库约定提交主题行中英双语、英文在前（`<type>(<scope>): <English 主题> / <中文主题>`，用 ` / ` 分隔英文与中文两段）。这条"双语结构"目前只有自带的 shell 钩子在校验；`@commitlint/config-conventional` 只管 type/scope，不校验双语结构。若换用 commitlint 又想保留双语门禁，需要另加一条匹配 ` / ` 分隔的 `subject` 自定义规则，或继续用 shell 钩子。
