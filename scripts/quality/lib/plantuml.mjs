import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { listFiles, readText } from "./files.mjs";

const PLANTUML_OPEN = /^\s*```plantuml\s*$/;
const FENCE_CLOSE = /^\s*```\s*$/;
const IMAGE_LINK = /^\s*!\[([^\]]+)\]\((?:<([^>]+)>|([^\s)]+))(?:\s+["'][^"']*["'])?\)\s*$/;

function parseImageTarget(line) {
  const match = IMAGE_LINK.exec(line);
  if (!match) return null;
  const rawTarget = match[2] ?? match[3];
  if (!rawTarget || /[?#]/.test(rawTarget)) return null;
  try {
    return decodeURIComponent(rawTarget);
  } catch {
    return null;
  }
}

export function findPlantumlBlocks(markdownPath) {
  const lines = readText(markdownPath).split(/\r?\n/);
  const blocks = [];
  let current = null;

  for (const [index, line] of lines.entries()) {
    if (!current && PLANTUML_OPEN.test(line)) {
      current = { source: [], line: index + 2, fenceEndIndex: null };
      continue;
    }
    if (current && FENCE_CLOSE.test(line)) {
      current.fenceEndIndex = index;
      blocks.push(current);
      current = null;
      continue;
    }
    if (current) current.source.push(line);
  }

  if (current) {
    throw new Error(`${markdownPath}:${current.line - 1}: unclosed PlantUML fence`);
  }

  return blocks.map((block) => {
    let target = null;
    for (let offset = 1; offset <= 2; offset += 1) {
      const candidate = lines[block.fenceEndIndex + offset];
      if (candidate === undefined) break;
      if (candidate.trim() === "") continue;
      target = parseImageTarget(candidate);
      break;
    }
    return {
      text: block.source.join("\n"),
      line: block.line,
      imagePath: target ? resolve(dirname(markdownPath), target) : null,
    };
  });
}

export function findAllPlantumlBlocks(root) {
  const jobs = [];
  for (const path of listFiles(root, (candidate) => candidate.endsWith(".md"))) {
    for (const block of findPlantumlBlocks(path)) jobs.push({ path, ...block });
  }
  return jobs;
}

export function sourcePolicyErrors(source) {
  const errors = [];
  if (!/^\s*@startuml(?:\s+\S+)?\s*$/m.test(source)) {
    errors.push("source must contain @startuml");
  }
  if (!/^\s*@enduml\s*$/m.test(source)) {
    errors.push("source must contain @enduml");
  }
  if (/^\s*!(?:include|include_once|include_many|includeurl|import)\b/im.test(source)) {
    errors.push("include/import directives are forbidden; diagrams must be self-contained");
  }
  return errors;
}

export function compilePlantumlToSvg(jar, source) {
  const tempRoot = mkdtempSync(resolve(tmpdir(), "project-scaffold-plantuml-"));
  const sourcePath = resolve(tempRoot, "diagram.puml");
  const outputPath = resolve(tempRoot, "diagram.svg");

  try {
    writeFileSync(sourcePath, source.endsWith("\n") ? source : `${source}\n`, "utf8");
    const result = spawnSync(
      "java",
      [
        "-DPLANTUML_SECURITY_PROFILE=SECURE",
        "-jar",
        jar,
        "-failfast2",
        "-charset",
        "UTF-8",
        "-tsvg",
        sourcePath,
      ],
      { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, timeout: 30_000 }
    );

    if (result.status !== 0) {
      return {
        ok: false,
        error:
          (result.stderr ?? "").trim() ||
          result.error?.message ||
          `PlantUML exited with status ${result.status}`,
      };
    }
    if (!existsSync(outputPath)) {
      return { ok: false, error: "PlantUML did not create the expected SVG" };
    }

    const svg = readFileSync(outputPath, "utf8");
    if (svg.length < 100 || !/<svg\b/.test(svg)) {
      return { ok: false, error: "PlantUML returned no non-empty SVG" };
    }
    return { ok: true, svg };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}
