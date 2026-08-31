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
if (doctor.status !== 0) {
  errors.push(
    `Archify doctor failed:\n${[doctor.stdout, doctor.stderr, doctor.error?.message]
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
  errors.push("No Archify Typed JSON diagram source was found.");
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
      const receipt = parseReceipt(result, `${relativePath(spec.path)} showcase validation`);
      if (
        receipt?.validation?.checksPassed !== 9 ||
        receipt?.validation?.checkCount !== 9 ||
        receipt?.validation?.errors !== 0 ||
        receipt?.validation?.warnings !== 0
      ) {
        errors.push(`${relativePath(spec.path)} did not receive a showcase receipt with 9/9 checks, 0 errors, and 0 warnings.`);
      }

      const artifactErrors = assertTrustedArtifact(spec);
      errors.push(...artifactErrors);
      errors.push(...assertPreview(spec));
      if (
        artifactErrors.length === 0 &&
        readFileSync(tempOutput).compare(readFileSync(spec.outputPath)) !== 0
      ) {
        errors.push(
          `${relativePath(spec.outputPath)} has drifted; run npm run gen:diagrams to refresh the interactive artifact.`
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
