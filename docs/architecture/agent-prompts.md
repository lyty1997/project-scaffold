# Agent Prompt Design

English | [Chinese](agent-prompts-zh.md)

Status: active
Last updated: 2026-09-07
Applies to: repository-owned workflow, rules, and Skill instructions; primary model `gpt-6-astra`

## Goal and evidence

Reduce unnecessary context, conflicting instructions, and routine approval pauses while preserving project constraints and verifiable delivery. The model target comes from the user; this change does not configure a model or reasoning level.

OpenAI's Astra guidance identifies sensitivity to conflicting Skill instructions, unnecessary clarification, and excessive testing of small changes. This supports removing duplicate procedures and making task boundaries explicit; it does not establish a speedup for this repository. [GPT-6 Astra prompting guidance](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-6-astra#prompting-best-practices).

Codex loads project `AGENTS.md` through its instruction discovery chain. Skills initially expose metadata and load their body when selected. Consequently, total repository prose is different from context loaded for a task. [AGENTS.md discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [Skill loading](https://learn.chatgpt.com/docs/build-skills).

## Loading and ownership

| Layer | Owner and loading boundary |
| --- | --- |
| Host instructions, user preferences, installed Skills | Outside this repository; project edits cannot remove their context or change their precedence. |
| Project constraints | `AGENTS.md`; `CLAUDE.md` imports it. Keep shared constraints here once. |
| Task routing | `codex-rules/global-AGENTS.md`; read only matching rules. Claude rules point to the same canonical rules instead of duplicating them. |
| Design facts and history | `docs/README.md` routes to relevant designs. Read applicable sections, one language for background, and only needed history; inspect both languages when editing a pair. This assessment is for prompt maintenance, not routine task startup. |
| Specialized execution | A selected `SKILL.md` owns its procedure. Rules route to it; scripts and quality gates own deterministic validation. |
| Claude hooks | `.claude/settings.json` invokes edit validation, stack checks, and the CI/CD reminder. They add tool-result diagnostics; their code and configuration remain unchanged. |
| Archify | The tracked `.agents/skills/archify/SKILL.md` bridges to the pinned `.claude/skills/archify/` implementation. Other repository Skills can be read at their explicit paths; do not assume `.claude/skills` supplies native Codex discovery. |

The current environment obscures tracked `.agents` files with a read-only mount. Its installed Skill catalog is a separate surface. This task leaves the bridge and installed Skills unchanged; fresh-session discovery remains an environment check.

## Assessment and decisions

- Root principles, Codex workflow, and Claude engineering rules repeat design, confirmation, testing, and handoff requirements. Keep the six reasoning principles in concise form at the root; focused workflow rules add only cross-module sequencing and evidence.
- Claude's duplicated CI/CD, Git, issue, language, diagram, and failure rules can drift from Codex. Preserve their entry paths as short conditional pointers to canonical rules. Keep stack and resource guidance concise; exact tool settings remain optional stack recipes and actual project configuration.
- Remove unsupported universal procedures: nonexistent `scripts/screenshot.js` and `npm run dev`, mandatory library adoption, invented Tester/Reviewer roles, blanket coverage targets, and fixed process-killing recipes. Preserve actual render verification, boundary validation, lifecycle ownership, and applicable configured checks.
- Skills keep precise descriptions, necessary commands, failure conditions, and output evidence. Remove repeated trigger lists, explanatory tutorials, and completion lists that duplicate their workflow. CI/CD ownership and green-run criteria have one canonical rule; release schema details already live in the CI/CD design and renderer.
- Reuse session authorization and verified project facts. Ask only for a missing user-owned decision or additional permission, after preparing the authorized reviewable work. A Skill cannot authorize a commit, push, publication, or cross-repository write by itself. CI/CD framework maintenance does not require target-project setup.
- Preserve the vendored Archify package and digest. Its long entry is loaded for diagram work and contains version-specific geometry and delivery constraints. Changing that pinned package would require a separate vendor validation loop; this reduction targets first-party prompts and duplicated diagram guidance.

## Verification and ablation

Use a snapshot of the existing worktree, including its uncommitted changes, as the baseline. Compare one layer at a time: root/workflow, focused rules and Claude pointers, then first-party Skills. Count UTF-8 bytes, not estimated model tokens. Apply the same acceptance scenarios at each stage; check the resulting route and retained constraints manually, then run existing repository gates and Skill metadata validation. This is a source-level comparison, not an independent model-behavior evaluation.

| Scenario | Required outcome |
| --- | --- |
| Read-only explanation or small documentation fix | Load relevant context; no mandatory design proposal, new issue, stack adoption, or repeated approval. |
| Bug fix in a dirty worktree | Preserve unrelated changes; diagnose the failure, run applicable checks, and record reusable findings once. |
| UI change | Use the project's real commands and inspect an actual desktop/mobile render; report unavailable evidence. |
| Cross-module change | Establish shared interfaces and normal/error input-output evidence before integration. |
| CI/CD framework maintenance | Read the design and run framework gates without requiring a target ledger or remote probe. |
| Target CI/CD delivery | Probe first; preserve ledger ownership, manifest state, authorization boundaries, deployment rehearsal, and exact-SHA job/step evidence. Unknown remote state cannot pass. |
| Diagram or image inspection | Choose the matching capability; preserve one diagram source and real compilation/export evidence. Image previews never replace scientific input. |
| Rule edit with sibling repositories | Editing a reusable rule alone does not authorize synchronization, commits, or pushes elsewhere. |

## Measured result

Counts use the 2026-09-07 task-start worktree, after the existing English-only cleanup. They do not attribute earlier translation deletions to this task. The first-party corpus is `AGENTS.md`, `CLAUDE.md`, Markdown in `codex-rules/`, `.claude/rules/*.md`, and the four first-party Skill entries. Designs, progress records, scripts, host prompts, installed Skills, and unchanged Codex bridge metadata are outside these counts.

| Compared instruction surface | Before (UTF-8 bytes) | After | Reduction |
| --- | --- | --- | --- |
| Root, router, and complex workflow | 10,328 | 6,420 | 37.8% |
| Focused rules and Claude entries | 50,955 | 14,873 | 70.8% |
| Four first-party Skill entries | 23,505 | 9,001 | 61.7% |
| First-party corpus, including Known Issues | 90,672 | 36,538 | 59.7% |
| Same corpus plus the pinned Archify entry | 107,105 | 52,971 | 50.5% |

The root/router/Markdown-rule route falls from 11,270 to 7,264 bytes (35.5%); its unchanged documentation index and selected designs are additional context. Claude's root/import/all-rule source bodies fall from 39,237 to 9,531 bytes (75.7%), before following conditional links. Neither figure measures an actual session payload.

Manual review of the eight scenarios retained the required boundaries after each layer reduction. It also caught an overbroad “read one language” instruction, now limited to background reading so translation edits can inspect both files. Specialized CI/CD state ownership and diagram compilation/export requirements remain explicit because removing them would lose acceptance criteria.

Verification: `npm run quality` passed outside the managed sandbox after nested CI/CD fixture processes were denied with `EPERM` inside it. All four first-party Skills passed `skill-creator` metadata validation. A synthetic uint16 TIFF stored with a `.jpg` extension exercised the image helper from a temporary `scripts/` directory: it produced a 1280×853 grayscale preview in temporary output and preserved the source hash. No scripts, dependencies, runtime UI, CI workflows, or vendored files changed.

## Remaining uncertainty

Actual Astra task latency, model token usage, unnecessary question frequency, and completion quality have not been measured. A follow-up comparison should replay representative tasks with the same model settings, tools, task inputs, and acceptance criteria, changing only the prompt version. Source-size reductions establish a smaller instruction surface, not a measured runtime improvement. This change adds no user-data collection or third-party service.
