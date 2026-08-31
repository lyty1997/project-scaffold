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
  console.error("No Archify diagram source matched the arguments.");
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
      `${relativePath(spec.path)} delivery`
    );

    const evidenceArtifact = resolve(evidenceRoot, basename(spec.outputPath));
    copyFileSync(spec.outputPath, evidenceArtifact);
    const visual = parseReceipt(
      runArchify(["visual-check", evidenceArtifact, "--json"]),
      `${relativePath(spec.path)} visual check`
    );
    if (visual.status !== "pass") {
      throw new Error(`${relativePath(spec.path)} visual-check returned status=${visual.status}.`);
    }

    const nativeExportPath = evidenceArtifact.replace(/\.html$/, ".native.png");
    const nativeExport = await exportNativePng({
      artifactPath: evidenceArtifact,
      outputPath: nativeExportPath,
      theme: "light",
    });
    copyFileSync(nativeExportPath, spec.previewPath);
    console.log(
      `- ${relativePath(spec.path)}: 9/9 with no overflow at four desktop sizes; ` +
        `Viewer-native PNG ${nativeExport.width}x${nativeExport.height} ` +
        `(x${nativeExport.scale}, canonical) refreshed at ${relativePath(spec.previewPath)}; ` +
        `html ${delivered.artifact.sha256.slice(0, 12)}`
    );
  } catch (error) {
    failures.push(error.message);
  }
}

console.log(`Visual evidence retained at ${evidenceRoot}`);
console.log("After automated checks pass, inspect the light/dark screenshots and *.native.png in that directory manually; this script does not claim visual approval.");

if (failures.length > 0) {
  console.error(`Diagram visual review failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
