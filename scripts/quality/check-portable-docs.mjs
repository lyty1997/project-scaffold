import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  checkPortableHtml,
  findMarkdownImages,
  findPortableSources,
  inspectPortableSource,
  portableOutputPath,
} from "./lib/portable-docs.mjs";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=",
  "base64"
);

function expect(condition, message, errors) {
  if (!condition) errors.push(message);
}

function expectThrow(action, pattern, message, errors) {
  try {
    action();
    errors.push(`${message}: no error was thrown`);
  } catch (error) {
    if (!pattern.test(error.message)) errors.push(`${message}: unexpected error: ${error.message}`);
  }
}

function fixtureHtml(receipt, imageBytes) {
  return `<!doctype html>
<html lang="${receipt.locale}">
<head>
  <meta name="portable-source" content="${receipt.sourceRelative}">
  <meta name="portable-input-sha256" content="${receipt.inputSha256}">
  <meta name="portable-image-count" content="${receipt.images.length}">
  <meta name="portable-pandoc-version" content="2.12">
  <style>body { color: #111; }</style>
</head>
<body>
  <h1 id="fixture">Fixture</h1>
  <a href="#fixture">In-page</a>
  <a href="https://example.com">External</a>
  <span class="portable-local-link" data-original-href="local.md">Local</span>
  <img src="data:image/png;base64,${imageBytes.toString("base64")}" alt="Valid image">
</body>
</html>
`;
}

const errors = [];
const fixtureRoot = mkdtempSync(resolve(tmpdir(), "portable-doc-check-"));
try {
  const docs = resolve(fixtureRoot, "docs");
  const imagePath = resolve(docs, "image.png");
  const sourcePath = resolve(docs, "fixture.md");
  const englishSourcePath = resolve(docs, "fixture-en.md");
  const outputPath = resolve(fixtureRoot, "fixture.html");
  const chineseLocaleMarker = "中文"; // localization-allow-cjk
  mkdirSync(docs, { recursive: true });
  writeFileSync(imagePath, ONE_PIXEL_PNG);
  writeFileSync(
    sourcePath,
    `# Fixture

\`![Ignore in inline code](missing.png)\`

\`\`\`markdown
![Ignore in fenced code](missing.png)
\`\`\`

${chineseLocaleMarker} 😀 [![Valid image](image.png)](diagram.html)
`,
    "utf8"
  );
  writeFileSync(
    englishSourcePath,
    "# English fixture\n\n![Valid image](image.png)\n",
    "utf8"
  );

  const scanned = findMarkdownImages(readFileSync(sourcePath, "utf8"));
  expect(scanned.length === 1, `Image scanner should find exactly 1 image; found ${scanned.length}`, errors);
  const receipt = inspectPortableSource(sourcePath, { root: fixtureRoot, generatorFiles: [] });
  const englishReceipt = inspectPortableSource(englishSourcePath, { root: fixtureRoot, generatorFiles: [] });
  expect(receipt.locale === "zh-CN", `Chinese fixture should resolve to zh-CN; received ${receipt.locale}`, errors);
  expect(englishReceipt.locale === "en", `English fixture should resolve to en; received ${englishReceipt.locale}`, errors);
  writeFileSync(outputPath, fixtureHtml(receipt, ONE_PIXEL_PNG), "utf8");
  const valid = checkPortableHtml(sourcePath, outputPath, {
    root: fixtureRoot,
    generatorFiles: [],
  });
  expect(valid.errors.length === 0, `Valid portable fixture was rejected: ${valid.errors.join("; ")}`, errors);

  const validHtml = readFileSync(outputPath, "utf8");
  writeFileSync(outputPath, validHtml.replace("</body>", '<a href="local.md">Broken link</a></body>'), "utf8");
  const localLink = checkPortableHtml(sourcePath, outputPath, {
    root: fixtureRoot,
    generatorFiles: [],
  });
  expect(localLink.errors.some((error) => error.includes("local or unsafe href")), "Local href was not rejected", errors);

  writeFileSync(outputPath, validHtml.replace("</body>", "<a href='local.md'>Single-quoted broken link</a></body>"), "utf8");
  const quotedLocalLink = checkPortableHtml(sourcePath, outputPath, {
    root: fixtureRoot,
    generatorFiles: [],
  });
  expect(quotedLocalLink.errors.some((error) => error.includes("local or unsafe href")), "Single-quoted local href was not rejected", errors);

  writeFileSync(outputPath, validHtml.replace("</body>", '<img srcset="local.png 1x" alt="Bypass"></body>'), "utf8");
  const sourceSet = checkPortableHtml(sourcePath, outputPath, {
    root: fixtureRoot,
    generatorFiles: [],
  });
  expect(sourceSet.errors.some((error) => error.includes("srcset")), "srcset resource was not rejected", errors);

  writeFileSync(outputPath, validHtml.replace(receipt.inputSha256, "0".repeat(64)), "utf8");
  const stale = checkPortableHtml(sourcePath, outputPath, {
    root: fixtureRoot,
    generatorFiles: [],
  });
  expect(stale.errors.some((error) => error.includes("input digest is stale")), "Stale input digest was not rejected", errors);

  const changedBase64 = Buffer.from("different bytes", "utf8").toString("base64");
  writeFileSync(outputPath, validHtml.replace(ONE_PIXEL_PNG.toString("base64"), changedBase64), "utf8");
  const changedImage = checkPortableHtml(sourcePath, outputPath, {
    root: fixtureRoot,
    generatorFiles: [],
  });
  expect(changedImage.errors.some((error) => error.includes("bytes do not match the source image")), "Image-byte drift was not rejected", errors);

  const invalidCases = [
    ["remote.md", "# Remote\n\n![Remote](https://example.com/a.png)\n", /accepts only repository-local images/, "remote image"],
    ["escape.md", "# Escape\n\n![Escape](../../outside.png)\n", /escapes the allowed root/, "path escape"],
    ["empty-alt.md", "# Empty\n\n![](image.png)\n", /non-empty alt/, "empty alt"],
    ["raw-html.md", "# Raw\n\n<img src=\"image.png\">\n\n![Valid](image.png)\n", /contains raw HTML/, "raw HTML"],
  ];
  for (const [name, source, pattern, label] of invalidCases) {
    const path = resolve(docs, name);
    writeFileSync(path, source, "utf8");
    expectThrow(
      () => inspectPortableSource(path, { root: fixtureRoot, generatorFiles: [] }),
      pattern,
      `${label} boundary`,
      errors
    );
  }

  const productionSources = findPortableSources();
  for (const source of productionSources) {
    const output = portableOutputPath(source);
    expect(output.includes("build"), `Portable output is outside build: ${output}`, errors);
  }

  if (errors.length > 0) {
    console.error(`Portable document checks failed (${errors.length}):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(
      `Portable document checks passed (${productionSources.length} source(s) discoverable, ` +
        "positive/negative fixtures valid)."
    );
  }
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}
