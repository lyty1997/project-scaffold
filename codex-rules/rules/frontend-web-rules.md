# Frontend Web Rules

English | [Chinese](frontend-web-rules-zh.md)

Record positioning, page hierarchy, and technology choices in the relevant design first. A zero-dependency static entry point is acceptable while the stack is undecided. Record a decision before adding a framework, component library, icon library, analytics script, or third-party service.

## Content and interaction

- The first screen should explain what `__BRAND_NAME__` is.
- Keep navigation stable, concise, and scannable, with clear hierarchy for content and product entry points.
- Do not substitute complex decoration or content-obscuring animation for information hierarchy.
- Interactive pages must present applicable error, empty, loading, and insufficient-permission states.
- Include asset paths, internal links, and site entry points in the existing quality checks.

## Render verification

Run the page and verify the following for every frontend change:

- Critical desktop and mobile views are usable, with no overlapping or overflowing text.
- Navigation, anchors, buttons, and links are accessible.
- The page contains no private data, credentials, or unconfirmed product promises.

If a browser or screenshot cannot be produced, report the missing visual verification and its risk. Static checks do not replace render verification.
