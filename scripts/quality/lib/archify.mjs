import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { listFiles, projectRoot, readJson } from "./files.mjs";

export const ROOT = projectRoot();
export const ARCHIFY_ROOT = resolve(ROOT, ".claude/skills/archify");
export const ARCHIFY_CLI = resolve(ARCHIFY_ROOT, "bin/archify.mjs");
export const CLAUDE_SKILL_ENTRY = resolve(ARCHIFY_ROOT, "SKILL.md");
export const CODEX_SKILL_ENTRY = resolve(ROOT, ".agents/skills/archify/SKILL.md");
export const CODEX_SKILL_METADATA = resolve(
  ROOT,
  ".agents/skills/archify/agents/openai.yaml"
);
export const DIAGRAM_DIR = resolve(ROOT, "docs/diagrams");
export const DIAGRAM_TYPES = Object.freeze([
  "architecture",
  "workflow",
  "sequence",
  "dataflow",
  "lifecycle",
]);

const TYPE_PATTERN = DIAGRAM_TYPES.join("|");
const SPEC_PATTERN = new RegExp(`\\.(${TYPE_PATTERN})\\.json$`);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_CANVAS_PIXELS = 16 * 1024 * 1024;
const REMOTE_RESOURCE_PATTERN = /<(?:link|script|img|source|iframe|object)\b[^>]*(?:href|src|srcset|data)\s*=\s*["']https?:\/\//i;
const CODEX_CANONICAL_REFERENCE = "../../../.claude/skills/archify/SKILL.md";

export function relativePath(path) {
  return relative(ROOT, path).replaceAll("\\", "/");
}

function readRegularRepositoryFile(path, label, errors) {
  if (existsSync(path)) {
    if (!lstatSync(path).isFile()) {
      errors.push(`${label} must be a regular file so Windows checkouts retain native discovery.`);
      return null;
    }
    return readFileSync(path, "utf8");
  }

  // A hosted Codex environment may mount .agents as a read-only skill view and
  // hide the working-tree path. The staged entry can still be byte-checked from the Git index.
  const repositoryPath = relativePath(path);
  const staged = spawnSync("git", ["ls-files", "--stage", "--", repositoryPath], {
    cwd: ROOT,
    encoding: "utf8",
  });
  const stagedMatch = staged.stdout?.trim().match(/^(\d{6}) [a-f0-9]+ \d+\t/);
  // Some managed shells annotate a successful nested process with EPERM while
  // preserving status 0 and complete stdout. The exit status and receipt are authoritative.
  if (staged.status !== 0 || !stagedMatch) {
    errors.push(`Missing ${label}: ${repositoryPath}`);
    return null;
  }
  if (stagedMatch[1] !== "100644") {
    errors.push(
      `${label} Git mode must be regular-file 100644; found ${stagedMatch[1]}.`
    );
    return null;
  }

  const indexed = spawnSync("git", ["show", `:${repositoryPath}`], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  if (indexed.status !== 0) {
    errors.push(`Could not read ${label} from the Git index: ${repositoryPath}`);
    return null;
  }
  return indexed.stdout;
}

function assertSkillEntrypoints(contract, errors) {
  const expected = {
    claude: {
      path: ".claude/skills/archify/SKILL.md",
      mode: "canonical",
    },
    codex: {
      path: ".agents/skills/archify/SKILL.md",
      metadata_path: ".agents/skills/archify/agents/openai.yaml",
      mode: "bridge",
      target: ".claude/skills/archify/SKILL.md",
    },
  };
  if (contract?.schema_version !== 2) {
    errors.push("docs/contracts/archify.json schema_version must be 2.");
  }
  for (const [host, fields] of Object.entries(expected)) {
    for (const [field, value] of Object.entries(fields)) {
      if (contract?.skill_entrypoints?.[host]?.[field] !== value) {
        errors.push(`Archify ${host} Skill entry has an invalid ${field} contract.`);
      }
    }
  }

  if (!existsSync(CLAUDE_SKILL_ENTRY)) {
    errors.push(`Missing native Claude Archify Skill entry: ${relativePath(CLAUDE_SKILL_ENTRY)}`);
  }

  const codexSkill = readRegularRepositoryFile(CODEX_SKILL_ENTRY, "native Codex Archify Skill entry", errors);
  if (codexSkill) {
    if (!/^name:\s*archify\s*$/m.test(codexSkill)) {
      errors.push("Codex Archify Skill entry must declare name: archify.");
    }
    if (!/^description:\s*\S.+$/m.test(codexSkill)) {
      errors.push("Codex Archify Skill entry must declare a non-empty description.");
    }
    if (!codexSkill.includes(CODEX_CANONICAL_REFERENCE)) {
      errors.push("Codex Archify Skill entry does not point to the single vendored Claude implementation.");
    }
    if (!/\bRead\b[^\r\n]*\bcompletely\b/i.test(codexSkill)) {
      errors.push("Codex Archify Skill entry must require reading the complete canonical Skill.");
    }
    if (!codexSkill.includes("Viewer-native **Export → PNG**")) {
      errors.push("Codex Archify Skill entry does not inherit the Viewer-native document PNG export constraint.");
    }
  }

  const resolvedTarget = resolve(dirname(CODEX_SKILL_ENTRY), CODEX_CANONICAL_REFERENCE);
  if (resolvedTarget !== CLAUDE_SKILL_ENTRY) {
    errors.push("Codex Archify Skill relative canonical path does not resolve to the Claude Skill.");
  }

  const codexMetadata = readRegularRepositoryFile(
    CODEX_SKILL_METADATA,
    "Codex Archify Skill UI metadata",
    errors
  );
  if (codexMetadata) {
    if (!/^\s*display_name:\s*["']Archify["']\s*$/m.test(codexMetadata)) {
      errors.push("Codex Archify Skill UI metadata is missing display_name: Archify.");
    }
    if (!/^\s*short_description:\s*["']\S.+["']\s*$/m.test(codexMetadata)) {
      errors.push("Codex Archify Skill UI metadata is missing a non-empty short_description.");
    }
    if (!/^\s*default_prompt:\s*["'][^"']*\$archify\b[^"']*["']\s*$/m.test(codexMetadata)) {
      errors.push("Codex Archify Skill default_prompt must explicitly mention $archify.");
    }
  }
}

export function findDiagramSpecs() {
  if (!existsSync(DIAGRAM_DIR)) return [];
  return listFiles(DIAGRAM_DIR, (path) => SPEC_PATTERN.test(path)).map(readDiagramSpec);
}

export function readDiagramSpec(path) {
  const match = path.match(SPEC_PATTERN);
  if (!match) throw new Error(`Unsupported Archify diagram source: ${relativePath(path)}`);

  const filenameType = match[1];
  let source;
  try {
    source = readJson(path);
  } catch (error) {
    throw new Error(`${relativePath(path)} is not valid JSON: ${error.message}`);
  }

  if (source?.diagram_type !== filenameType) {
    throw new Error(
      `${relativePath(path)} has diagram_type=${JSON.stringify(source?.diagram_type)}, ` +
        `which must match filename suffix ${filenameType}.`
    );
  }
  if (source?.meta?.quality_profile !== "showcase") {
    throw new Error(`${relativePath(path)} must set meta.quality_profile="showcase".`);
  }
  if (!new Set(["zh-CN", "en"]).has(source?.meta?.locale)) {
    throw new Error(`${relativePath(path)} must explicitly set a supported meta.locale.`);
  }
  if (Object.hasOwn(source?.meta ?? {}, "output")) {
    throw new Error(`${relativePath(path)} must not define meta.output; the same-basename contract determines artifact paths.`);
  }

  const stem = path.slice(0, -match[0].length);
  return {
    path,
    type: filenameType,
    source,
    outputPath: `${stem}.archify.html`,
    previewPath: `${stem}.archify.png`,
  };
}

export function runArchify(args, { cwd = ROOT } = {}) {
  return spawnSync(process.execPath, [ARCHIFY_CLI, ...args], {
    cwd,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    env: {
      ...process.env,
      ARCHIFY_UPDATE_CHECK_DISABLED: "1",
    },
  });
}

export function parseReceipt(result, label) {
  const stdout = result.stdout?.trim() ?? "";
  if (result.status !== 0) {
    const details = [stdout, result.stderr?.trim(), result.error?.message]
      .filter(Boolean)
      .join("\n");
    throw new Error(`${label} failed with exit ${result.status}:\n${details}`);
  }

  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`${label} did not return a valid JSON receipt: ${error.message}\n${stdout}`);
  }
}

export function assertVendoredArchify() {
  const errors = [];
  const required = [
    ARCHIFY_CLI,
    CLAUDE_SKILL_ENTRY,
    resolve(ARCHIFY_ROOT, "LICENSE"),
    resolve(ARCHIFY_ROOT, "LOCAL_CHANGES.md"),
    resolve(ARCHIFY_ROOT, "assets/template.html"),
  ];
  for (const path of required) {
    if (!existsSync(path)) errors.push(`Missing vendored Archify file: ${relativePath(path)}`);
  }
  if (errors.length > 0) return errors;

  const contractPath = resolve(ROOT, "docs/contracts/archify.json");
  const packagePath = resolve(ARCHIFY_ROOT, "package.json");
  try {
    const contract = readJson(contractPath);
    const pkg = readJson(packagePath);
    assertSkillEntrypoints(contract, errors);
    if (contract?.vendored_path !== ".claude/skills/archify") {
      errors.push("docs/contracts/archify.json vendored_path does not match the actual directory.");
    }
    if (!/^[a-f0-9]{40}$/.test(contract?.upstream?.commit ?? "")) {
      errors.push("docs/contracts/archify.json must pin a 40-character upstream commit SHA.");
    }
    if (contract?.upstream?.package_version !== pkg.version) {
      errors.push(
        `Archify version contract is ${JSON.stringify(contract?.upstream?.package_version)}, ` +
          `but vendored package.json is ${JSON.stringify(pkg.version)}.`
      );
    }
    const actualTreeHash = vendoredTreeSha256();
    if (contract?.vendored_tree_sha256 !== actualTreeHash) {
      errors.push(
        `Vendored Archify directory has drifted: contract ${JSON.stringify(contract?.vendored_tree_sha256)}, ` +
          `actual ${actualTreeHash}.`
      );
    }
    if (contract?.network_policy !== "disabled") {
      errors.push("Archify network_policy must be disabled.");
    }
  } catch (error) {
    errors.push(`Could not read the pinned Archify version contract: ${error.message}`);
  }

  for (const path of listFiles(ARCHIFY_ROOT, (candidate) => candidate.endsWith(".html"))) {
    if (REMOTE_RESOURCE_PATTERN.test(readFileSync(path, "utf8"))) {
      errors.push(`Vendored Archify HTML contains a remote resource request: ${relativePath(path)}`);
    }
  }

  const skill = readFileSync(resolve(ARCHIFY_ROOT, "SKILL.md"), "utf8");
  if (!skill.includes("Do not run `scripts/check-update.mjs`")) {
    errors.push("Archify Skill does not retain the project-level instruction that disables automatic update checks.");
  }

  return errors;
}

export function vendoredTreeSha256() {
  const hash = createHash("sha256");
  for (const path of listFiles(ARCHIFY_ROOT)) {
    hash.update(relative(ARCHIFY_ROOT, path).replaceAll("\\", "/"));
    hash.update("\0");
    hash.update(readFileSync(path));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function assertTrustedArtifact(spec, expectedPath = spec.outputPath) {
  const errors = [];
  if (!existsSync(expectedPath)) {
    errors.push(`Missing interactive artifact: ${relativePath(expectedPath)}`);
    return errors;
  }
  if (statSync(expectedPath).size === 0) {
    errors.push(`Interactive artifact is empty: ${relativePath(expectedPath)}`);
    return errors;
  }

  const html = readFileSync(expectedPath, "utf8");
  if (REMOTE_RESOURCE_PATTERN.test(html)) {
    errors.push(`Interactive artifact contains a remote resource request: ${relativePath(expectedPath)}`);
  }
  return errors;
}

export function assertPreview(spec) {
  if (!existsSync(spec.previewPath)) {
    return [`Missing Markdown static preview: ${relativePath(spec.previewPath)}`];
  }
  const bytes = readFileSync(spec.previewPath);
  if (bytes.length <= PNG_SIGNATURE.length || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return [`Static preview is not a non-empty PNG: ${relativePath(spec.previewPath)}`];
  }
  const actual = pngDimensions(bytes);
  const expected = nativePngExpectation(readFileSync(spec.outputPath, "utf8"));
  if (actual.width !== expected.width || actual.height !== expected.height) {
    return [
      `${relativePath(spec.previewPath)} is ${actual.width}x${actual.height}; ` +
        `Viewer-native export should be ${expected.width}x${expected.height} ` +
        `(viewBox ${expected.viewBoxWidth}x${expected.viewBoxHeight} × ${expected.scale})。`,
    ];
  }
  return [];
}

export function pngDimensions(bytes) {
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("Cannot read IHDR dimensions from non-PNG bytes.");
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

export function nativePngExpectation(html) {
  const match = html.match(/<svg\b[^>]*\bviewBox=["']([^"']+)["']/i);
  if (!match) throw new Error("Interactive HTML is missing the primary SVG viewBox.");
  const values = match[1].trim().split(/\s+/).map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
    throw new Error(`Primary SVG viewBox is invalid: ${JSON.stringify(match[1])}`);
  }
  const [, , viewBoxWidth, viewBoxHeight] = values;
  if (viewBoxWidth <= 0 || viewBoxHeight <= 0) {
    throw new Error(`Primary SVG viewBox dimensions must be positive: ${viewBoxWidth}x${viewBoxHeight}`);
  }
  let scale = 1;
  for (let candidate = 4; candidate >= 1; candidate -= 1) {
    if (viewBoxWidth * candidate * viewBoxHeight * candidate <= MAX_CANVAS_PIXELS) {
      scale = candidate;
      break;
    }
  }
  return {
    viewBoxWidth,
    viewBoxHeight,
    scale,
    width: Math.trunc(viewBoxWidth * scale),
    height: Math.trunc(viewBoxHeight * scale),
  };
}

export function assertDocumentedArtifacts(specs) {
  const markdownText = listFiles(resolve(ROOT, "docs"), (path) => path.endsWith(".md"))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
  const errors = [];
  for (const spec of specs) {
    for (const path of [spec.path, spec.outputPath, spec.previewPath]) {
      const filename = basename(path);
      if (!markdownText.includes(filename)) {
        errors.push(`${relativePath(path)} is not referenced by any docs Markdown file.`);
      }
    }
  }
  return errors;
}

export function createDiagramTempDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function removeDiagramTempDir(path) {
  rmSync(path, { recursive: true, force: true });
}

export function tempArtifactPath(tempRoot, spec) {
  return resolve(tempRoot, basename(spec.outputPath));
}
