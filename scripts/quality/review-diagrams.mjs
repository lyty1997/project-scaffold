import { copyFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import {
  createDiagramTempDir,
  findDiagramSpecs,
  parseReceipt,
  relativePath,
  runArchify,
} from "./lib/archify.mjs";
import { exportNativePng } from "./lib/archify-native-export.mjs";

const requested = new Set(process.argv.slice(2));
const allSpecs = findDiagramSpecs();
const specs = requested.size === 0
  ? allSpecs
  : allSpecs.filter((spec) => requested.has(basename(spec.path)) || requested.has(relativePath(spec.path)));

if (specs.length === 0) {
  console.error("没有与参数匹配的 Archify 图表源。");
  process.exit(1);
}

const evidenceRoot = createDiagramTempDir("archify-visual-review-");
const failures = [];

for (const spec of specs) {
  try {
    const delivered = parseReceipt(
      runArchify([
        "deliver",
        spec.type,
        spec.path,
        spec.outputPath,
        "--quality",
        "showcase",
        "--json",
      ]),
      `${relativePath(spec.path)} 交付`
    );

    const evidenceArtifact = resolve(evidenceRoot, basename(spec.outputPath));
    copyFileSync(spec.outputPath, evidenceArtifact);
    const visual = parseReceipt(
      runArchify(["visual-check", evidenceArtifact, "--json"]),
      `${relativePath(spec.path)} 视觉检查`
    );
    if (visual.status !== "pass") {
      throw new Error(`${relativePath(spec.path)} 的 visual-check status=${visual.status}。`);
    }

    const nativeExportPath = evidenceArtifact.replace(/\.html$/, ".native.png");
    const nativeExport = await exportNativePng({
      artifactPath: evidenceArtifact,
      outputPath: nativeExportPath,
      theme: "light",
    });
    copyFileSync(nativeExportPath, spec.previewPath);
    console.log(
      `- ${relativePath(spec.path)}：9/9，四档桌面无溢出；` +
        `Viewer 原生 PNG ${nativeExport.width}x${nativeExport.height} ` +
        `(×${nativeExport.scale}, canonical) 已刷新为 ${relativePath(spec.previewPath)}；` +
        `html ${delivered.artifact.sha256.slice(0, 12)}`
    );
  } catch (error) {
    failures.push(error.message);
  }
}

console.log(`视觉证据保留在 ${evidenceRoot}`);
console.log("自动检查通过后仍须人工查看该目录中的深浅主题截图与 *.native.png；脚本不会代替人工宣称视觉通过。");

if (failures.length > 0) {
  console.error(`Diagram visual review failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
