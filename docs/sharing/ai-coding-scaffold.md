# AI Coding Scaffold: From One Conversation to a Reusable Engineering Loop

English | [Chinese](ai-coding-scaffold-zh.md)

Status: ready for public release

Last updated: 2026-08-30

Applies to: technology-neutral AI coding scaffold design, reuse, and evolution

> Abstract: The hard part of AI coding is shifting from "can it generate code?" to "can it understand the project, respect its boundaries, and complete verification?" This article presents a technology-neutral engineering scaffold: documents retain project facts, layered rules assemble Agent context, deterministic scripts perform mechanical work, and local gates plus CI close the feedback loop.

## From generating code to maintaining a project

When I first started using AI for coding, I focused on whether I could describe a requirement clearly and whether the generated function would run. As projects grew, a different set of problems became recurring sources of friction:

- The model did not know why the project had been designed a certain way.
- The same convention was scattered across conversations, documents, and code, eventually contradicting itself.
- The model completed a change without proving that the documentation, implementation, tests, and CI still agreed.
- Every new project required me to explain directories, naming, commit format, safety boundaries, and delivery standards from scratch.

That changed my goal from "improve the quality of one code-generation attempt" to **put every coding task into a traceable, verifiable, reusable engineering loop**.

This scaffold acts more like an engineering control plane between AI and a project. It does not prescribe React, Vue, Python, or C++, and it does not make product decisions for the project owner. It organizes project facts, collaboration boundaries, execution entry points, and verification evidence.

As of 2026-08-30, the repository remains an uninitialized general-purpose template. Implemented capabilities include the initializer, documentation and contract gates, Agent rule routing, Git hooks, general CI, optional cross-machine preview, interactive Archify diagrams, CI/CD detection, ledger-driven generation, and local gates. It does not preinstall an application framework, `npm test` remains a placeholder, and the CI/CD and Release paths still lack remote acceptance in a concrete greenfield project. The implementation boundary can be traced through the [Scaffold Guide](../../SCAFFOLD.md), [Quality Gates](../architecture/quality-gates.md), [Diagram System](../architecture/diagram-system.md), and [Automated CI/CD Setup](../architecture/cicd-autosetup.md).

## Turning prompts into repository assets

A sufficiently detailed prompt can help a model complete a short task, but it cannot manage the context of a long-lived project on its own:

- A prompt easily falls behind the project's current state.
- Natural language can describe what *should* happen but cannot prove that it did happen.
- Information in one conversation may not be reusable by the next session or collaborator.

My approach is to split what was previously scattered through conversations into four layers of repository assets.

[![Static preview of the four-layer AI coding scaffold architecture](../diagrams/ai-scaffold-layers.archify.png)](../diagrams/ai-scaffold-layers.archify.html)

[Open the interactive architecture diagram](../diagrams/ai-scaffold-layers.archify.html) · [View the Typed JSON diagram source](../diagrams/ai-scaffold-layers.architecture.json)

These layers are not merely categories of documents. They form a dependency chain from project facts to verification evidence.

### 1. Project truth layer: tell the model what is true

`docs/` is not a manual written after implementation. It is the source of truth for project positioning, architecture, product boundaries, and deployment decisions. Its contents distinguish four categories:

- **Facts:** statements already supported by the repository, a script, or an authoritative external source.
- **Decisions:** directions explicitly selected by the project owner.
- **Plans:** capabilities the project intends to build but has not delivered.
- **Open choices:** matters only the project owner can decide and that an Agent must not guess.

This distinction prevents a model from rewriting "we plan to add comments" as "comments are supported." It also prevents a temporary technical preference from silently becoming a project decision.

### 2. Agent context layer: load rules without filling the context window

The root `AGENTS.md` contains only boundaries that apply to every task, such as reading the source of truth first, protecting existing changes, updating documentation before implementation, and verifying the result.

More specific rules load by task through an index: Markdown work loads documentation rules, CI/CD changes load CI/CD rules, and privacy work loads security and privacy constraints. The goal is not to maximize the number of rules, but to keep **stable rules resident while loading scenario-specific rules only when needed**.

### 3. Engineering execution layer: assign mechanical work to deterministic scripts

Models are good at understanding goals, analyzing tradeoffs, and proposing solutions. Scripts are usually more reliable at batch-replacing placeholders, scanning files, rendering configuration, and checking paths.

The scaffold therefore includes the initializer, quality scripts, preview scripts, and CI/CD detector and renderer. The Agent decides when to invoke them, and the scripts return deterministic results. Each handles the work it does best.

### 4. Executable feedback layer: turn "should" into "fail when it does not"

Writing "do not leak secrets," "do not break internal links," and "a changed diagram must compile" in documentation alone provides limited enforcement.

The scaffold turns high-value constraints that can be evaluated reliably into executable checks:

