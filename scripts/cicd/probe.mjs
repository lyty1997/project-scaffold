// CI/CD 探测器：只收集事实，不做任何决策。
//
// 设计约束见 docs/architecture/cicd-autosetup.md：
// - 探测只用来「选工具链」，不用来「猜构建/测试命令」。因此这里输出的是
//   「package.json 里有哪些 script 名」这类事实，而不是「构建命令是 npm run build」这类推断。
// - 全部只读；远端调用只用 GET。
// - 拿不到数据必须显式记录失败原因，不得静默当作「没有」。

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, extname, relative, resolve } from "node:path";
import { listFiles, projectRoot, readJson, readText } from "../quality/lib/files.mjs";

const ROOT = projectRoot();

// 构建系统特征文件 -> 归类名。只记录「存在什么」，不推断该怎么调用。
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

// 静态站点入口候选，用于判断「可能要发 Pages/Cloudflare/Vercel」。
const STATIC_ENTRIES = ["public/index.html", "index.html", "site/index.html", "dist/index.html"];

// 统计源码扩展名分布时关心的语言扩展名。
const SOURCE_EXTENSIONS = new Set([
  ".c", ".h", ".cc", ".cpp", ".cxx", ".hpp", ".hxx",
  ".py", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".rs", ".go", ".java", ".cs", ".rb", ".php", ".html", ".css",
]);

// 探测器自身与质量脚本不算「项目源码」，避免脚手架自己的文件把分布带偏。
const SELF_PREFIXES = ["scripts/", ".claude/", ".githooks/", "codex-rules/", "docs/"];

function repoPath(...parts) {
  return resolve(ROOT, ...parts);
}

function isSelfFile(relativePath) {
  return SELF_PREFIXES.some((prefix) => relativePath.startsWith(prefix));
}

// 收集构建系统标记：返回 [{ file, kind }]，按仓库相对路径去重排序。
function detectBuildMarkers() {
  const found = [];
  for (const marker of BUILD_MARKERS) {
    if (existsSync(repoPath(marker.file))) {
      found.push({ file: marker.file, kind: marker.kind });
    }
  }
  return found;
}

// package.json 的 script 名清单是事实；具体哪个是构建命令由使用者拍板。
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
    // 解析失败是事实的一部分，必须透出，不能当成「没有 package.json」。
    return { error: `package.json 解析失败: ${error.message}` };
  }
}

// pyproject.toml 不做 TOML 解析（零依赖约束），只做存在性与关键段落的文本特征判断。
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

// 执行 gh 子命令。返回 { ok, stdout, stderr, code }，绝不抛出——
// 失败本身是要记录的事实，但也绝不当成「探测到空」。
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

// gh api 对 403/404 一律 exit 1 且错误 JSON 走 stdout，
// 所以判定必须解析响应体的 .status，不能只看退出码。
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

// token scope 只能从响应头 X-Oauth-Scopes 取。
// 明确不用 `gh auth status`：实测它在超时报错时仍然 exit 0，是不可靠判据。
function detectTokenScopes() {
  const result = runGh(["api", "-i", "rate_limit"]);
  const payload = result.ok ? result.stdout : result.stdout || result.stderr;
  const line = payload.split(/\r?\n/).find((row) => row.toLowerCase().startsWith("x-oauth-scopes:"));
  if (!line) {
    return { state: "unknown", reason: result.ok ? "响应头里没有 X-Oauth-Scopes" : result.stderr.trim().slice(0, 300) };
  }
  const scopes = line.slice(line.indexOf(":") + 1).split(",").map((s) => s.trim()).filter(Boolean);
  return { state: "ok", scopes };
}

function probeRemote() {
  if (!runGh(["--version"]).ok) {
    return { available: false, reason: "未找到 gh CLI，远端事实无法探测；装好 gh 后重跑本命令" };
  }

  const tokenScopes = detectTokenScopes();
  const repo = ghApi("repos/{owner}/{repo}");
  if (repo.state !== "ok") {
    return { available: false, reason: `读取仓库信息失败: ${repo.message ?? repo.state}`, tokenScopes };
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

// preflight 只陈述「已核实的阻塞事实」，不替使用者决定怎么办。
function buildPreflight(remote) {
  const blockers = [];
  const notes = [];

  if (!remote.available) {
    blockers.push(`远端事实不可用：${remote.reason}`);
    return { blockers, notes };
  }

  const scopes = remote.tokenScopes;
  if (scopes.state === "ok") {
    if (!scopes.scopes.includes("workflow")) {
      blockers.push("token 缺少 workflow scope：推送 .github/workflows/* 会被 GitHub 拒绝，先跑 gh auth refresh -h github.com -s workflow");
    }
  } else {
    blockers.push(`无法确认 token scope（${scopes.reason}）；状态未知不得当作通过`);
  }

  if (!remote.repository.isAdmin) {
    blockers.push("当前身份对该仓库没有 admin 权限：开 Pages、建 environment、配分支保护都会失败");
  }
  if (remote.repository.private) {
    notes.push("仓库为 private：免费计划下 environments、分支保护、rulesets、Pages 均不可用，相关项需显式跳过而不是静默不配");
  }
  return { blockers, notes };
}

function summarize(facts) {
  const lines = ["", "== CI/CD 探测结果 =="];
  const kinds = [...new Set(facts.local.buildMarkers.map((m) => m.kind))];
  lines.push(`构建系统标记：${kinds.length > 0 ? kinds.join(", ") : "未探测到"}`);
  lines.push(`静态入口：${facts.local.staticEntries.length > 0 ? facts.local.staticEntries.join(", ") : "无"}`);
  const exts = Object.entries(facts.local.sourceExtensions).slice(0, 5).map(([e, n]) => `${e}×${n}`);
  lines.push(`源码分布：${exts.length > 0 ? exts.join(", ") : "无"}`);
  lines.push(`已有 workflow：${facts.local.existingWorkflows.length > 0 ? facts.local.existingWorkflows.join(", ") : "无"}`);

  if (facts.remote.available) {
    const repo = facts.remote.repository;
    lines.push(`远端仓库：${repo.nameWithOwner}（${repo.visibility}，admin=${repo.isAdmin}，Pages=${repo.hasPages}）`);
  } else {
    lines.push(`远端仓库：不可用 —— ${facts.remote.reason}`);
  }

  if (facts.preflight.blockers.length > 0) {
    lines.push("", "阻塞项（必须先解决，否则不要开始生成）：");
    for (const blocker of facts.preflight.blockers) lines.push(`- ${blocker}`);
  }
  if (facts.preflight.notes.length > 0) {
    lines.push("", "注意事项：");
    for (const note of facts.preflight.notes) lines.push(`- ${note}`);
  }
  lines.push("", "以上只是事实。构建命令、测试命令、部署目标必须由你拍板，探测器不做推断。", "");
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
process.stdout.write(`事实清单已写入 ${relative(ROOT, outputPath)}\n`);

// 阻塞项存在时以非零退出，避免调用方把「有阻塞」误当成「可以继续」。
process.exit(facts.preflight.blockers.length > 0 ? 1 : 0);
