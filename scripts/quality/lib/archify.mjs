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
      errors.push(`${label} 必须是普通文件，避免 Windows checkout 丢失原生发现能力。`);
      return null;
    }
    return readFileSync(path, "utf8");
  }

  // Codex 托管环境可能把仓库的 .agents 挂载为只读技能视图。
  // 此时工作树路径被遮蔽，但待提交入口仍可从 Git 索引做同等字节校验。
  const repositoryPath = relativePath(path);
  const staged = spawnSync("git", ["ls-files", "--stage", "--", repositoryPath], {
    cwd: ROOT,
    encoding: "utf8",
  });
  const stagedMatch = staged.stdout?.trim().match(/^(\d{6}) [a-f0-9]+ \d+\t/);
  if (staged.error || staged.status !== 0 || !stagedMatch) {
    errors.push(`缺少${label}：${repositoryPath}`);
    return null;
  }
  if (stagedMatch[1] !== "100644") {
    errors.push(
      `${label} 的 Git 模式必须为 100644 普通文件，实际为 ${stagedMatch[1]}。`
    );
    return null;
  }

  const indexed = spawnSync("git", ["show", `:${repositoryPath}`], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  if (indexed.error || indexed.status !== 0) {
    errors.push(`无法从 Git 索引读取${label}：${repositoryPath}`);
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
    errors.push("docs/contracts/archify.json 的 schema_version 必须为 2。");
  }
  for (const [host, fields] of Object.entries(expected)) {
    for (const [field, value] of Object.entries(fields)) {
      if (contract?.skill_entrypoints?.[host]?.[field] !== value) {
        errors.push(`Archify ${host} Skill 入口的 ${field} 契约无效。`);
      }
    }
  }

  if (!existsSync(CLAUDE_SKILL_ENTRY)) {
    errors.push(`缺少 Claude 原生 Archify Skill 入口：${relativePath(CLAUDE_SKILL_ENTRY)}`);
  }

  const codexSkill = readRegularRepositoryFile(CODEX_SKILL_ENTRY, "Codex 原生 Archify Skill 入口", errors);
  if (codexSkill) {
    if (!/^name:\s*archify\s*$/m.test(codexSkill)) {
      errors.push("Codex Archify Skill 入口必须声明 name: archify。");
    }
    if (!/^description:\s*\S.+$/m.test(codexSkill)) {
      errors.push("Codex Archify Skill 入口必须声明非空 description。");
    }
    if (!codexSkill.includes(CODEX_CANONICAL_REFERENCE)) {
      errors.push("Codex Archify Skill 入口没有指向唯一的 Claude vendored 实现。");
    }
    if (!/\bRead\b[^\r\n]*\bcompletely\b/i.test(codexSkill)) {
      errors.push("Codex Archify Skill 入口必须要求完整读取 canonical Skill。");
    }
    if (!codexSkill.includes("Viewer-native **Export → PNG**")) {
      errors.push("Codex Archify Skill 入口未继承文档 PNG 的 Viewer 原生导出约束。");
    }
  }

  const resolvedTarget = resolve(dirname(CODEX_SKILL_ENTRY), CODEX_CANONICAL_REFERENCE);
  if (resolvedTarget !== CLAUDE_SKILL_ENTRY) {
    errors.push("Codex Archify Skill 的相对 canonical 路径没有解析到 Claude Skill。");
  }

  const codexMetadata = readRegularRepositoryFile(
    CODEX_SKILL_METADATA,
    "Codex Archify Skill UI 元数据",
    errors
  );
  if (codexMetadata) {
    if (!/^\s*display_name:\s*["']Archify["']\s*$/m.test(codexMetadata)) {
      errors.push("Codex Archify Skill UI 元数据缺少 display_name: Archify。");
    }
    if (!/^\s*short_description:\s*["']\S.+["']\s*$/m.test(codexMetadata)) {
      errors.push("Codex Archify Skill UI 元数据缺少非空 short_description。");
    }
    if (!/^\s*default_prompt:\s*["'][^"']*\$archify\b[^"']*["']\s*$/m.test(codexMetadata)) {
      errors.push("Codex Archify Skill default_prompt 必须显式提及 $archify。");
    }
  }
}

export function findDiagramSpecs() {
  if (!existsSync(DIAGRAM_DIR)) return [];
  return listFiles(DIAGRAM_DIR, (path) => SPEC_PATTERN.test(path)).map(readDiagramSpec);
}

export function readDiagramSpec(path) {
  const match = path.match(SPEC_PATTERN);
  if (!match) throw new Error(`不是受支持的 Archify 图表源：${relativePath(path)}`);

  const filenameType = match[1];
  let source;
  try {
    source = readJson(path);
  } catch (error) {
    throw new Error(`${relativePath(path)} 不是合法 JSON：${error.message}`);
  }

  if (source?.diagram_type !== filenameType) {
    throw new Error(
      `${relativePath(path)} 的 diagram_type=${JSON.stringify(source?.diagram_type)}，` +
        `必须与文件后缀 ${filenameType} 一致。`
    );
  }
  if (source?.meta?.quality_profile !== "showcase") {
    throw new Error(`${relativePath(path)} 必须设置 meta.quality_profile="showcase"。`);
  }
  if (!new Set(["zh-CN", "en"]).has(source?.meta?.locale)) {
    throw new Error(`${relativePath(path)} 必须显式设置受支持的 meta.locale。`);
  }
  if (Object.hasOwn(source?.meta ?? {}, "output")) {
    throw new Error(`${relativePath(path)} 不得自定义 meta.output；产物路径由同名契约确定。`);
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
  if (result.error) {
    throw new Error(`${label} 无法启动：${result.error.message}`);
  }

  const stdout = result.stdout?.trim() ?? "";
  if (result.status !== 0) {
    const details = [stdout, result.stderr?.trim()].filter(Boolean).join("\n");
    throw new Error(`${label} 失败（exit ${result.status}）：\n${details}`);
  }

  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`${label} 没有返回合法 JSON 回执：${error.message}\n${stdout}`);
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
    if (!existsSync(path)) errors.push(`缺少 vendored Archify 文件：${relativePath(path)}`);
  }
  if (errors.length > 0) return errors;

  const contractPath = resolve(ROOT, "docs/contracts/archify.json");
  const packagePath = resolve(ARCHIFY_ROOT, "package.json");
  try {
    const contract = readJson(contractPath);
    const pkg = readJson(packagePath);
    assertSkillEntrypoints(contract, errors);
    if (contract?.vendored_path !== ".claude/skills/archify") {
      errors.push("docs/contracts/archify.json 的 vendored_path 与实际目录不一致。");
    }
    if (!/^[a-f0-9]{40}$/.test(contract?.upstream?.commit ?? "")) {
      errors.push("docs/contracts/archify.json 必须固定 40 位上游提交 SHA。");
    }
    if (contract?.upstream?.package_version !== pkg.version) {
      errors.push(
        `Archify 版本契约为 ${JSON.stringify(contract?.upstream?.package_version)}，` +
          `vendored package.json 为 ${JSON.stringify(pkg.version)}。`
      );
    }
    const actualTreeHash = vendoredTreeSha256();
    if (contract?.vendored_tree_sha256 !== actualTreeHash) {
      errors.push(
        `Archify vendored 目录已漂移：契约为 ${JSON.stringify(contract?.vendored_tree_sha256)}，` +
          `实际为 ${actualTreeHash}。`
      );
    }
    if (contract?.network_policy !== "disabled") {
      errors.push("Archify network_policy 必须为 disabled。");
    }
  } catch (error) {
    errors.push(`无法读取 Archify 固定版本契约：${error.message}`);
  }

  for (const path of listFiles(ARCHIFY_ROOT, (candidate) => candidate.endsWith(".html"))) {
    if (REMOTE_RESOURCE_PATTERN.test(readFileSync(path, "utf8"))) {
      errors.push(`vendored Archify HTML 包含远程资源请求：${relativePath(path)}`);
    }
  }

  const skill = readFileSync(resolve(ARCHIFY_ROOT, "SKILL.md"), "utf8");
  if (!skill.includes("Do not run `scripts/check-update.mjs`")) {
    errors.push("Archify Skill 未保留项目级自动更新检查禁用说明。");
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
    errors.push(`缺少交互产物：${relativePath(expectedPath)}`);
    return errors;
  }
  if (statSync(expectedPath).size === 0) {
    errors.push(`交互产物为空：${relativePath(expectedPath)}`);
    return errors;
  }

  const html = readFileSync(expectedPath, "utf8");
  if (REMOTE_RESOURCE_PATTERN.test(html)) {
    errors.push(`交互产物包含远程资源请求：${relativePath(expectedPath)}`);
  }
  return errors;
}

export function assertPreview(spec) {
  if (!existsSync(spec.previewPath)) {
    return [`缺少 Markdown 静态预览：${relativePath(spec.previewPath)}`];
  }
  const bytes = readFileSync(spec.previewPath);
  if (bytes.length <= PNG_SIGNATURE.length || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return [`静态预览不是非空 PNG：${relativePath(spec.previewPath)}`];
  }
  const actual = pngDimensions(bytes);
  const expected = nativePngExpectation(readFileSync(spec.outputPath, "utf8"));
  if (actual.width !== expected.width || actual.height !== expected.height) {
    return [
      `${relativePath(spec.previewPath)} 尺寸为 ${actual.width}x${actual.height}，` +
        `Viewer 原生导出应为 ${expected.width}x${expected.height} ` +
        `(viewBox ${expected.viewBoxWidth}x${expected.viewBoxHeight} × ${expected.scale})。`,
    ];
  }
  return [];
}

export function pngDimensions(bytes) {
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("无法从非 PNG 字节读取 IHDR 尺寸。");
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

export function nativePngExpectation(html) {
  const match = html.match(/<svg\b[^>]*\bviewBox=["']([^"']+)["']/i);
  if (!match) throw new Error("交互 HTML 中缺少主 SVG viewBox。");
  const values = match[1].trim().split(/\s+/).map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
    throw new Error(`主 SVG viewBox 无效：${JSON.stringify(match[1])}`);
  }
  const [, , viewBoxWidth, viewBoxHeight] = values;
  if (viewBoxWidth <= 0 || viewBoxHeight <= 0) {
    throw new Error(`主 SVG viewBox 尺寸必须为正：${viewBoxWidth}x${viewBoxHeight}`);
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
        errors.push(`${relativePath(path)} 没有被任何 docs Markdown 引用。`);
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