- Markdown links and documentation indexes;
- contract scans for brand names, status enums, and forbidden legacy names;
- common credential patterns;
- static-site entry points and relative resources;
- Archify Typed JSON `showcase` validation, interactive HTML freshness, and real-browser visual review;
- workflow safety boundaries and actionlint semantic checks;
- the same quality baseline in pre-commit and remote CI.

The Agent can then return actionable failure information or passing evidence alongside the result, instead of only saying that the change is done.

## Putting one task into a verifiable loop

Repository layers determine where information belongs. The task loop determines how that information participates in a real change.

[![Static preview of the shortest AI coding task loop](../diagrams/ai-scaffold-task-loop.archify.png)](../diagrams/ai-scaffold-task-loop.archify.html)

[Open the interactive workflow](../diagrams/ai-scaffold-task-loop.archify.html) · [View the Typed JSON diagram source](../diagrams/ai-scaffold-task-loop.workflow.json)

The key is not simply "write documentation first." It is the decision gate before implementation.

For example, the repository may prove that no database exists today; that is a fact. Whether the project needs a database is a decision. Adding an account system later is a plan. A model can inspect facts and analyze options, but it must not combine the latter two into an implementation that has already been approved.

When verification fails, the loop does not hide the issue behind a fallback that merely makes the command run. It preserves the real error and continues toward the root cause. In AI coding, a high-quality error message is valuable context: it moves the next change from guessing to diagnosis.

## The repository foundation

The scaffold's directories are organized around facts, rules, automation, and evidence rather than a particular application framework.

```text
project/
├── AGENTS.md                 # Project boundaries that every Agent always follows
├── CLAUDE.md                 # Claude Code entry point importing the shared rules
├── docs/
│   ├── README.md             # Documentation index
│   ├── architecture/         # Architecture, quality gates, workflows, and open decisions
│   ├── contracts/            # Machine-readable stable terms and scanning rules
│   ├── product/              # Content and product boundaries
│   └── progress.md           # Completion evidence and remaining work
├── codex-rules/              # Rules Codex loads according to the task
├── .claude/                  # Claude Code rules, hooks, and Skills
├── scripts/
│   ├── init.mjs              # Initialization and placeholder replacement
│   ├── quality/              # Dependency-free baseline quality gates
│   ├── dev/                  # Optional synchronization and cross-machine preview
│   └── cicd/                 # CI/CD detection and ledger-driven rendering
├── .githooks/                # Pre-commit and commit-message gates
├── .github/workflows/        # Remote CI
└── package.json              # Implementation source of truth for commands
```

Three main tradeoffs shape this structure.

### 1. More documents are not inherently better; each kind of fact needs one source

The architecture overview contains only the system outline and links. Detailed CI/CD behavior belongs in the CI/CD design, while current command behavior belongs in `package.json` and workflows. Higher-level documents do not copy lower-level details, preventing both descriptions from aging together.

### 2. JSON records decisions; generated files are artifacts

Contract terms, site checks, and project-level CI/CD decisions fit machine-readable JSON. In CI/CD, project-specific commands, deployment targets, and secret names come from the decision ledger, while the renderer produces YAML in one direction.

This avoids maintaining a catalog of finished "language × deployment platform" workflow templates in the scaffold, and it avoids asking a model to improvise an entire workflow every time. The renderer hard-codes the safety skeleton that does not change with the technology stack; a concrete project confirms the commands and targets that do change.

### 3. Local and remote checks should speak the same language

Local pre-commit invokes `npm run quality`, and remote CI invokes the same command. Specialized gates such as Archify artifact checks and actionlint workflow semantics run in separate CI jobs. Light- and dark-theme diagram review uses a real browser separately.

This removes a common source of friction: local tooling says a change passed while remote CI applies a different hidden rule set.

## Migrating the scaffold into a new project

Reusing this scaffold does not mean copying the directory and immediately writing application code. The more important work is to replace template identity and example facts with the new project's own content, then decide which optional capabilities have real value.

[![Static preview of the AI coding scaffold reuse workflow](../diagrams/ai-scaffold-reuse-flow.archify.png)](../diagrams/ai-scaffold-reuse-flow.archify.html)

[Open the interactive workflow](../diagrams/ai-scaffold-reuse-flow.archify.html) · [View the Typed JSON diagram source](../diagrams/ai-scaffold-reuse-flow.workflow.json)

The migration has four stages.

### 1. Complete mechanical initialization

```bash
npm run init
git config core.hooksPath .githooks
npm run quality
```

The initializer collects the project identifier, display name, one-line positioning, GitHub details, and copyright owner. It also asks whether to retain cross-machine preview and whether to address CI/CD now. It then replaces uppercase placeholders wrapped in double underscores and runs the baseline quality checks.

