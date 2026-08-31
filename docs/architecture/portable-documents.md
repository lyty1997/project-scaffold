# Portable Single-File Documents

English | [Chinese](portable-documents-zh.md)

Status: active

Last updated: 2026-08-31

Applies to: `docs/**/*.md` files that need to be copied, shared, or archived independently of the repository directory structure

## Decision

Markdown files in the repository continue to reference Archify's native PNG, interactive HTML, and Typed JSON artifacts for maintainability and traceability. When a document needs to travel outside the repository, a deterministic export command generates a self-contained HTML file. The portable HTML encodes local raster images as `data:` resources, so readers can move one file without also copying `docs/diagrams/`.

Portable HTML is a local export under `build/portable-docs/`, managed by `.gitignore`. It is not a new source of truth and is not committed. Markdown remains the only editable source for prose, while repository-native Viewer PNG files remain the authoritative images.

## Tool choice

The generation step uses a locally installed Pandoc 2.12 or later to parse GFM Markdown. Pandoc covers the headings, lists, tables, code blocks, block quotes, links, and images used by the existing documents without requiring the scaffold to maintain an incomplete custom Markdown parser.

Pandoc is only a local generation tool:

- It is not added as an npm dependency and does not alter the dependency-free Node.js 22 baseline for `npm run quality`.
- The CI gate for portable export uses pure-Node fixtures and does not require Pandoc.
- Export rejects remote images, path escapes, symlinks, and active content formats, and it does not access the network.
- Artifacts use system fonts and inline CSS without loading fonts, scripts, analytics, or a CDN.

## Input, output, and link semantics

By default, the command scans every `docs/**/*.md` file that actually contains inline Markdown syntax for a local image. One or more document paths can also follow `--` to export only those documents.

```bash
npm run export:portable-docs
npm run export:portable-docs -- docs/sharing/ai-coding-scaffold.md
```

Output preserves the path relative to `docs/` but writes it under an ignored directory:

```text
docs/sharing/ai-coding-scaffold.md
  -> build/portable-docs/sharing/ai-coding-scaffold.html

docs/architecture/overview.md
  -> build/portable-docs/architecture/overview.html
```

The portable format has one defining boundary: it must remain readable as a single file.

- Local PNG, JPEG, WebP, and GIF images are embedded byte for byte, with their alt text preserved.
- In-page `#anchor` links and `https://`, `http://`, `mailto:`, and `tel:` links remain clickable.
- Repository-local interactive HTML, Typed JSON, and other relative links become non-clickable text that shows the original path, avoiding links that only appear usable after the file is moved.
- Interactive HTML and JSON are not embedded into the portable version. Use the repository's three-part artifact set when search, path tracing, theme switching, or continued editing is required.

## Security and size boundaries

The exporter accepts only regular Markdown files within the repository and regular raster images within the repository. Each image must pass a real-path check and cannot be a symlink. An individual image cannot exceed 16 MiB, and all images in one document cannot exceed 32 MiB. The following inputs are rejected:

- HTTP(S), protocol-relative, `data:`, or other remote or inline image targets;
- absolute paths, `..` paths that escape the repository, query parameters, and URL fragments;
- SVG, HTML, scripts, iframes, objects, and other resources that can carry active content;
- Markdown with no images or with empty image alt text.

Generated HTML must satisfy all of these conditions: every `<img src>` is a `data:image/...;base64` value whose decoded bytes equal the original image; no local `src`, local `href`, external stylesheet, script, iframe, or CSS link remains. The artifact records the input digest, source path, image count, and Pandoc version, and the exporter revalidates those receipts before writing the file.

## Verification

- `npm run check:portable-docs`: pure-Node positive and negative fixtures that verify image discovery, input digests, byte-identical embedding, local-link stripping, and path and protocol boundaries.
- `npm run export:portable-docs`: writes each candidate to a temporary file first and atomically replaces the output only after the complete integrity check succeeds; a failure preserves the old artifact.
- After changing the template, styles, filter, or exporter, open the result at representative desktop and mobile viewports. Confirm that prose, tables, code blocks, and images do not overflow, and that the browser makes no local or network resource requests.

The current capability adds no user-data collection, telemetry, runtime third-party service, or persistent credential.
