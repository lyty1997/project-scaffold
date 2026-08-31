# Project-local changes

Upstream: `https://github.com/tt-a1i/archify`

Pinned commit: `4ac500a498267f18bda42b3c82b51edb8f9c1baf`

Upstream package version: `2.16.0-dev.0`

This vendored Skill differs from the pinned upstream package in four intentional ways:

1. `assets/template.html` does not load Google Fonts. Generated artifacts use the existing system-font fallback stack and make no font-network request; the five bundled rendered examples were regenerated from this offline template.
2. `SKILL.md` disables the automatic update-awareness step. Updates are explicit repository maintenance work, not a side effect of authoring a diagram.
3. `SKILL.md` and `references/delivery-contract.md` require committed documentation PNGs to use the Viewer-native canonical **Export → PNG** path; `visual-check` screenshots remain temporary evidence only.
4. `SKILL.md` routes explicit PlantUML and Markdown-inline requests to the project `plantuml-in-markdown` workflow, while retaining Archify for standalone interactive and presentation artifacts.

The upstream MIT license is preserved in `LICENSE`. Reapply and revalidate these changes whenever the pinned source is updated.