This step performs structured placeholder replacement only. It cannot decide product positioning or technology choices automatically. The real project must still confirm what the current stage includes, what the first release explicitly excludes, why it selects a framework, and similar decisions.

### 2. Make `docs/` describe the real project

At minimum, a new project must complete:

- project goals, target users, current stage, scope, and non-goals;
- current architecture and directory responsibilities;
- information architecture for the first features or content;
- open choices around the technology stack, deployment, authentication, data, and privacy;
- confirmed terms, status enums, and cross-module contracts.

Only then does an Agent read project context rather than template examples.

### 3. Align machine checks with real constraints

The baseline gates remain useful, but example configuration must not be retained unchanged:

- replace brands, enums, and stable names in `contract-terms.json`;
- replace scan roots, forbidden legacy names, and scoped rules in `contract-rules.json`;
- replace the example entry point and required fragments in `site-checks.json` with the project's real values;
- add the formatter, lint, type checking, tests, and build after selecting a stack;
- consider migration-order consistency only after introducing database migrations;
- choose a lockfile and reproducible installation policy only after adding third-party dependencies.

### 4. Remove modules without a real use case

Cross-machine preview, database migration checks, strict configuration for a particular language, and release automation are not universal defaults.

If development happens on one machine, remove the cross-machine preview documentation and scripts. If no database exists, there is no reason to retain a migration gate. If the deployment target is unresolved, record the open decision instead of generating CD with nothing to accept.

## What must not be copied blindly

For reuse, scaffold content falls into mechanisms, facts, and optional capabilities. The most dangerous mistake is not a missed name; it is treating a template fact as a universal mechanism.

| Category | Treatment | Typical contents |
| --- | --- | --- |
| General mechanism | Keep first, then refine in response to real friction | Layered sources of truth, rule routing, decision gates, progress records, failures that never pass silently, and a shared local/CI baseline |
| Project fact | Replace rather than copying from the template | Positioning, architecture, stage, directories, brand terms, status enums, scan paths, user data, and deployment targets |
| Optional capability | First identify a real consumer | Cross-machine preview, Python/TypeScript recipes, database migration gates, CI/CD, and Release Please |

The following checklist supports a new project's first adaptation.

### Project and product

- Project name, brand name, and one-line positioning;
- target users, first-release scope, and explicit non-goals;
- public pages, content sections, routes, and SEO;
- which capabilities are delivered and which remain plans;
- whether comments, forms, subscriptions, accounts, or other user data exist.

### Architecture and code

- Actual technology stack and the reason for choosing it;
- source directories, module boundaries, and contracts;
- formatting, linting, types, unit tests, integration tests, and build commands;
- database, cache, authentication, and migration strategy;
- dependency and lockfile policy.

### Collaboration rules

- Which changes require documentation first;
- whether branch, commit-message, and PR rules fit the team;
- what language the UI and comments use;
- which directories or generated files must not be edited manually;
- how far an Agent may proceed automatically and which operations require human authorization.

### Runtime and delivery

- Whether local preview runs on one machine or across machines;
- which operating systems and runtimes CI covers;
- deployment target, environment, credential mode, and rollback capability;
- version source of truth, tag rules, and Release cadence;
- which platform settings require manual configuration.

"Rollback capability" must reflect the real platform. Sites and containers can generally redeploy an old version, while a package already published to npm or PyPI cannot erase history. It can only receive a corrective release while the old version is deprecated or withdrawn. Preserving those differences in the design is more maintainable than claiming one-click rollback everywhere.

## How the scaffold should evolve as foundation models improve

Improvements in foundation models do not imply that `AGENTS.md` should keep growing. Stronger reasoning, context handling, and tool use create room to make the rules thinner.

The scaffold can gradually move from detailed instructions for every step toward real goals, inviolable boundaries, and verifiable evidence.

