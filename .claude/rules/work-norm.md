# Engineering Practice

English | [Chinese](../rules-zh/work-norm-zh.md)

## First principles

- Before building a new mechanism, search for a suitable open-source project or mature design that can be reused or adapted.

## Development workflow

- Before implementation, complete the relevant design and technical specification with the user and record it under `docs/`. Begin coding only after the required decisions are confirmed.
- Ask when a question requires confirmation; do not invent the answer.
- For every plan, assess whether its scope is excessive, insufficient, or proportionate and explain why.
- Update the relevant design after the plan is confirmed and before editing code.
- Prefer design documents no longer than 700 lines, without treating that number as a hard limit.
- After fixing a reusable bug, add its cause and solution to both known-issues documents, creating them if needed.
- Read the relevant known issues before starting work to avoid repeating a previous failure.

## Coding discipline

- Treat the user-confirmed product or architecture design as the single source of truth, then create focused module designs beneath it.
- Align an API before integrating modules: signature, field names, optionality, types and enum ranges, and error shapes.
- When upstream or downstream modules are unavailable, test each module with stubs, mocks, or fixtures and require input/output evidence before acceptance. Waiting for another module is not a substitute for isolated testing.

### Expose failures instead of planting hidden hazards

**Do not add redundant fallbacks merely to deliver on time. Expose the problem and solve its root cause.** Graceful error handling is not a pile of fallbacks: degradation must stay visible and must not pretend success or discard data silently.

- **Never swallow exceptions silently.** `except Exception: pass`, broad `suppress(Exception)`, and empty `catch {}` blocks are anti-patterns. Handle, rethrow, or at minimum log a warning that makes the failure visible.
- **Catch the narrow expected exception.** A broad catch also hides programming defects such as misspellings and type errors, misrepresenting them as handled failures.
- **Never substitute fake data or an empty result for success.** An empty model response, missing page or image, or unreadable file must be collected under `skipped`, `missing`, or `error` and exposed through the result or logs instead of entering downstream caches as success.
- **Surface critical failures to the user.** Do not leave them only in server logs. Put them in `result.error`, task status, or visible UI feedback. Frontend catches distinguish expected states such as a quiet 404 from real errors reported through `setError` or `console.error`.
- **Leave evidence of degradation.** If fallback to local inference or original text is truly required, log what changed and how the result differs from the request, and show a soft warning when possible.
- **Before delivery, ask whether a fallback degrades gracefully or hides an unresolved bug.** Stop and repair the root cause when it does the latter.

## Frontend development

### Mandatory visual verification

After every UI change:

1. Confirm the development server is running with `npm run dev`.
2. Run `node scripts/screenshot.js http://localhost:3000/changed-page`.
3. Inspect `screenshots/current.png`.
4. Fix visible defects and capture again.
5. Continue until the render is correct.

A UI change without screenshot verification is incomplete.

## Version control

- Commit each feature as a focused change so it can be reviewed and reverted independently.

## Task handoff

- At completion or interruption, update both `docs/progress.md` and `docs/progress-zh.md` with a timestamp, topic, completed work, and remaining issues.
- Update the project's maintained Agent memory when applicable.
- For an important change, record meeting notes and update the requirements or design documents.
