import {
  assertVendoredArchify,
  findDiagramSpecs,
  parseReceipt,
  relativePath,
  runArchify,
} from "./lib/archify.mjs";

const integrationErrors = assertVendoredArchify();
if (integrationErrors.length > 0) {
  console.error("Archify integration contract is invalid:");
  for (const error of integrationErrors) console.error(`- ${error}`);
  process.exit(1);
}

const specs = findDiagramSpecs();
if (specs.length === 0) {
  console.error("No Archify Typed JSON diagram source was found.");
  process.exit(1);
}

const receipts = [];
for (const spec of specs) {
  const result = runArchify([
    "deliver",
    spec.type,
    spec.path,
    spec.outputPath,
    "--quality",
    "showcase",
    "--json",
  ]);
  const receipt = parseReceipt(result, `${relativePath(spec.path)} delivery`);
  receipts.push({ spec, receipt });
}

console.log(`Atomically generated ${receipts.length} Archify interactive artifact(s):`);
for (const { spec, receipt } of receipts) {
  console.log(
    `- ${relativePath(spec.outputPath)} ` +
      `(spec ${receipt.specification.sha256.slice(0, 12)}, html ${receipt.artifact.sha256.slice(0, 12)})`
  );
}
