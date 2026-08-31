import { existsSync, lstatSync, readFileSync } from "node:fs";
import { extname, relative } from "node:path";
import {
  compilePlantumlToSvg,
  findAllPlantumlBlocks,
  sourcePolicyErrors,
} from "./lib/plantuml.mjs";
import { projectRoot } from "./lib/files.mjs";

const ROOT = projectRoot();
let jobs = [];
const errors = [];

try {
  jobs = findAllPlantumlBlocks(ROOT);
} catch (error) {
  errors.push(error.message);
}

if (jobs.length === 0 && errors.length === 0) {
  console.log("No PlantUML blocks found; skipping PlantUML checks.");
  process.exit(0);
}

const jar = process.env.PUML_JAR;
if (!jar) {
  errors.push(
    `found ${jobs.length} PlantUML block(s), but PUML_JAR is not set; point it to a local plantuml.jar`
  );
} else if (!existsSync(jar) || !lstatSync(jar).isFile()) {
  errors.push(`PUML_JAR is not a regular file: ${jar}`);
}

const imageOwners = new Map();
for (const job of jobs) {
  const shown = relative(ROOT, job.path).replaceAll("\\", "/");
  for (const error of sourcePolicyErrors(job.text)) {
    errors.push(`${shown}:${job.line}: ${error}`);
  }

  if (!job.imagePath) {
    errors.push(
      `${shown}:${job.line}: every PlantUML block must be followed by a non-empty SVG image reference`
    );
  } else {
    const imageShown = relative(ROOT, job.imagePath).replaceAll("\\", "/");
    if (imageShown.startsWith("..") || imageShown === "") {
      errors.push(`${shown}:${job.line}: rendered image must stay inside the repository`);
    } else if (extname(job.imagePath).toLowerCase() !== ".svg") {
      errors.push(`${shown}:${job.line}: rendered image must use the .svg extension`);
    } else if (imageOwners.has(job.imagePath)) {
      errors.push(
        `${shown}:${job.line}: rendered image is also owned by ${imageOwners.get(job.imagePath)}`
      );
    } else {
      imageOwners.set(job.imagePath, `${shown}:${job.line}`);
    }

    if (!existsSync(job.imagePath)) {
      errors.push(`${shown}:${job.line}: rendered SVG does not exist: ${imageShown}`);
    } else if (!lstatSync(job.imagePath).isFile() || lstatSync(job.imagePath).isSymbolicLink()) {
      errors.push(`${shown}:${job.line}: rendered SVG must be a regular, non-symlink file`);
    } else {
      const committed = readFileSync(job.imagePath, "utf8");
      if (committed.length < 100 || !/<svg\b/.test(committed)) {
        errors.push(`${shown}:${job.line}: rendered SVG is empty or invalid: ${imageShown}`);
      }
    }
  }

  if (jar && existsSync(jar) && sourcePolicyErrors(job.text).length === 0) {
    const compiled = compilePlantumlToSvg(jar, job.text);
    if (!compiled.ok) {
      errors.push(`${shown}:${job.line}: PlantUML compilation failed\n${compiled.error}`);
    }
  }
}

if (errors.length > 0) {
  console.error(`PlantUML checks failed (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `PlantUML checks passed (${jobs.length} block(s), secure compilation, non-empty SVG artifacts).`
);
