# Tool Failure Handling

English | [Chinese](../rules-zh/tool-failure-zh.md)

- Stop and diagnose immediately after a tool call fails; do not retry blindly.
- Retry differently after identifying the cause by correcting parameters, choosing a suitable tool, or changing the approach.
- Never call the same tool twice in succession with identical or empty parameters.
- Record a reusable successful recovery in the Known Pitfalls section below.

## Known pitfalls

- For an edit longer than 200 lines, use bounded patches instead of constructing one oversized write. Never place more than 300 lines in one Write call.
- After an Edit failure, verify that every required parameter was actually provided.
- Do not pass `pages` when Read opens a non-PDF file, especially not an empty string, because parameter validation will reject it.
- Edit parameter names use snake_case: `file_path`, `old_string`, `new_string`, and `replace_all`, not camelCase variants.
- `old_string` must match the file byte-for-byte. Do not retype punctuation from memory:
  - Full-width and ASCII commas, parentheses, colons, and quotation marks differ even when they look similar.
  - Copy the exact source text from the Read result instead of reconstructing it.
  - After “String to replace not found,” inspect a character-level diff for punctuation, whitespace, and invisible characters. Re-read the target before retrying instead of submitting the same edit.
