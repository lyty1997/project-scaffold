import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, relative } from "node:path";
import {
  compilePlantumlToSvg,
  findAllPlantumlBlocks,
  sourcePolicyErrors,
} from "./lib/plantuml.mjs";
import { projectRoot } from "./lib/files.mjs";

const ROOT = projectRoot();
const jar = process.env.PUML_JAR;
if (!jar || !existsSync(jar) || !lstatSync(jar).isFile()) {
  console.error("PUML_JAR must point to a regular local plantuml.jar file.");
  process.exit(1);
}

let jobs = [];
try {
  jobs = findAllPlantumlBlocks(ROOT);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

if (jobs.length === 0) {
  console.log("No PlantUML blocks found; nothing to render.");
  process.exit(0);
}

const errors = [];
const candidates = [];
const imageOwners = new Set();
for (const job of jobs) {
  const shown = relative(ROOT, job.path).replaceAll("\\", "/");
  const policyErrors = sourcePolicyErrors(job.text);
  for (const error of policyErrors) errors.push(`${shown}:${job.line}: ${error}`);

  if (!job.imagePath) {
    errors.push(`${shown}:${job.line}: missing SVG image reference after PlantUML block`);
    continue;
  }
  const imageShown = relative(ROOT, job.imagePath).replaceAll("\\", "/");
  if (imageShown.startsWith("..") || imageShown === "") {
    errors.push(`${shown}:${job.line}: rendered image must stay inside the repository`);
    continue;
  }
  if (extname(job.imagePath).toLowerCase() !== ".svg") {
    errors.push(`${shown}:${job.line}: rendered image must use the .svg extension`);
    continue;
  }
  if (imageOwners.has(job.imagePath)) {
    errors.push(`${shown}:${job.line}: another block already owns ${imageShown}`);
    continue;
  }
  imageOwners.add(job.imagePath);
  if (existsSync(job.imagePath) && (!lstatSync(job.imagePath).isFile() || lstatSync(job.imagePath).isSymbolicLink())) {
    errors.push(`${shown}:${job.line}: refusing to replace a non-regular or symlink target`);
    continue;
  }
  if (policyErrors.length > 0) continue;

  const compiled = compilePlantumlToSvg(jar, job.text);
  if (!compiled.ok) {
    errors.push(`${shown}:${job.line}: PlantUML compilation failed\n${compiled.error}`);
    continue;
  }
  candidates.push({ ...job, svg: compiled.svg, imageShown });
}

if (errors.length > 0) {
  console.error(`PlantUML rendering failed (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const written = [];
for (const candidate of candidates) {
  const existing = existsSync(candidate.imagePath)
    ? readFileSync(candidate.imagePath, "utf8")
    : null;
  if (existing === candidate.svg) continue;

  mkdirSync(dirname(candidate.imagePath), { recursive: true });
  const tempPath = `${candidate.imagePath}.tmp-${process.pid}`;
  try {
    writeFileSync(tempPath, candidate.svg, { encoding: "utf8", flag: "wx" });
    renameSync(tempPath, candidate.imagePath);
  } catch (error) {
    if (existsSync(tempPath)) unlinkSync(tempPath);
    throw error;
  }
  written.push(candidate.imageShown);
}

if (written.length === 0) {
  console.log(`All ${candidates.length} PlantUML SVG artifact(s) already match this environment.`);
} else {
  console.log(`Rendered ${written.length} PlantUML SVG artifact(s):`);
  for (const path of written) console.log(`- ${path}`);
}
