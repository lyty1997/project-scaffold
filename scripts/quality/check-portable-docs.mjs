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
    errors.push(`${message}：没有抛错`);
  } catch (error) {
    if (!pattern.test(error.message)) errors.push(`${message}：错误不匹配：${error.message}`);
  }
}

function fixtureHtml(receipt, imageBytes) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta name="portable-source" content="${receipt.sourceRelative}">
  <meta name="portable-input-sha256" content="${receipt.inputSha256}">
  <meta name="portable-image-count" content="${receipt.images.length}">
  <meta name="portable-pandoc-version" content="2.12">
  <style>body { color: #111; }</style>
</head>
<body>
  <h1 id="fixture">Fixture</h1>
  <a href="#fixture">页内</a>
  <a href="https://example.com">外部</a>
  <span class="portable-local-link" data-original-href="local.md">本地</span>
  <img src="data:image/png;base64,${imageBytes.toString("base64")}" alt="有效图片">
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
  const outputPath = resolve(fixtureRoot, "fixture.html");
  mkdirSync(docs, { recursive: true });
  writeFileSync(imagePath, ONE_PIXEL_PNG);
  writeFileSync(
    sourcePath,
    `# Fixture

\`![代码内忽略](missing.png)\`

\`\`\`markdown
![围栏内忽略](missing.png)
\`\`\`

😀 [![有效图片](image.png)](diagram.html)
`,
    "utf8"
  );

  const scanned = findMarkdownImages(readFileSync(sourcePath, "utf8"));
  expect(scanned.length === 1, `图片扫描器应只找到 1 张图，实际 ${scanned.length}`, errors);
  const receipt = inspectPortableSource(sourcePath, { root: fixtureRoot, generatorFiles: [] });
  writeFileSync(outputPath, fixtureHtml(receipt, ONE_PIXEL_PNG), "utf8");
  const valid = checkPortableHtml(sourcePath, outputPath, {
    root: fixtureRoot,
    generatorFiles: [],
  });
  expect(valid.errors.length === 0, `合法便携 fixture 被拒绝：${valid.errors.join("；")}`, errors);

  const validHtml = readFileSync(outputPath, "utf8");
  writeFileSync(outputPath, validHtml.replace("</body>", '<a href="local.md">断链</a></body>'), "utf8");
  const localLink = checkPortableHtml(sourcePath, outputPath, {
    root: fixtureRoot,
    generatorFiles: [],
  });
  expect(localLink.errors.some((error) => error.includes("本地或不安全 href")), "本地 href 未被拒绝", errors);

  writeFileSync(outputPath, validHtml.replace("</body>", "<a href='local.md'>单引号断链</a></body>"), "utf8");
  const quotedLocalLink = checkPortableHtml(sourcePath, outputPath, {
    root: fixtureRoot,
    generatorFiles: [],
  });
  expect(quotedLocalLink.errors.some((error) => error.includes("本地或不安全 href")), "单引号本地 href 未被拒绝", errors);

  writeFileSync(outputPath, validHtml.replace("</body>", '<img srcset="local.png 1x" alt="绕过"></body>'), "utf8");
  const sourceSet = checkPortableHtml(sourcePath, outputPath, {
    root: fixtureRoot,
    generatorFiles: [],
  });
  expect(sourceSet.errors.some((error) => error.includes("srcset")), "srcset 资源未被拒绝", errors);

  writeFileSync(outputPath, validHtml.replace(receipt.inputSha256, "0".repeat(64)), "utf8");
  const stale = checkPortableHtml(sourcePath, outputPath, {
    root: fixtureRoot,
    generatorFiles: [],
  });
  expect(stale.errors.some((error) => error.includes("输入摘要已过期")), "过期摘要未被拒绝", errors);

  const changedBase64 = Buffer.from("different bytes", "utf8").toString("base64");
  writeFileSync(outputPath, validHtml.replace(ONE_PIXEL_PNG.toString("base64"), changedBase64), "utf8");
  const changedImage = checkPortableHtml(sourcePath, outputPath, {
    root: fixtureRoot,
    generatorFiles: [],
  });
  expect(changedImage.errors.some((error) => error.includes("字节与原图不一致")), "图片字节漂移未被拒绝", errors);

  const invalidCases = [
    ["remote.md", "# Remote\n\n![远程](https://example.com/a.png)\n", /只接受仓库内本地图片/, "远程图片"],
    ["escape.md", "# Escape\n\n![逃逸](../../outside.png)\n", /逃逸允许根目录/, "路径逃逸"],
    ["empty-alt.md", "# Empty\n\n![](image.png)\n", /非空 alt/, "空 alt"],
    ["raw-html.md", "# Raw\n\n<img src=\"image.png\">\n\n![有效](image.png)\n", /原始 HTML/, "原始 HTML"],
  ];
  for (const [name, source, pattern, label] of invalidCases) {
    const path = resolve(docs, name);
    writeFileSync(path, source, "utf8");
    expectThrow(
      () => inspectPortableSource(path, { root: fixtureRoot, generatorFiles: [] }),
      pattern,
      `${label}边界`,
      errors
    );
  }

  const productionSources = findPortableSources();
  for (const source of productionSources) {
    const output = portableOutputPath(source);
    expect(output.includes("build"), `便携输出没有进入 build：${output}`, errors);
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
