// CI/CD probe: collect facts without making decisions.
//
// Design constraints are documented in docs/architecture/cicd-autosetup.md:
// - Probe facts help choose a toolchain; they never guess build or test commands.
//   Report facts such as package.json script names, not assumptions such as
//   "the build command is npm run build."
// - All operations are read-only, and remote calls use GET only.
// - Missing data must carry an explicit failure reason, never masquerade as absence.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, extname, relative, resolve } from "node:path";
import { listFiles, projectRoot, readJson, readText } from "../quality/lib/files.mjs";

const ROOT = projectRoot();

// Build-system marker -> category. Record what exists, not how to invoke it.
const BUILD_MARKERS = [
  { file: "CMakeLists.txt", kind: "cmake" },
  { file: "Makefile", kind: "make" },
  { file: "GNUmakefile", kind: "make" },
  { file: "meson.build", kind: "meson" },
  { file: "configure.ac", kind: "autotools" },
  { file: "WORKSPACE", kind: "bazel" },
  { file: "MODULE.bazel", kind: "bazel" },
  { file: "pyproject.toml", kind: "python" },
  { file: "setup.py", kind: "python" },
  { file: "setup.cfg", kind: "python" },
  { file: "requirements.txt", kind: "python" },
  { file: "package.json", kind: "node" },
  { file: "tsconfig.json", kind: "typescript" },
  { file: "Cargo.toml", kind: "rust" },
  { file: "go.mod", kind: "go" },
  { file: "Dockerfile", kind: "container" },
  { file: "compose.yaml", kind: "container" },
  { file: "compose.yml", kind: "container" },
  { file: "docker-compose.yml", kind: "container" },
];

// Static-site entry candidates that may inform a later hosting decision.
const STATIC_ENTRIES = ["public/index.html", "index.html", "site/index.html", "dist/index.html"];

// Language extensions included in the source-distribution summary.
const SOURCE_EXTENSIONS = new Set([
  ".c", ".h", ".cc", ".cpp", ".cxx", ".hpp", ".hxx",
  ".py", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".rs", ".go", ".java", ".cs", ".rb", ".php", ".html", ".css",
]);

// Exclude probe and quality scripts so scaffold files do not skew project-source facts.
const SELF_PREFIXES = ["scripts/", ".claude/", ".githooks/", "codex-rules/", "docs/"];

function repoPath(...parts) {
  return resolve(ROOT, ...parts);
}

function isSelfFile(relativePath) {
  return SELF_PREFIXES.some((prefix) => relativePath.startsWith(prefix));
}

// Collect build-system markers as deduplicated, repository-relative { file, kind } records.
function detectBuildMarkers() {
  const found = [];
  for (const marker of BUILD_MARKERS) {
    if (existsSync(repoPath(marker.file))) {
      found.push({ file: marker.file, kind: marker.kind });
    }
  }
  return found;
}

// package.json script names are facts; the user decides which command builds the project.
function detectNodeScripts() {
  const path = repoPath("package.json");
  if (!existsSync(path)) return null;
  try {
    const pkg = readJson(path);
    const scripts = pkg.scripts && typeof pkg.scripts === "object" ? Object.keys(pkg.scripts).sort() : [];
    return {
      name: typeof pkg.name === "string" ? pkg.name : null,
      private: pkg.private === true,
      scriptNames: scripts,
      hasDependencies: Boolean(pkg.dependencies) || Boolean(pkg.devDependencies),
      engines: pkg.engines ?? null,
    };
  } catch (error) {
    // A parse failure is a fact and must not be reported as a missing package.json.
    return { error: `Failed to parse package.json: ${error.message}` };
  }
}

// Preserve the zero-dependency boundary: inspect pyproject.toml presence and
// recognizable sections without introducing a TOML parser.
function detectPythonFacts() {
  const path = repoPath("pyproject.toml");
  if (!existsSync(path)) return null;
  const text = readText(path);
  return {
    hasBuildSystem: text.includes("[build-system]"),
    hasProjectScripts: text.includes("[project.scripts]"),
    hasPoetry: text.includes("[tool.poetry]"),
    hasSetuptools: text.includes("setuptools"),
    mentionsCExtension: text.includes("ext-modules") || text.includes("cibuildwheel"),
  };
}

