# TypeScript Technology Stack Reference Recipe

English | [Chinese](typescript-zh.md)

Optional. Apply this recipe only after [Open Decisions](../open-decisions.md) selects TypeScript for the frontend or backend stack. See [`.claude/rules/typescript-coding-rules.md`](../../../.claude/rules/typescript-coding-rules.md) for the governing rules. This becomes the repository's first third-party npm dependency, so also update the "Dependency and lockfile policy" section in `docs/architecture/open-decisions.md`.

## `tsconfig.json`: the complete strict option set

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

## `eslint.config.js`: flat config

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
    // Plain Node.js utility scripts are not part of the application's tsconfig
    // type graph, so disable type-aware rules for them separately.
    files: ["scripts/**/*.{mjs,js}"],
    ...tseslint.configs.disableTypeChecked,
  },
);
```

## Tests: physically separate unit tests from database integration tests

```ts
// vitest.config.ts — used by the default command; never touches a real database
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["tests/**/*.test.ts"], exclude: ["tests/db-integration/**"] },
});
```

```ts
// vitest.db.config.ts — run by a separate command; requires a real database
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/db-integration/**"],
    fileParallelism: false, // Serialize files that share a database to avoid concurrent seed conflicts.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
```

`package.json` exposes two independent commands: `test`, which runs `vitest.config.ts` by default, and `test:db`, which runs `vitest.db.config.ts` in a separate CI job that starts a database service.

## Machine-enforced commit messages: two options

The scaffold's `.githooks/commit-msg` hook—see the [Git workflow rules](../../../.claude/rules/git-workflow.md)—is a dependency-free shell implementation that works without additional configuration. If your project already uses an npm-based Git hook manager such as Husky, you can replace it with an equivalent Commitlint configuration:

```js
// commitlint.config.cjs
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [2, "always", ["feat", "fix", "docs", "style", "refactor", "test", "chore"]],
    "scope-enum": [2, "always", ["core", "web", "api", "shared", "docs", "infra", "tests"]],
    "body-max-line-length": [0], // Do not impose a body line-length limit.
  },
};
```

Choose one mechanism; do not install two systems that validate the same property.

The repository requires an English Conventional Commit subject in the form `<type>(<scope>): <English subject>`. The built-in shell hook validates this structure. `@commitlint/config-conventional` validates type and scope as well, but replacing the shell hook must preserve any repository-specific subject constraints through an equivalent custom rule.
