# TypeScript Code Quality and Security

English | [Chinese](../rules-zh/typescript-coding-rules-zh.md)

## 1. Type safety

### Required compiler settings

Enable `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`, `verbatimModuleSyntax`, and `noPropertyAccessFromIndexSignature` in `tsconfig.json`.

### Static discipline

- Do not use `any`; use `unknown` and narrow it. Replace `@ts-ignore` with an explained `@ts-expect-error`. Avoid `as` assertions in favor of type guards or zod, except for `as const` and test mocks.
- Annotate function return types explicitly and constrain generics with `<T extends X>`.
- When a union has more than three branches, use a discriminated union and an `assertNever` exhaustiveness check.
- Use branded types to prevent mixing business IDs, monetary values, and timestamps.

### Runtime validation at system boundaries

- Validate external API input, user input, environment variables, and parsed files with a zod schema.
- Derive types from one source: `type Foo = z.infer<typeof FooSchema>`.
- Do not read `process.env.XXX` directly; use one validated configuration layer.

## 2. Error handling

- Do not use an empty `catch {}`. Narrow `catch (err: unknown)`, then handle or rethrow it.
- Business errors inherit from an `AppError` carrying `code` and `message`; never throw a bare string.
- Return a Result or discriminated union for expected failures instead of using exceptions.
- Centralize HTTP status mapping; do not hard-code it throughout business logic.

## 3. Immutability and defensive handling

- Mark object and array parameters `Readonly<T>` and use `as const` for configuration constants.
- Do not mutate parameters in place; return a new object through spread or `structuredClone`.
- Prefer `map`, `filter`, `toSorted`, and `toSpliced` over mutating `sort` and `splice`.
- Handle `undefined` after optional chaining and check every `Map.get()` or indexed lookup.
- Every `switch` needs a `default` or exhaustive check.

## 4. Resource safety

- Remove event listeners, intervals, and timeouts when their scope ends.
- Release database connections and streams in `finally` or `using`; every stream handles `error`.
- Use `AbortController` for cancellable async work and `fs/promises` for Node.js file operations.

## 5. Concurrency safety

- Do not fire and forget: every async call is awaited or has `.catch()`.
- `Promise.all` short-circuits; use `Promise.allSettled` when every result matters.
- Serialize concurrent shared-state changes with a queue such as `p-limit` or `p-queue`. Cancel React async work with `AbortController` during unmount.

## 6. Vulnerability prevention

- Do not use `eval()`, `new Function()`, or `innerHTML`; rely on framework HTML escaping.
- Build URLs with `URLSearchParams` and use parameterized SQL instead of concatenated strings.
- Keep sensitive values in validated environment configuration and never log keys or tokens.

## 7. Required ESLint rules

Enable `@typescript-eslint/strict-type-checked` and `@typescript-eslint/stylistic-type-checked`, plus `no-floating-promises`, `no-misused-promises`, `restrict-template-expressions`, `no-unnecessary-condition`, `prefer-nullish-coalescing`, and `switch-exhaustiveness-check`.

## 8. Testing

- Prefer `vitest`, or use `jest`; core modules target at least 80% coverage.
- Mirror `src/` under `tests/` and use `*.test.ts` filenames.
- Await assertions in async tests and isolate external services with mocks or testcontainers.

Fix each reported error before continuing; do not ignore warnings.