function detectStaticEntries() {
  return STATIC_ENTRIES.filter((entry) => existsSync(repoPath(entry)));
}

function detectSourceExtensions() {
  const counts = {};
  for (const filePath of listFiles(ROOT, (path) => SOURCE_EXTENSIONS.has(extname(path)))) {
    const relativePath = relative(ROOT, filePath).replaceAll("\\", "/");
    if (isSelfFile(relativePath)) continue;
    const ext = extname(filePath);
    counts[ext] = (counts[ext] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
}

function detectExistingWorkflows() {
  const directory = repoPath(".github/workflows");
  if (!existsSync(directory)) return [];
  return listFiles(directory, (path) => [".yml", ".yaml"].includes(extname(path)))
    .map((path) => basename(path))
    .sort();
}

// Run a gh subcommand and always return { ok, stdout, stderr, code }. Failures
// are probe facts and must never be interpreted as an empty successful result.
function runGh(args) {
  try {
    const stdout = execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 20000 });
    return { ok: true, stdout, stderr: "", code: 0 };
  } catch (error) {
    return {
      ok: false,
      stdout: typeof error.stdout === "string" ? error.stdout : "",
      stderr: typeof error.stderr === "string" ? error.stderr : String(error.message ?? error),
      code: typeof error.status === "number" ? error.status : null,
    };
  }
}

// gh api exits 1 for both 403 and 404 and writes its error JSON to stdout, so
// classify the response from .status rather than the exit code alone.
function ghApi(endpoint) {
  const result = runGh(["api", endpoint]);
  if (result.ok) {
    try {
      return { state: "ok", data: JSON.parse(result.stdout) };
    } catch {
      return { state: "unparseable", raw: result.stdout.slice(0, 500) };
    }
  }
  try {
    const body = JSON.parse(result.stdout);
    return { state: "http-error", status: body.status ?? null, message: body.message ?? null };
  } catch {
    return { state: "failed", message: result.stderr.trim().slice(0, 500) };
  }
}

// Token scopes are available only from the X-Oauth-Scopes response header.
// Do not use `gh auth status`: it can exit 0 after a timeout and is not reliable.
function detectTokenScopes() {
  const result = runGh(["api", "-i", "rate_limit"]);
  const payload = result.ok ? result.stdout : result.stdout || result.stderr;
  const line = payload.split(/\r?\n/).find((row) => row.toLowerCase().startsWith("x-oauth-scopes:"));
  if (!line) {
    return { state: "unknown", reason: result.ok ? "The response did not include X-Oauth-Scopes" : result.stderr.trim().slice(0, 300) };
  }
  const scopes = line.slice(line.indexOf(":") + 1).split(",").map((s) => s.trim()).filter(Boolean);
  return { state: "ok", scopes };
}

function probeRemote() {
  if (!runGh(["--version"]).ok) {
    return { available: false, reason: "gh CLI was not found, so remote facts are unavailable; install gh and rerun this command" };
  }

  const tokenScopes = detectTokenScopes();
  const repo = ghApi("repos/{owner}/{repo}");
  if (repo.state !== "ok") {
    return { available: false, reason: `Failed to read repository information: ${repo.message ?? repo.state}`, tokenScopes };
  }

  const defaultBranch = typeof repo.data.default_branch === "string" ? repo.data.default_branch : "main";
  return {
    available: true,
    tokenScopes,
    repository: {
      nameWithOwner: repo.data.full_name ?? null,
      visibility: repo.data.visibility ?? null,
      private: repo.data.private === true,
      ownerType: repo.data.owner?.type ?? null,
      isAdmin: repo.data.permissions?.admin === true,
      hasPages: repo.data.has_pages === true,
      defaultBranch,
    },
    pages: ghApi("repos/{owner}/{repo}/pages"),
    environments: ghApi("repos/{owner}/{repo}/environments"),
    rulesets: ghApi("repos/{owner}/{repo}/rulesets"),
    branchProtection: ghApi(`repos/{owner}/{repo}/branches/${defaultBranch}/protection`),
    secrets: ghApi("repos/{owner}/{repo}/actions/secrets"),
    variables: ghApi("repos/{owner}/{repo}/actions/variables"),
    workflowPermissions: ghApi("repos/{owner}/{repo}/actions/permissions/workflow"),
  };
}

