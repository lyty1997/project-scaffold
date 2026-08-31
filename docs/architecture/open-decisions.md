# Open Decisions

English | [Chinese](open-decisions-zh.md)

Status: active
Last updated: initial phase of __PROJECT_NAME__

This document centralizes the technical and product decisions that have not yet been made for __PROJECT_NAME__ (__PROJECT_SLUG__), so they do not become scattered across code or chat history. Once a decision is made, move the conclusion into the appropriate formal design document and remove it from this file.

## Technology choices

- Frontend framework: choose React, Vue, Next.js, SvelteKit, or another option based on team familiarity and rendering requirements (SSR/SSG/CSR).
- Backend framework and language: choose an option such as Node.js (Express/Nest), Python (FastAPI/Django), Go, or Java based on team capabilities and performance requirements.
- Database: choose a relational database (PostgreSQL/MySQL), a document database (MongoDB), or another option, and decide whether a caching layer such as Redis is needed.
- Authentication: choose a first-party account system, third-party sign-in (OAuth), or a managed authentication service such as Auth0 or Clerk, and define session management and the authorization model.
- Deployment target: choose Vercel, a self-hosted server, a cloud provider such as AWS/GCP/Azure, or another PaaS based on cost and operational capacity.
- Whether the cross-machine collaborative preview workflow is needed to synchronize code between development machines and provide an accessible preview environment.

## Content and product

- Scope, priority, and information architecture for the first set of content or feature modules.
- When the product or service entry point should launch and whether it should appear above the fold.
- Whether to provide user interaction such as discussions, comments, or a feedback form.

## Engineering infrastructure

- Project-level release automation decisions: before enabling Release Please, confirm the release package path, `release-type`,
  current version, whether a `bootstrap-sha` is needed and its exact value, the source of truth for versions and any version files
  that must remain synchronized, and tag rules. The scaffold must not assume that its own
  `package.json` is the product-version source for every downstream project.
- Release Please credential mode: the current generator supports either the default `GITHUB_TOKEN` (no new
  long-lived credential, but CI for bot-authored PRs requires manual approval by someone with write access and other
  downstream workflows do not trigger automatically) or a fine-grained PAT (which can trigger them automatically,
  but is a long-lived secret that must be rotated). A GitHub App installation token is a better fit for short-lived
  credentials, but requires a separate design for App parameters and token generation and is not currently supported.
  The user must confirm this choice before Release Please is enabled in a specific project. When using a PAT, record
  only the secret name and provenance, never the credential value.
- Breaking-change commit syntax: either extend the commit hook to allow `feat(scope)!:` / `fix(scope)!:`,
  or retain the current subject format and require `BREAKING CHANGE:` in the body. This choice affects the local hook,
  Release Please version calculation, and contribution documentation, so do not change the commit convention before it is confirmed.
- Test framework and scope: after selecting the technology stack, choose a test runner such as `node --test`, Vitest, or Pytest; replace the placeholder `npm test` with a real command; and consider adding a `check:test` gate to `npm run quality`.
- Dependency and lockfile policy: when adding the first third-party dependency, decide whether to commit a lockfile such as `package-lock.json` and whether CI should use `npm ci` for reproducible builds. Until then, keep the project dependency-free.
- When to split CI jobs: once the project introduces a database or another dependency on an external service, split the single `quality` job in `.github/workflows/ci.yml` into a fast job with no external dependencies (which continues to run `npm run quality`) and a slow job that starts Docker or service containers and runs migrations and integration tests. The jobs should fail independently without slowing each other down. The latter should preferably validate a complete "migrate, roll back, then migrate again" loop (up → down → up) instead of considering a single migration sufficient.
- After database migrations are introduced, if the project also maintains a design-document ledger for migration order, consider adding a machine check that treats actual migration filenames as the source of truth and verifies that the ledger stays synchronized. This prevents manually recorded sequence numbers from drifting away from the filesystem. See the [migration ledger consistency check reference script](stack-recipes/migration-ledger-check.md) for an optional implementation; it is not mandatory.

## Privacy and operations

- Whether to introduce traffic analytics; if so, choose the provider, data-retention period, and privacy disclosure.
- Whether to collect user data such as account details or email addresses; if so, define the fields, purpose, storage, and deletion method.
