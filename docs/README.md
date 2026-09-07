# __PROJECT_NAME__ Documentation

English | [Chinese](README-zh.md)

This directory is the source of truth for project positioning, architecture, the content model, product and service evolution, and quality gates. Before changing public page structure, content sections, product services, user data, deployment, or CI, update the corresponding document here.

## Documentation index

- [Project progress](progress.md)
- [Technical article: AI Coding Scaffold—From One Conversation to a Reusable Engineering Loop](sharing/ai-coding-scaffold.md)
- [Architecture overview](architecture/overview.md)
- [Quality gates](architecture/quality-gates.md)
- [Agent prompt design and reduction assessment](architecture/agent-prompts.md)
- [Diagram system: Archify + PlantUML](architecture/diagram-system.md)
- [Portable single-file documents](architecture/portable-documents.md)
- [Language and localization](architecture/localization.md)
- [Glossary](architecture/glossary.md)
- [Open decisions](architecture/open-decisions.md)
- [Cross-machine collaborative development preview workflow](architecture/dev-workflow.md)
- [Automated CI/CD setup](architecture/cicd-autosetup.md)
- [Sibling repository rule-synchronization ledger](architecture/sibling-repo-sync.md) (private notes for the repository owner, not general scaffold content)
- [Content and product roadmap](product/content-roadmap.md)
- [Contract term registry](contracts/contract-terms.json)
- [Contract scanning rules](contracts/contract-rules.json)
- [Static-site checks](contracts/site-checks.json)
- [Pinned Archify contract](contracts/archify.json)
- [Technology stack reference recipes](architecture/stack-recipes/README.md): [Python](architecture/stack-recipes/python.md), [TypeScript](architecture/stack-recipes/typescript.md), and [migration consistency gate](architecture/stack-recipes/migration-ledger-check.md)

## Find a document by question

| I want to know... | Read... |
| --- | --- |
| What stage the project is in and what this release does or does not include | Current Stage in this file |
| The overall system structure, directory responsibilities, and module boundaries | [Architecture Overview](architecture/overview.md) |
| The precise meaning of a term or abbreviation | [Glossary](architecture/glossary.md) |
| Which technical or product decisions remain open | [Open Decisions](architecture/open-decisions.md) |
| The plan and boundaries for content sections and product services | [Content and Product Roadmap](product/content-roadmap.md) |
| How to preview and synchronize local development across machines | [Cross-Machine Collaborative Development Preview Workflow](architecture/dev-workflow.md) |
| Where brand names, status enums, and other contract terms come from and how to change them | [Contract Term Registry](contracts/contract-terms.json) and [Contract Scanning Rules](contracts/contract-rules.json) |
| What `npm run quality`, diagram checks, and local hooks do | [Quality Gates](architecture/quality-gates.md) |
| How to choose Archify or PlantUML and validate each artifact type | [Diagram System: Archify + PlantUML](architecture/diagram-system.md) |
| How to export Markdown with local illustrations as a single portable file | [Portable Single-File Documents](architecture/portable-documents.md) |
| How CI/CD is detected, generated, validated, and connected to project releases | [Automated CI/CD Setup](architecture/cicd-autosetup.md) |
| Which operating rules an Agent must follow while performing a task | Root [AGENTS.md](../AGENTS.md) and the [Codex Rule Index](../codex-rules/global-AGENTS.md) |

## Current stage

- Stage: __describe the project's current stage here__.
- Scope: __state clearly what this release includes__.
- Non-goals: __state clearly what this release does not include__.

## Documentation maintenance requirements

- After adding a Markdown file under `docs/`, add it to the matching language index in this directory.
- When changing routes, navigation, content sections, product services, or deployment, update the relevant design documents at the same time.
- Record uncertain items in [Open Decisions](architecture/open-decisions.md) rather than scattering them through code comments.
