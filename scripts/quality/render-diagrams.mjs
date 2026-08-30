import {
  assertVendoredArchify,
  findDiagramSpecs,
  parseReceipt,
  relativePath,
  runArchify,
} from "./lib/archify.mjs";

const integrationErrors = assertVendoredArchify();
if (integrationErrors.length > 0) {
  console.error("Archify 集成契约无效：");
  for (const error of integrationErrors) console.error(`- ${error}`);
  process.exit(1);
}

const specs = findDiagramSpecs();
if (specs.length === 0) {
  console.error("未发现任何 Archify Typed JSON 图表源。");
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
  const receipt = parseReceipt(result, `${relativePath(spec.path)} 交付`);
  receipts.push({ spec, receipt });
}

console.log(`已原子生成 ${receipts.length} 个 Archify 交互产物：`);
for (const { spec, receipt } of receipts) {
  console.log(
    `- ${relativePath(spec.outputPath)} ` +
      `(spec ${receipt.specification.sha256.slice(0, 12)}, html ${receipt.artifact.sha256.slice(0, 12)})`
  );
}