[![Static preview of the scaffold's evolution as foundation models improve](../diagrams/ai-scaffold-evolution.archify.png)](../diagrams/ai-scaffold-evolution.archify.html)

[Open the interactive architecture diagram](../diagrams/ai-scaffold-evolution.archify.html) · [View the Typed JSON diagram source](../diagrams/ai-scaffold-evolution.architecture.json)

That evolution has five directions.

### 1. Move from accumulating rules to thinning rules

As model understanding improves, many tutorial-style steps can disappear, leaving project goals, safety boundaries, critical invariants, and acceptance criteria.

A rule deserves to remain resident when it applies across tasks. Details needed only for a few scenarios should load through an index, Skill, or tool. This reduces context noise and conflicts between rules.

### 2. Move from feeding whole documents to assembling context for the task

An Agent can locate relevant designs, historical decisions, known issues, and tests from the file, module, and task type instead of reading the entire documentation set for every task.

Clear ownership, status, and scope for every source matter more than vector retrieval itself. If the repository contains three contradictory architecture descriptions, stronger retrieval only finds the contradiction faster.

### 3. Move from code that passes locally to real-environment evidence

More reliable tool use can extend the loop into real environments: generate configuration, create temporary branches, observe CI, read failure logs, and verify again after a fix.

Full automation is still constrained by permission and platform boundaries. When a step requires browser authorization, a long-lived credential, or a production-state change, the scaffold should define a clear pause rather than disguise an authorization issue as a technical one.

### 4. Govern rules with evaluation instead of intuition

Classify each failure by cause:

- missing project facts;
- unclear rule wording;
- a prose-only constraint without an executable check;
- a check that produces false positives or varies across environments;
- failed model reasoning or tool use.

Each cause belongs in a different improvement layer. Add a machine check when links are repeatedly missed. Split or remove a rule that repeatedly conflicts. For diagrams, separate stable criteria from environment-dependent criteria: Typed JSON and interactive HTML support `showcase` validation and deterministic freshness checks, while browser PNG output depends on system fonts and rendering. Retain real visual-review evidence without comparing bytes across machines.

### 5. Parallel Agents become more useful, but ownership must become clearer

As models and tool orchestration improve, different Agents can inspect documentation, implement, test, and review in parallel.

The missing ingredient is not an instruction to "use more Agents." It is explicit task boundaries, file ownership, shared resources, result integration, and acceptance evidence. Without them, parallel work turns single-threaded conflict into multithreaded conflict.

Regardless of model capability, **project facts, authorization boundaries, and verification evidence** remain necessary. The more independently a model can act, the more important those three forms of engineering information become.

## Evolving the scaffold from real problems

I prefer to evolve the scaffold in response to problems observed in real projects rather than collecting every rule that might someday be useful. The process is:

1. Collect recurring problems from real projects.
2. Decide whether each problem is project-specific or a mechanism shared by several projects.
3. Record anything that documentation can explain in the single source of truth.
4. Promote what a machine can judge reliably into a gate or generator.
5. After a new rule has run for a while, check it for false positives, duplication, and obsolescence.
6. Remove tutorial-style rules whose guarantees have moved into scripts, preventing endless context growth.

The goal is not to make the scaffold larger. It is to preserve the right information in the right place and load it into Agent context when needed.

## Conclusion: the reusable asset is the engineering loop

This AI coding scaffold does not select a technology stack for me or promise that a model can complete every task independently. What it makes reusable is:

- one traceable source for every project fact;
- a separation between user decisions, verifiable facts, and future plans;
- only the rules an Agent needs for the current task;
- deterministic work assigned to scripts whenever practical;
- high-value constraints promoted into executable gates whenever practical;
- every task ending with verification evidence and remaining work.

My current view of AI coding is that the foundation model sets the capability ceiling, project context determines whether it understands the situation, and the feedback loop determines whether results can be delivered reliably.

A scaffold is not built to constrain the model. It connects model capability to the project. As foundation models improve, rules can become thinner, context more precise, and automation can extend through a longer delivery chain. Project facts, human decisions, and real verification remain the foundation.

## Implementation and further reading

- [Scaffold Guide](../../SCAFFOLD.md): how to use the repository for the first time.
- [Project-level Agent Rules](../../AGENTS.md): boundaries that always apply.
- [Codex Rule Index](../../codex-rules/global-AGENTS.md): how task-specific rules load.
- [Documentation Entry Point](../README.md): how project sources of truth are organized.
- [Quality Gates](../architecture/quality-gates.md): what local checks and CI actually validate.
- [Automated CI/CD Setup](../architecture/cicd-autosetup.md): detection, ledger, rendering, and remote acceptance boundaries.
- [`package.json`](../../package.json): the implementation source of truth for current executable commands.

## Frequently asked questions

### How is this different from writing one long system prompt?

A prompt primarily affects one session. The scaffold retains project facts, rules, scripts, and verification in a repository where they can be versioned, reviewed, executed, and reused. They are complementary: repository assets ultimately still enter model context through an Agent entry point.

### Can too many rules reduce model performance?

Yes. That is why the scaffold keeps root rules short, routes topic rules on demand, and moves machine-checkable constraints out of natural-language context. Rule governance is itself part of long-term scaffold maintenance.

### Does it still work with a completely different technology stack?

The general mechanisms remain reusable, but stack facts and quality commands must be reconfigured. That is why the repository does not preinstall a frontend or backend framework and provides only optional Python and TypeScript reference recipes.

### Do we still need a scaffold once foundation models are strong enough?

Its form will change. Step-by-step rules will decrease while context assembly and automated verification improve. Facts, permissions, tests, and delivery evidence do not disappear simply because the model becomes smarter.