// Preflight reports verified blockers without deciding how the user should resolve them.
function buildPreflight(remote) {
  const blockers = [];
  const notes = [];

  if (!remote.available) {
    blockers.push(`Remote facts are unavailable: ${remote.reason}`);
    return { blockers, notes };
  }

  const scopes = remote.tokenScopes;
  if (scopes.state === "ok") {
    if (!scopes.scopes.includes("workflow")) {
      blockers.push("The token lacks the workflow scope, so GitHub will reject pushes to .github/workflows/*; run gh auth refresh -h github.com -s workflow first");
    }
  } else {
    blockers.push(`Token scopes could not be confirmed (${scopes.reason}); an unknown state cannot be treated as passing`);
  }

  if (!remote.repository.isAdmin) {
    blockers.push("The current identity lacks repository admin permission, so enabling Pages, creating environments, or configuring branch protection will fail");
  }
  if (remote.repository.private) {
    notes.push("The repository is private: on the free plan, environments, branch protection, rulesets, and Pages are unavailable; explicitly skip unsupported items instead of omitting them silently");
  }
  return { blockers, notes };
}

function summarize(facts) {
  const lines = ["", "== CI/CD probe results =="];
  const kinds = [...new Set(facts.local.buildMarkers.map((m) => m.kind))];
  lines.push(`Build-system markers: ${kinds.length > 0 ? kinds.join(", ") : "none detected"}`);
  lines.push(`Static entries: ${facts.local.staticEntries.length > 0 ? facts.local.staticEntries.join(", ") : "none"}`);
  const exts = Object.entries(facts.local.sourceExtensions).slice(0, 5).map(([e, n]) => `${e}×${n}`);
  lines.push(`Source distribution: ${exts.length > 0 ? exts.join(", ") : "none"}`);
  lines.push(`Existing workflows: ${facts.local.existingWorkflows.length > 0 ? facts.local.existingWorkflows.join(", ") : "none"}`);

  if (facts.remote.available) {
    const repo = facts.remote.repository;
    lines.push(`Remote repository: ${repo.nameWithOwner} (${repo.visibility}, admin=${repo.isAdmin}, Pages=${repo.hasPages})`);
  } else {
    lines.push(`Remote repository: unavailable -- ${facts.remote.reason}`);
  }

  if (facts.preflight.blockers.length > 0) {
    lines.push("", "Blockers (resolve these before generating anything):");
    for (const blocker of facts.preflight.blockers) lines.push(`- ${blocker}`);
  }
  if (facts.preflight.notes.length > 0) {
    lines.push("", "Notes:");
    for (const note of facts.preflight.notes) lines.push(`- ${note}`);
  }
  lines.push("", "These are facts only. You must choose the build command, test command, and deployment target; the probe does not infer them.", "");
  return lines.join("\n");
}

const facts = {
  probedAt: new Date().toISOString(),
  local: {
    buildMarkers: detectBuildMarkers(),
    node: detectNodeScripts(),
    python: detectPythonFacts(),
    staticEntries: detectStaticEntries(),
    sourceExtensions: detectSourceExtensions(),
    existingWorkflows: detectExistingWorkflows(),
  },
  remote: probeRemote(),
};
facts.preflight = buildPreflight(facts.remote);

const outputDirectory = repoPath(".cicd");
mkdirSync(outputDirectory, { recursive: true });
const outputPath = resolve(outputDirectory, "probe.json");
writeFileSync(outputPath, `${JSON.stringify(facts, null, 2)}\n`, "utf8");

process.stdout.write(summarize(facts));
process.stdout.write(`Fact inventory written to ${relative(ROOT, outputPath)}\n`);

// Exit nonzero when blockers exist so callers cannot mistake them for approval to proceed.
process.exit(facts.preflight.blockers.length > 0 ? 1 : 0);
