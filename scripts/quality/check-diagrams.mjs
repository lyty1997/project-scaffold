import { readFileSync } from "node:fs";
import {
  assertDocumentedArtifacts,
  assertPreview,
  assertTrustedArtifact,
  assertVendoredArchify,
  createDiagramTempDir,
  findDiagramSpecs,
  parseReceipt,
  relativePath,
  removeDiagramTempDir,
  runArchify,
  tempArtifactPath,
} from "./lib/archify.mjs";

const errors = assertVendoredArchify();
const doctor = runArchify(["doctor"]);
if (doctor.error || doctor.status !== 0) {
  errors.push(
    `Archify doctor 失败：\n${[doctor.stdout, doctor.stderr, doctor.error?.message]
      .filter(Boolean)
      .join("\n")}`
  );
}

let specs = [];
try {
  specs = findDiagramSpecs();
} catch (error) {
  errors.push(error.message);
}

if (specs.length === 0) {
  errors.push("未发现任何 Archify Typed JSON 图表源。");
} else {
  errors.push(...assertDocumentedArtifacts(specs));
}

const tempRoot = createDiagramTempDir("archify-check-");
try {
  for (const spec of specs) {
    const tempOutput = tempArtifactPath(tempRoot, spec);
    try {
      const result = runArchify([
        "deliver",
        spec.type,
        spec.path,
        tempOutput,
        "--quality",
        "showcase",
        "--json",
      ]);
      const receipt = parseReceipt(result, `${relativePath(spec.path)} showcase 校验`);
      if (
        receipt?.validation?.checksPassed !== 9 ||
        receipt?.validation?.checkCount !== 9 ||
        receipt?.validation?.errors !== 0 ||
        receipt?.validation?.warnings !== 0
      ) {
        errors.push(`${relativePath(spec.path)} 未取得 9/9、0 error、0 warning 的 showcase 回执。`);
      }

      const artifactErrors = assertTrustedArtifact(spec);
      errors.push(...artifactErrors);
      errors.push(...assertPreview(spec));
      if (
        artifactErrors.length === 0 &&
        readFileSync(tempOutput).compare(readFileSync(spec.outputPath)) !== 0
      ) {
        errors.push(
          `${relativePath(spec.outputPath)} 已漂移；运行 npm run gen:diagrams 刷新交互产物。`
        );
      }
    } catch (error) {
      errors.push(error.message);
    }
  }
} finally {
  removeDiagramTempDir(tempRoot);
}

if (errors.length > 0) {
  console.error(`Diagram checks failed (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Diagram checks passed (${specs.length} Archify source(s), ` +
    "showcase 9/9, HTML fresh, native PNG dimensions valid)."
);
