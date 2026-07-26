// CI/CD 渲染器：台账 JSON -> workflow YAML。
//
// 设计见 docs/architecture/cicd-autosetup.md：
// - 真相源是 docs/contracts/cicd-answers.json，YAML 只是产物。本文件只写不读 YAML，
//   因此不需要 YAML 解析器，天然满足零第三方依赖约束。
// - 「结构与安全骨架」在这里固化，不依赖调用方临场记得；台账违反不变量时**硬失败**，
//   绝不悄悄修正后继续（那会把问题埋进产物里）。

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { basename, dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { projectRoot } from "../quality/lib/files.mjs";

const ROOT = projectRoot();
const ANSWERS_PATH = resolve(ROOT, "docs/contracts/cicd-answers.json");
const WORKFLOW_DIRECTORY = resolve(ROOT, ".github/workflows");
export const MANAGED_MARKER = "# managed-by: scripts/cicd/render.mjs";
export const RELEASE_PLEASE_CONFIG_NAME = "release-please-config.json";
export const RELEASE_PLEASE_MANIFEST_NAME = ".release-please-manifest.json";
const RELEASE_PLEASE_CONFIG_PATH = resolve(ROOT, RELEASE_PLEASE_CONFIG_NAME);
const RELEASE_PLEASE_MANIFEST_PATH = resolve(ROOT, RELEASE_PLEASE_MANIFEST_NAME);
const RELEASE_PLEASE_ACTION =
  "googleapis/release-please-action@45996ed1f6d02564a971a2fa1b5860e934307cf7";
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const SUPPORTED_RELEASE_TYPES = new Set(["node", "simple"]);
const MANAGED_CONFIG_DIGEST = "managed-config-sha256";
const RELEASE_CONFIG_FIELDS = new Set([
  "$schema",
  "bootstrap-sha",
  "extra-files",
  "group-pull-request-title-pattern",
  "include-component-in-tag",
  "include-v-in-tag",
  "packages",
  "pull-request-title-pattern",
  "release-type",
  "skip-github-release",
  "version-file",
]);
const RELEASE_PACKAGE_FIELDS = new Set([
  "extra-files",
  "release-type",
  "skip-github-release",
  "version-file",
]);

// ---------------------------------------------------------------------------
// 受限 YAML 序列化器：只覆盖 map / seq / string / number / bool / 块标量。
// 输出集合完全可控，所以不需要解析器；也正因此同一份 JSON 在任何机器上字节一致，
// 漂移检测可以直接做字节比对。
// ---------------------------------------------------------------------------

// YAML 1.1 会把这些裸字面量读成 bool/null，作为字符串输出时必须加引号。
const RESERVED_PLAIN = new Set([
  "true", "false", "yes", "no", "on", "off", "null", "~", "y", "n",
]);

function needsQuote(text) {
  if (text === "") return true;
  if (RESERVED_PLAIN.has(text.toLowerCase())) return true;
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(text)) return true;
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(text)) return true;
  if (text !== text.trim()) return true;
  // ": " 会被读成映射，" #" 会被读成注释。
  return text.includes(": ") || text.includes(" #") || text.endsWith(":");
}

function quote(text) {
  return `"${text.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function scalar(value) {
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value !== "string") {
    throw new TypeError(`不支持的 YAML 标量类型：${typeof value}`);
  }
  return needsQuote(value) ? quote(value) : value;
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// 把 key/value 渲染成若干行；indent 为当前缩进空格数。
function renderEntry(key, value, indent) {
  const pad = " ".repeat(indent);

  if (typeof value === "string" && value.includes("\n")) {
    const body = value.replace(/\n+$/, "").split("\n");
    return [`${pad}${key}: |`, ...body.map((line) => `${pad}  ${line}`.trimEnd())];
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${pad}${key}: []`];
    return [`${pad}${key}:`, ...renderSequence(value, indent)];
  }
  if (isPlainObject(value)) {
    if (Object.keys(value).length === 0) return [`${pad}${key}: {}`];
    return [`${pad}${key}:`, ...renderMap(value, indent + 2)];
  }
  return [`${pad}${key}: ${scalar(value)}`];
}

function renderSequence(items, indent) {
  const pad = " ".repeat(indent);
  const lines = [];
  for (const item of items) {
    if (isPlainObject(item)) {
      if (Object.keys(item).length === 0) {
        lines.push(`${pad}- {}`);
        continue;
      }
      const inner = renderMap(item, indent + 2);
      // 第一行换成 "- "，其余保持缩进对齐。
      lines.push(`${pad}- ${inner[0].slice(indent + 2)}`, ...inner.slice(1));
      continue;
    }
    if (Array.isArray(item)) {
      throw new TypeError("不支持嵌套数组，请改用对象包一层");
    }
    lines.push(`${pad}- ${scalar(item)}`);
  }
  return lines;
}

function renderMap(map, indent) {
  const lines = [];
  for (const [key, value] of Object.entries(map)) {
    if (value === undefined) continue;
    lines.push(...renderEntry(key, value, indent));
  }
  return lines;
}

export function toYaml(document) {
  return `${renderMap(document, 0).join("\n")}\n`;
}

// ---------------------------------------------------------------------------
// 设计不变量：违反即硬失败，并指明台账里该改哪一项。
// ---------------------------------------------------------------------------

// GitHub 官方组织的 action 允许用 tag；其余第三方必须钉 40 位 SHA。
const TRUSTED_ACTION_OWNERS = new Set(["actions", "github"]);
const LOOSE_SECRET_REFERENCE = /\$\{\{secrets\./;
const BRACKET_SECRET_REFERENCE = /\$\{\{\s*secrets\s*\[/;

function checkActionRef(uses, where, errors) {
  const [owner] = uses.split("/");
  if (TRUSTED_ACTION_OWNERS.has(owner)) return;
  if (!/@[0-9a-f]{40}$/.test(uses)) {
    errors.push(`${where}: 第三方 action \`${uses}\` 必须钉 40 位 SHA（供应链风险），改成 owner/repo@<sha>`);
  }
}

// 本仓库 check-secrets.mjs 实测会把 `${{secrets.X}}`（无空格）与带引号的写法判为密钥泄漏。
// 这里在生成端强制唯一合规写法，而不是去放宽扫描器——放宽会削弱真实防护。
function checkSecretStyle(text, where, errors) {
  if (LOOSE_SECRET_REFERENCE.test(text)) {
    errors.push(`${where}: secrets 引用必须写成 \${{ secrets.NAME }}（花括号内留空格），否则本仓库密钥扫描会误判为泄漏`);
  }
  for (const match of text.matchAll(/["']\$\{\{\s*secrets\./g)) {
    errors.push(`${where}: secrets 引用外面不要加引号（位置 ${match.index}），否则本仓库密钥扫描会误判为泄漏`);
  }
  if (BRACKET_SECRET_REFERENCE.test(text)) {
    errors.push(`${where}: secrets 不允许 bracket 写法，必须使用可静态登记来源的 \${{ secrets.NAME }}`);
  }
}

function collectSecretNames(text, into) {
  for (const expression of text.matchAll(/\$\{\{([\s\S]*?)\}\}/g)) {
    for (const match of expression[1].matchAll(
      /\bsecrets\.([A-Za-z_][A-Za-z0-9_]*)\b/g,
    )) {
      into.add(match[1]);
    }
  }
}

// ---------------------------------------------------------------------------
// 装配：台账描述「做什么」，这里补齐「怎么做才安全」。
// ---------------------------------------------------------------------------

// 部署步骤的闸门表达式（不含 ${{ }}，便于与使用者自带的 if 条件合成同一个表达式块）：
// PR 上永不真发布；手动触发时默认走演练。
const DEPLOY_GUARD_EXPRESSION =
  "github.event_name != 'pull_request' && (github.event_name != 'workflow_dispatch' || !inputs.dry_run)";

// 把 `${{ expr }}` 剥成 `expr`；已经是裸表达式就原样返回。
// 不剥的话合成出来的 `${{ A }} && (B)` 是非法表达式，workflow 直接跑不起来。
function bareExpression(text) {
  const wrapped = /^\s*\$\{\{(.*)\}\}\s*$/s.exec(text);
  return (wrapped ? wrapped[1] : text).trim();
}

// env / with 是嵌套对象，必须递归扫描，否则 `env: { X: "${{secrets.Y}}" }` 这类
// 违规会整条漏网——而这恰恰是最常见的 secrets 写法位置。
function walkStrings(value, visit) {
  if (typeof value === "string") {
    visit(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walkStrings(item, visit);
    return;
  }
  if (isPlainObject(value)) {
    for (const item of Object.values(value)) walkStrings(item, visit);
  }
}

function normalizeStep(
  step,
  where,
  errors,
  secretNames,
  isDeploy,
  workflowState,
) {
  if (!isPlainObject(step)) {
    errors.push(`${where}: step 必须是对象`);
    return {};
  }
  if (
    Object.hasOwn(step, "continue-on-error") &&
    step["continue-on-error"] !== false
  ) {
    errors.push(
      `${where}: continue-on-error 只能省略或显式为 false；true 与动态表达式都可能制造假绿`,
    );
  }
  walkStrings(step, (text) => {
    checkSecretStyle(text, where, errors);
    collectSecretNames(text, secretNames);
  });

  const normalized = {};
  if (step.name) normalized.name = step.name;
  if (step.id) normalized.id = step.id;

  const hasUses = typeof step.uses === "string" && step.uses.trim() !== "";
  const hasRun = typeof step.run === "string" && step.run.trim() !== "";
  if (hasUses === hasRun) {
    errors.push(`${where}: 必须且只能声明 uses 或 run 其中一个`);
  }
  if (step.uses !== undefined && !hasUses) {
    errors.push(`${where}: uses 必须是非空字符串`);
  }
  if (step.run !== undefined && !hasRun) {
    errors.push(`${where}: run 必须是非空字符串`);
  }

  if (hasUses) {
    checkActionRef(step.uses, where, errors);
    normalized.uses = step.uses;
  }
  if (hasRun) {
    normalized.run = step.run;
    // 不写 shell 时 Linux 默认是 `bash -e`（无 pipefail），`false | true` 会静默通过。
    normalized.shell = step.shell ?? "bash";
  }
  const hasDeployClassification = Object.hasOwn(step, "deployStep");
  if (isDeploy && !hasDeployClassification) {
    errors.push(
      `${where}.deployStep: kind: deploy 的每个 step 都必须显式写 true（真实发布）或 false（安全准备/验证）`,
    );
  }
  if (!isDeploy && hasDeployClassification) {
    errors.push(
      `${where}.deployStep: 只允许在 kind: deploy 的 workflow 中使用`,
    );
  }
  if (
    hasDeployClassification &&
    typeof step.deployStep !== "boolean"
  ) {
    errors.push(`${where}.deployStep: 必须是布尔值`);
  }
  const guardAsDeploy =
    isDeploy &&
    (!hasDeployClassification || step.deployStep !== false);
  if (guardAsDeploy) {
    if (step.deployStep === true) workflowState.deployStepCount += 1;
    const guard = step.if
      ? `${DEPLOY_GUARD_EXPRESSION} && (${bareExpression(step.if)})`
      : DEPLOY_GUARD_EXPRESSION;
    normalized.if = `\${{ ${guard} }}`;
  } else if (step.if) {
    normalized.if = step.if;
  }
  if (step.with) normalized.with = step.with;
  if (step.env) normalized.env = step.env;
  return normalized;
}

function normalizeJob(
  job,
  where,
  errors,
  secretNames,
  isDeploy,
  workflowState,
) {
  if (!isPlainObject(job)) {
    errors.push(`${where}: job 必须是对象`);
    return { "runs-on": "ubuntu-latest", steps: [] };
  }
  const normalized = {};
  if (job.name) normalized.name = job.name;

  if (job.matrix) {
    normalized["runs-on"] = job.runsOn ?? "${{ matrix.os }}";
    normalized.strategy = { "fail-fast": false, matrix: job.matrix };
  } else {
    normalized["runs-on"] = job.runsOn ?? "ubuntu-latest";
  }

  if (job.needs) normalized.needs = job.needs;
  if (job.permissions) normalized.permissions = job.permissions;
  if (job.environment) normalized.environment = job.environment;
  if (job.env) {
    walkStrings(job.env, (text) => {
      checkSecretStyle(text, `${where}.env`, errors);
      collectSecretNames(text, secretNames);
    });
    normalized.env = job.env;
  }

  if (!Array.isArray(job.steps) || job.steps.length === 0) {
    errors.push(`${where}: job 必须至少有一个 step`);
    normalized.steps = [];
    return normalized;
  }
  const stepIds = new Set();
  normalized.steps = job.steps.map((step, index) => {
    const stepWhere = `${where}.steps[${index}]`;
    if (isPlainObject(step) && step.id !== undefined) {
      if (
        typeof step.id !== "string" ||
        !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(step.id)
      ) {
        errors.push(`${stepWhere}.id: 必须是合法的 step id`);
      } else if (stepIds.has(step.id)) {
        errors.push(`${stepWhere}.id: \`${step.id}\` 在同一 job 内重复`);
      } else {
        stepIds.add(step.id);
      }
    }
    return normalizeStep(
      step,
      stepWhere,
      errors,
      secretNames,
      isDeploy,
      workflowState,
    );
  });
  return normalized;
}

function buildTriggers(spec, isDeploy, errors, where) {
  const on = {};
  if (spec.pullRequest) on.pull_request = {};
  if (Array.isArray(spec.pushBranches) && spec.pushBranches.length > 0) {
    on.push = { branches: spec.pushBranches };
  }
  if (Array.isArray(spec.pushTags) && spec.pushTags.length > 0) {
    on.push = { ...(on.push ?? {}), tags: spec.pushTags };
  }
  if (spec.pullRequestTarget) {
    errors.push(`${where}: 禁止 pull_request_target —— 它在 fork PR 上下文里能拿到仓库 secrets，是已知的凭证窃取入口`);
  }
  // 部署类必须可手动触发，否则「重跑旧 commit」这条回滚路径就不存在。
  if (isDeploy || spec.workflowDispatch) {
    on.workflow_dispatch = isDeploy
      ? {
          inputs: {
            dry_run: {
              description: "只演练不真正发布",
              type: "boolean",
              default: true,
              required: false,
            },
          },
        }
      : {};
  }
  if (Object.keys(on).length === 0) {
    errors.push(`${where}: 没有任何触发条件，这个 workflow 永远不会跑`);
  }
  return on;
}

export function renderWorkflow(spec, answersHash) {
  const errors = [];
  const secretNames = new Set();
  const where = `workflows[${spec.id ?? "?"}]`;
  const isDeploy = spec.kind === "deploy";
  const workflowState = { deployStepCount: 0 };

  const document = {
    name: spec.displayName ?? spec.id,
    on: buildTriggers(spec.on ?? {}, isDeploy, errors, where),
    // 声明任一项后未声明项自动为 none，因此这里给的就是最小集合。
    permissions: spec.permissions ?? { contents: "read" },
    concurrency: {
      group: spec.concurrencyGroup ?? "${{ github.workflow }}-${{ github.ref }}",
      // 部署与发版绝不能被后一次运行取消，否则会留下半完成状态。
      "cancel-in-progress": !isDeploy && spec.kind !== "release",
    },
    jobs: {},
  };

  if (!Array.isArray(spec.jobs) || spec.jobs.length === 0) {
    errors.push(`${where}: 必须至少有一个 job`);
  } else {
    const jobIds = new Set();
    for (const job of spec.jobs) {
      const jobId = job?.id;
      if (
        typeof jobId !== "string" ||
        !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(jobId)
      ) {
        errors.push(`${where}: job id 必须以字母或下划线开头，且只含字母、数字、_、-`);
        continue;
      }
      if (jobIds.has(jobId)) {
        errors.push(`${where}: job id \`${jobId}\` 重复`);
        continue;
      }
      jobIds.add(jobId);
      document.jobs[job.id] = normalizeJob(
        job,
        `${where}.jobs[${job.id}]`,
        errors,
        secretNames,
        isDeploy,
        workflowState,
      );
    }
  }
  if (isDeploy && workflowState.deployStepCount === 0) {
    errors.push(
      `${where}: kind: deploy 至少要有一个 deployStep: true，确保默认 dry_run 能拦住真实发布`,
    );
  }

  const metadata = Object.entries(spec.managedMetadata ?? {}).map(
    ([key, value]) => `# ${key}: ${value}`,
  );
  const header = [
    MANAGED_MARKER,
    `# answers-hash: ${answersHash}`,
    ...metadata,
    "# 本文件由 npm run gen:cicd 从 docs/contracts/cicd-answers.json 生成。",
    "# 不要手工编辑：改台账再重新生成，否则 npm run quality 会报漂移。",
    "",
  ].join("\n");

  return { yaml: header + toYaml(document), errors, secretNames: [...secretNames].sort() };
}

export function readAnswers() {
  if (!existsSync(ANSWERS_PATH)) return null;
  return JSON.parse(readFileSync(ANSWERS_PATH, "utf8"));
}

export function answersHash(answers) {
  return createHash("sha256").update(JSON.stringify(answers)).digest("hex").slice(0, 16);
}

function contentHash(content) {
  return createHash("sha256").update(content).digest("hex");
}

function sameKeys(left, right) {
  const a = Object.keys(left).sort();
  const b = Object.keys(right).sort();
  return a.length === b.length && a.every((key, index) => key === b[index]);
}

function validateVersionSource(path, where, errors) {
  if (typeof path !== "string" || path.trim() === "") {
    errors.push(`${where}: 版本源路径必须是非空字符串`);
    return;
  }
  if (isAbsolute(path)) {
    errors.push(`${where}: 版本源必须是仓库内相对路径，不能使用绝对路径`);
    return;
  }
  if (
    path.includes("\\") ||
    path.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    errors.push(`${where}: 版本源必须是规范化的仓库相对路径`);
    return;
  }
  const target = resolve(ROOT, path);
  const fromRoot = relative(ROOT, target);
  if (fromRoot === ".." || fromRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)) {
    errors.push(`${where}: 版本源不能逃逸仓库`);
    return;
  }
  let stats;
  try {
    stats = lstatSync(target);
  } catch (error) {
    if (error.code !== "ENOENT") {
      errors.push(`${where}: 无法读取版本源文件状态：${error.message}`);
      return;
    }
  }
  if (!stats || !stats.isFile()) {
    errors.push(`${where}: 版本源文件不存在：${path}`);
  } else if (stats.isSymbolicLink()) {
    errors.push(`${where}: 版本源不得是符号链接`);
  }
}

function validatePackagePath(path, errors) {
  if (typeof path !== "string" || path.trim() === "") {
    errors.push("releasePlease.config.packages 的 package path 必须是非空字符串");
    return;
  }
  if (
    path !== "." &&
    (isAbsolute(path) ||
      path.includes("\\") ||
      path.split("/").some((segment) => segment === "" || segment === "." || segment === ".."))
  ) {
    errors.push(`releasePlease.config.packages[${path}]: 必须是仓库内规范化相对目录`);
    return;
  }
  const target = resolve(ROOT, path);
  let stats;
  try {
    stats = lstatSync(target);
  } catch (error) {
    if (error.code !== "ENOENT") {
      errors.push(`releasePlease.config.packages[${path}]: 无法读取目录状态：${error.message}`);
      return;
    }
  }
  if (!stats || !stats.isDirectory()) {
    errors.push(`releasePlease.config.packages[${path}]: package 目录不存在`);
  } else if (stats.isSymbolicLink()) {
    errors.push(`releasePlease.config.packages[${path}]: package 目录不得是符号链接`);
  }
}

function packageFilePath(packagePath, file, where, errors) {
  if (
    typeof file !== "string" ||
    file.trim() === "" ||
    isAbsolute(file) ||
    file.includes("\\") ||
    file.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    errors.push(`${where}: 必须是 package 目录内的规范化相对文件路径`);
    return null;
  }
  return packagePath === "." ? file : `${packagePath}/${file}`;
}

function effectivePackageOption(config, packageConfig, key) {
  return packageConfig[key] ?? config[key];
}

function validateExtraFilesDeclaration(value, where, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${where} 必须是数组`);
    return;
  }

  const seenPaths = new Set();
  const supportedFields = new Set([
    "glob",
    "jsonpath",
    "path",
    "type",
    "xpath",
  ]);
  for (const [index, item] of value.entries()) {
    const itemWhere = `${where}[${index}]`;
    let path;
    if (typeof item === "string") {
      path = item;
    } else if (isPlainObject(item)) {
      for (const key of Object.keys(item)) {
        if (!supportedFields.has(key)) {
          errors.push(`${itemWhere}.${key}: 第二增量未支持该 extra-files 字段`);
        }
      }
      path = item.path;
      if (item.glob === true) {
        errors.push(
          `${itemWhere}: 第二增量不支持 glob；请展开为明确文件，避免版本源无法审计`,
        );
      } else if (item.glob !== undefined && typeof item.glob !== "boolean") {
        errors.push(`${itemWhere}.glob 必须是布尔值`);
      }
      const requiredSelector = {
        json: "jsonpath",
        toml: "jsonpath",
        yaml: "jsonpath",
        xml: "xpath",
      }[item.type];
      if (
        !["json", "toml", "yaml", "xml", "pom", "generic"].includes(item.type)
      ) {
        errors.push(`${itemWhere}.type 不是 release-please 支持的 extra-files 类型`);
      } else if (
        requiredSelector &&
        (typeof item[requiredSelector] !== "string" ||
          item[requiredSelector].trim() === "")
      ) {
        errors.push(`${itemWhere}.${requiredSelector} 必须是非空字符串`);
      }
    } else {
      errors.push(`${itemWhere}: 必须是路径字符串或带 type/path 的对象`);
      continue;
    }

    const normalizedPath = packageFilePath(
      ".",
      path,
      `${itemWhere}.path`,
      errors,
    );
    if (normalizedPath) {
      if (seenPaths.has(normalizedPath)) {
        errors.push(`${itemWhere}: 版本文件 \`${normalizedPath}\` 重复`);
      }
      seenPaths.add(normalizedPath);
    }
  }
}

function validateDeclaredReleaseOptions(container, where, errors) {
  if (Object.hasOwn(container, "release-type")) {
    const releaseType = container["release-type"];
    if (typeof releaseType !== "string" || releaseType.trim() === "") {
      errors.push(`${where}.release-type 必须是非空字符串`);
    } else if (!SUPPORTED_RELEASE_TYPES.has(releaseType)) {
      errors.push(
        `${where}.release-type: 第二增量只支持 node 或 simple，当前为 \`${releaseType}\``,
      );
    }
  }

  if (Object.hasOwn(container, "skip-github-release")) {
    const skipGitHubRelease = container["skip-github-release"];
    if (typeof skipGitHubRelease !== "boolean") {
      errors.push(`${where}.skip-github-release 必须是布尔值`);
    } else if (skipGitHubRelease) {
      errors.push(`${where}: 第二增量不允许 skip-github-release: true`);
    }
  }

  if (Object.hasOwn(container, "version-file")) {
    const versionFile = container["version-file"];
    if (typeof versionFile !== "string" || versionFile.trim() === "") {
      errors.push(`${where}.version-file 必须是非空字符串`);
    } else {
      packageFilePath(
        ".",
        versionFile,
        `${where}.version-file`,
        errors,
      );
    }
  }

  if (Object.hasOwn(container, "extra-files")) {
    validateExtraFilesDeclaration(
      container["extra-files"],
      `${where}.extra-files`,
      errors,
    );
  }
}

function validateExtraFiles(config, packageConfig, packagePath, errors) {
  const value = effectivePackageOption(config, packageConfig, "extra-files");
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    errors.push(`releasePlease.config.packages[${packagePath}].extra-files 必须是数组`);
    return [];
  }

  const paths = [];
  const seenPaths = new Set();
  for (const [index, item] of value.entries()) {
    const where = `releasePlease.config.packages[${packagePath}].extra-files[${index}]`;
    let path;
    if (typeof item === "string") {
      path = item;
    } else if (isPlainObject(item)) {
      path = item.path;
      if (item.glob === true) {
        errors.push(`${where}: 第二增量不支持 glob；请展开为明确文件，避免版本源无法审计`);
      } else if (item.glob !== undefined && typeof item.glob !== "boolean") {
        errors.push(`${where}.glob 必须是布尔值`);
      }
      const requiredSelector = {
        json: "jsonpath",
        toml: "jsonpath",
        yaml: "jsonpath",
        xml: "xpath",
      }[item.type];
      if (
        !["json", "toml", "yaml", "xml", "pom", "generic"].includes(item.type)
      ) {
        errors.push(`${where}.type 不是 release-please 支持的 extra-files 类型`);
      } else if (
        requiredSelector &&
        (typeof item[requiredSelector] !== "string" ||
          item[requiredSelector].trim() === "")
      ) {
        errors.push(`${where}.${requiredSelector} 必须是非空字符串`);
      }
    } else {
      errors.push(`${where}: 必须是路径字符串或带 type/path 的对象`);
      continue;
    }

    const repositoryPath = packageFilePath(packagePath, path, `${where}.path`, errors);
    if (repositoryPath) {
      if (seenPaths.has(repositoryPath)) {
        errors.push(`${where}: 版本文件 \`${repositoryPath}\` 重复`);
      } else {
        seenPaths.add(repositoryPath);
        paths.push({ path: repositoryPath, item });
      }
    }
  }
  return paths;
}

function validateVersionMapping(
  config,
  packages,
  versionSources,
  errors,
) {
  const mapping = {
    primaryVersionSources: {},
    releaseTypes: {},
  };
  if (!packages || !isPlainObject(versionSources)) {
    return mapping;
  }

  for (const [packagePath, packageConfig] of Object.entries(packages)) {
    if (!isPlainObject(packageConfig)) continue;
    const releaseType =
      packageConfig["release-type"] ?? config["release-type"];
    if (!SUPPORTED_RELEASE_TYPES.has(releaseType)) continue;
    mapping.releaseTypes[packagePath] = releaseType;

    let primaryPath;
    if (releaseType === "node") {
      primaryPath = packageFilePath(
        packagePath,
        "package.json",
        `releasePlease.config.packages[${packagePath}]`,
        errors,
      );
    } else {
      const versionFile = effectivePackageOption(
        config,
        packageConfig,
        "version-file",
      ) ?? "version.txt";
      primaryPath = packageFilePath(
        packagePath,
        versionFile,
        `releasePlease.config.packages[${packagePath}].version-file`,
        errors,
      );
    }

    const extras = validateExtraFiles(
      config,
      packageConfig,
      packagePath,
      errors,
    );
    const mappedPaths = new Set(
      [primaryPath, ...extras.map((extra) => extra.path)].filter(Boolean),
    );
    if (primaryPath) mapping.primaryVersionSources[packagePath] = primaryPath;
    const declaredPaths = new Set(
      Array.isArray(versionSources[packagePath])
        ? versionSources[packagePath]
        : [],
    );
    for (const path of mappedPaths) {
      if (!declaredPaths.has(path)) {
        errors.push(
          `releasePlease.versionSources[${packagePath}]: 缺少 release-please 会更新的版本文件 \`${path}\``,
        );
      }
    }
    for (const path of declaredPaths) {
      if (!mappedPaths.has(path)) {
        errors.push(
          `releasePlease.versionSources[${packagePath}]: \`${path}\` 未映射到 ${releaseType} 主版本文件或 extra-files`,
        );
      }
    }

    for (const extra of extras) {
      if (
        (typeof extra.item === "string" || extra.item.type === "generic") &&
        lstatIfPresent(resolve(ROOT, extra.path))?.isFile() &&
        !/x-release-please-(?:major|minor|patch|version|date)/.test(
          readFileSync(resolve(ROOT, extra.path), "utf8"),
        )
      ) {
        errors.push(
          `releasePlease.config.packages[${packagePath}].extra-files: \`${extra.path}\` 使用 generic updater 但没有 x-release-please-* 注解`,
        );
      }
    }
  }
  return mapping;
}

function isValidBranchName(value) {
  if (typeof value !== "string" || value.trim() === "") return false;
  if (
    value === "@" ||
    value === "HEAD" ||
    value.startsWith("-") ||
    value.startsWith("/") ||
    value.endsWith("/") ||
    value.endsWith(".") ||
    value.includes("..") ||
    value.includes("@{") ||
    /[\x00-\x20\x7f~^:?*[\]\\]/.test(value)
  ) {
    return false;
  }
  return !value.split("/").some(
    (component) =>
      component === "" ||
      component.startsWith(".") ||
      component.endsWith(".lock"),
  );
}

function isPortableWorkflowFileName(value) {
  if (typeof value !== "string" || !/^[\w.-]+\.ya?ml$/.test(value)) {
    return false;
  }
  const stem = value.slice(0, value.lastIndexOf(".")).toUpperCase();
  return !/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/.test(stem);
}

function validateReleaseTitlePattern(value, key, requiredPlaceholder, errors) {
  if (
    typeof value !== "string" ||
    !/^chore(?:\$\{scope\}|\([^)]+\)): /.test(value) ||
    !value.includes(" / ") ||
    !value.includes(requiredPlaceholder)
  ) {
    errors.push(
      `releasePlease.config.${key}: 必须符合双语提交主题结构并包含 ${requiredPlaceholder}`,
    );
  }
}

// release-please 的 manifest 是运行状态：这里只校验结构，不把它与 initialManifest 做字节比较。
// Release PR 合并后版本会前进，重新生成绝不能把它重置回 bootstrap 版本。
export function validateReleasePleaseManifest(releasePlease, manifest) {
  const errors = [];
  const expectedPackages = releasePlease?.packageKeys ?? [];

  if (!isPlainObject(manifest)) {
    return [`${RELEASE_PLEASE_MANIFEST_NAME}: 必须是 JSON 对象`];
  }
  if (!sameKeys(Object.fromEntries(expectedPackages.map((key) => [key, true])), manifest)) {
    errors.push(
      `${RELEASE_PLEASE_MANIFEST_NAME}: package path 必须与 release-please-config.json 的 packages 完全一致`,
    );
  }
  for (const [path, version] of Object.entries(manifest)) {
    if (typeof version !== "string" || !SEMVER.test(version)) {
      errors.push(`${RELEASE_PLEASE_MANIFEST_NAME}: \`${path}\` 的版本必须是合法 SemVer，当前为 \`${version}\``);
    }
  }
  return errors;
}

// versionSources 是审计清单，manifest 是 Release Please 的运行状态。这里核对两者当前值；
// initialManifest 只在首次 bootstrap 时传入，Release PR 演进后必须改传现有 manifest。
export function validateReleasePleaseVersionSources(releasePlease, manifest) {
  const errors = [];
  for (const packagePath of releasePlease?.packageKeys ?? []) {
    const source = releasePlease.primaryVersionSources?.[packagePath];
    const releaseType = releasePlease.releaseTypes?.[packagePath];
    if (!source || !releaseType) continue;

    let sourceVersion;
    try {
      if (releaseType === "node") {
        sourceVersion = JSON.parse(readFileSync(resolve(ROOT, source), "utf8")).version;
      } else {
        sourceVersion = readFileSync(resolve(ROOT, source), "utf8").trim();
      }
    } catch (error) {
      errors.push(
        `releasePlease.versionSources[${packagePath}]: 无法读取主版本文件 \`${source}\`：${error.message}`,
      );
      continue;
    }
    if (typeof sourceVersion !== "string" || !SEMVER.test(sourceVersion)) {
      errors.push(
        `releasePlease.versionSources[${packagePath}]: 主版本文件 \`${source}\` 的值 \`${sourceVersion}\` 不是合法 SemVer`,
      );
    } else if (sourceVersion !== manifest?.[packagePath]) {
      errors.push(
        `releasePlease.versionSources[${packagePath}]: 主版本文件 \`${source}\` 为 \`${sourceVersion}\`，与 manifest 的 \`${manifest?.[packagePath]}\` 不一致`,
      );
    }
  }
  return errors;
}

function buildReleasePlease(spec, answersHash) {
  if (spec === undefined) return { releasePlease: null, errors: [] };

  const errors = [];
  if (!isPlainObject(spec)) {
    return { releasePlease: null, errors: ["releasePlease 必须是对象"] };
  }

  const workflowFile = spec.workflowFile;
  if (!isPortableWorkflowFileName(workflowFile)) {
    errors.push("releasePlease.workflowFile 必须是形如 release-please.yml 的跨平台安全文件名");
  }

  const targetBranch = spec.targetBranch;
  if (!isValidBranchName(targetBranch)) {
    errors.push("releasePlease.targetBranch 必须是明确且合法的 Git 分支名");
  }

  const credential = spec.credential;
  let tokenReference;
  if (!isPlainObject(credential)) {
    errors.push("releasePlease.credential 必须显式声明 mode");
  } else if (credential.mode === "github-token") {
    if (credential.secretName !== undefined) {
      errors.push("releasePlease.credential 使用 github-token 时不要填写 secretName");
    }
  } else if (credential.mode === "secret") {
    if (
      typeof credential.secretName !== "string" ||
      !/^[A-Za-z_][A-Za-z0-9_]*$/.test(credential.secretName)
    ) {
      errors.push("releasePlease.credential.secretName 必须是合法的 GitHub Actions secret 名");
    } else {
      tokenReference = `\${{ secrets.${credential.secretName} }}`;
    }
  } else {
    errors.push("releasePlease.credential.mode 只能是 github-token 或 secret");
  }

  const config = spec.config;
  const packages = isPlainObject(config) && isPlainObject(config.packages) ? config.packages : null;
  if (isPlainObject(config)) {
    validateDeclaredReleaseOptions(
      config,
      "releasePlease.config",
      errors,
    );
    for (const key of Object.keys(config)) {
      if (key === "skip-github-pull-request") continue;
      if (!RELEASE_CONFIG_FIELDS.has(key)) {
        errors.push(
          `releasePlease.config.${key}: 第二增量未支持该 release-please 字段，不能未经校验原样透传`,
        );
      }
    }
    if (
      config.$schema !== undefined &&
      (typeof config.$schema !== "string" || config.$schema.trim() === "")
    ) {
      errors.push("releasePlease.config.$schema 必须是非空字符串");
    }
    if (Object.hasOwn(config, "skip-github-pull-request")) {
      errors.push(
        "releasePlease.config.skip-github-pull-request: 不是 manifest config 字段；第二增量也不允许跳过 Release PR",
      );
    }
  }
  if (!packages || Object.keys(packages).length === 0) {
    errors.push("releasePlease.config.packages 必须是非空对象");
  } else {
    for (const [path, packageConfig] of Object.entries(packages)) {
      validatePackagePath(path, errors);
      if (!isPlainObject(packageConfig)) {
        errors.push(`releasePlease.config.packages[${path}]: 必须是对象`);
        continue;
      }
      validateDeclaredReleaseOptions(
        packageConfig,
        `releasePlease.config.packages[${path}]`,
        errors,
      );
      for (const key of Object.keys(packageConfig)) {
        if (key === "skip-github-pull-request") continue;
        if (!RELEASE_PACKAGE_FIELDS.has(key)) {
          errors.push(
            `releasePlease.config.packages[${path}].${key}: 第二增量未支持该 package 字段，不能未经校验原样透传`,
          );
        }
      }
      const releaseType = packageConfig["release-type"] ?? config["release-type"];
      if (typeof releaseType !== "string" || releaseType.trim() === "") {
        errors.push(`releasePlease.config.packages[${path}]: 必须显式声明 release-type`);
      } else if (!SUPPORTED_RELEASE_TYPES.has(releaseType)) {
        errors.push(
          `releasePlease.config.packages[${path}]: 第二增量只支持 node 或 simple，当前为 \`${releaseType}\``,
        );
      }
      if (
        Object.hasOwn(packageConfig, "skip-github-pull-request")
      ) {
        errors.push(
          `releasePlease.config.packages[${path}]: skip-github-pull-request 不是 manifest config 字段；第二增量也不允许跳过 Release PR`,
        );
      }
      const skipGitHubRelease = effectivePackageOption(
        config,
        packageConfig,
        "skip-github-release",
      );
      if (
        skipGitHubRelease !== undefined &&
        typeof skipGitHubRelease !== "boolean"
      ) {
        errors.push(
          `releasePlease.config.packages[${path}].skip-github-release 必须是布尔值`,
        );
      } else if (skipGitHubRelease === true) {
        errors.push(
          `releasePlease.config.packages[${path}]: 第二增量不允许 skip-github-release: true`,
        );
      }
    }
  }
  for (const key of ["include-v-in-tag", "include-component-in-tag"]) {
    if (typeof config?.[key] !== "boolean") {
      errors.push(`releasePlease.config.${key} 必须显式写 true 或 false，不能猜 tag 规则`);
    }
  }
  if (
    config?.["bootstrap-sha"] !== undefined &&
    (typeof config["bootstrap-sha"] !== "string" ||
      !/^[0-9a-f]{40}$/.test(config["bootstrap-sha"]))
  ) {
    errors.push("releasePlease.config.bootstrap-sha 必须是完整的 40 位小写提交 SHA");
  }

  const pullRequestTitlePattern =
    config?.["pull-request-title-pattern"] ??
    "chore${scope}: release${component} ${version} / 发布${component} ${version}";
  const groupPullRequestTitlePattern =
    config?.["group-pull-request-title-pattern"] ??
    "chore(${branch}): release ${branch} / 发布 ${branch}";
  validateReleaseTitlePattern(
    pullRequestTitlePattern,
    "pull-request-title-pattern",
    "${version}",
    errors,
  );
  validateReleaseTitlePattern(
    groupPullRequestTitlePattern,
    "group-pull-request-title-pattern",
    "${branch}",
    errors,
  );

  const initialManifest = spec.initialManifest;
  if (!isPlainObject(initialManifest) || Object.keys(initialManifest).length === 0) {
    errors.push("releasePlease.initialManifest 必须是非空对象");
  }

  const versionSources = spec.versionSources;
  if (!isPlainObject(versionSources) || Object.keys(versionSources).length === 0) {
    errors.push("releasePlease.versionSources 必须按 package path 登记至少一个项目版本源");
  }

  if (packages && isPlainObject(initialManifest) && !sameKeys(packages, initialManifest)) {
    errors.push("releasePlease.initialManifest 的 package path 必须与 config.packages 完全一致");
  }
  if (packages && isPlainObject(versionSources) && !sameKeys(packages, versionSources)) {
    errors.push("releasePlease.versionSources 的 package path 必须与 config.packages 完全一致");
  }

  if (isPlainObject(initialManifest)) {
    for (const [path, version] of Object.entries(initialManifest)) {
      if (typeof version !== "string" || !SEMVER.test(version)) {
        errors.push(`releasePlease.initialManifest[${path}]: 必须是合法 SemVer`);
      }
    }
  }

  if (isPlainObject(versionSources)) {
    const sourceOwners = new Map();
    for (const [path, sources] of Object.entries(versionSources)) {
      if (!Array.isArray(sources) || sources.length === 0) {
        errors.push(`releasePlease.versionSources[${path}]: 必须是非空路径数组`);
        continue;
      }
      const packageSources = new Set();
      for (const [index, source] of sources.entries()) {
        validateVersionSource(source, `releasePlease.versionSources[${path}][${index}]`, errors);
        if (packageSources.has(source)) {
          errors.push(
            `releasePlease.versionSources[${path}]: 版本源 \`${source}\` 重复登记`,
          );
        } else {
          packageSources.add(source);
        }
        if (sourceOwners.has(source) && sourceOwners.get(source) !== path) {
          errors.push(
            `releasePlease.versionSources: \`${source}\` 同时归属于 package \`${sourceOwners.get(source)}\` 与 \`${path}\`，会产生双 writer`,
          );
        } else {
          sourceOwners.set(source, path);
        }
      }
    }
  }

  const versionMapping = validateVersionMapping(
    config,
    packages,
    versionSources,
    errors,
  );

  if (errors.length > 0) return { releasePlease: null, errors };

  const normalizedConfig = {
    ...config,
    "pull-request-title-pattern": pullRequestTitlePattern,
    "group-pull-request-title-pattern": groupPullRequestTitlePattern,
  };
  const configJson = `${JSON.stringify(normalizedConfig, null, 2)}\n`;
  const withInputs = {
    "config-file": RELEASE_PLEASE_CONFIG_NAME,
    "manifest-file": RELEASE_PLEASE_MANIFEST_NAME,
    "target-branch": targetBranch,
    ...(tokenReference ? { ["token"]: tokenReference } : {}),
  };

  const workflowSpec = {
    id: "release-please",
    file: workflowFile,
    kind: "release",
    displayName: "Release Please",
    on: { pushBranches: [targetBranch] },
    permissions: {
      contents: "write",
      issues: "write",
      "pull-requests": "write",
    },
    concurrencyGroup: "release-please-${{ github.ref }}",
    managedMetadata: {
      [MANAGED_CONFIG_DIGEST]: contentHash(configJson),
    },
    jobs: [
      {
        id: "release-please",
        name: "Release Please",
        runsOn: "ubuntu-latest",
        steps: [
          {
            name: "Create or update release",
            id: "release",
            uses: RELEASE_PLEASE_ACTION,
            with: withInputs,
          },
        ],
      },
    ],
  };
  const rendered = renderWorkflow(workflowSpec, answersHash);

  return {
    releasePlease: {
      workflowFile,
      workflowYaml: rendered.yaml,
      configJson,
      initialManifestJson: `${JSON.stringify(initialManifest, null, 2)}\n`,
      packageKeys: Object.keys(packages).sort(),
      versionSources,
      primaryVersionSources: versionMapping.primaryVersionSources,
      releaseTypes: versionMapping.releaseTypes,
    },
    errors: rendered.errors,
    secretNames: rendered.secretNames,
  };
}

// 渲染全部 workflow，返回 { file -> yaml } 与收集到的错误。供生成与门禁复用。
export function renderAll(answers) {
  const files = new Map();
  const errors = [];
  const secretNames = new Set();
  const workflowSpecs = [];
  const normalizedWorkflowFiles = new Set();

  if (!isPlainObject(answers)) {
    return {
      files,
      errors: ["台账根节点必须是 JSON 对象"],
      secretNames: [],
      releasePlease: null,
    };
  }

  const hash = answersHash(answers);

  if (answers.workflows !== undefined && !Array.isArray(answers.workflows)) {
    errors.push("台账的 workflows 必须是数组");
  } else if (Array.isArray(answers.workflows)) {
    workflowSpecs.push(...answers.workflows);
  }

  const release = buildReleasePlease(answers.releasePlease, hash);
  errors.push(...release.errors);
  if (release.releasePlease) {
    workflowSpecs.push({
      id: "release-please",
      file: release.releasePlease.workflowFile,
      __renderedYaml: release.releasePlease.workflowYaml,
    });
    for (const name of release.secretNames ?? []) secretNames.add(name);
  }

  if (workflowSpecs.length === 0 && answers.releasePlease === undefined) {
    errors.push("台账里没有声明任何 workflow（workflows 为空且未启用 releasePlease）");
  }

  for (const spec of workflowSpecs) {
    if (!isPlainObject(spec)) {
      errors.push("workflows 中的每一项都必须是对象");
      continue;
    }
    if (!isPortableWorkflowFileName(spec.file)) {
      errors.push(`workflows[${spec.id ?? "?"}]: file 必须是形如 build.yml 的跨平台安全文件名`);
      continue;
    }
    const normalizedFile = spec.file.toLowerCase();
    if (normalizedWorkflowFiles.has(normalizedFile)) {
      errors.push(`workflows[${spec.id ?? "?"}]: file \`${spec.file}\` 与另一 workflow 重复`);
      continue;
    }
    normalizedWorkflowFiles.add(normalizedFile);
    const rendered = spec.__renderedYaml
      ? { yaml: spec.__renderedYaml, errors: [], secretNames: [] }
      : renderWorkflow(spec, hash);
    errors.push(...rendered.errors);
    for (const name of rendered.secretNames) secretNames.add(name);
    files.set(spec.file, rendered.yaml);
  }
  return {
    files,
    errors,
    secretNames: [...secretNames].sort(),
    releasePlease: release.releasePlease,
  };
}

function lstatIfPresent(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function inspectRegularFile(path, shown, errors) {
  let stats;
  try {
    stats = lstatIfPresent(path);
  } catch (error) {
    errors.push(`${shown}: 无法读取文件状态：${error.message}`);
    return { exists: true, invalid: true };
  }
  if (stats === null) return { exists: false, content: null };
  if (stats.isSymbolicLink()) {
    errors.push(`${shown}: 拒绝符号链接，生成器不得跟随链接写出仓库`);
    return { exists: true, invalid: true };
  }
  if (!stats.isFile()) {
    errors.push(`${shown}: 已存在但不是普通文件`);
    return { exists: true, invalid: true };
  }
  try {
    return { exists: true, content: readFileSync(path, "utf8") };
  } catch (error) {
    errors.push(`${shown}: 无法读取：${error.message}`);
    return { exists: true, invalid: true };
  }
}

function inspectWorkflowDirectories(errors) {
  for (const [path, shown] of [
    [resolve(ROOT, ".github"), ".github"],
    [WORKFLOW_DIRECTORY, ".github/workflows"],
  ]) {
    const stats = lstatIfPresent(path);
    if (stats === null) continue;
    if (stats.isSymbolicLink()) {
      errors.push(`${shown}: 拒绝符号链接目录，生成器不得跟随链接写出仓库`);
    } else if (!stats.isDirectory()) {
      errors.push(`${shown}: 已存在但不是目录`);
    }
  }
}

function managedConfigDigestFromWorkflow(content) {
  const match = new RegExp(
    `^# ${MANAGED_CONFIG_DIGEST}: ([0-9a-f]{64})$`,
    "m",
  ).exec(content ?? "");
  return match?.[1] ?? null;
}

function prepareWritePlan(rendered) {
  const errors = [...rendered.errors];
  const artifacts = [];
  const workflowSnapshots = new Map();
  inspectWorkflowDirectories(errors);

  const desiredWorkflowNames = new Set(rendered.files.keys());
  const existingWorkflowNames = new Map();
  const workflowDirectoryStats = lstatIfPresent(WORKFLOW_DIRECTORY);
  if (workflowDirectoryStats?.isDirectory()) {
    for (const entry of readdirSync(WORKFLOW_DIRECTORY, {
      withFileTypes: true,
    })) {
      if (![".yml", ".yaml"].includes(extname(entry.name))) continue;
      const normalizedName = entry.name.toLowerCase();
      if (
        existingWorkflowNames.has(normalizedName) &&
        existingWorkflowNames.get(normalizedName) !== entry.name
      ) {
        errors.push(
          `.github/workflows: \`${existingWorkflowNames.get(normalizedName)}\` 与 \`${entry.name}\` 仅大小写不同，跨平台 checkout 会冲突`,
        );
      } else {
        existingWorkflowNames.set(normalizedName, entry.name);
      }
      const path = resolve(WORKFLOW_DIRECTORY, entry.name);
      const snapshot = inspectRegularFile(
        path,
        `.github/workflows/${entry.name}`,
        errors,
      );
      if (
        !snapshot.invalid &&
        snapshot.exists &&
        snapshot.content.startsWith(`${MANAGED_MARKER}\n`) &&
        !desiredWorkflowNames.has(entry.name)
      ) {
        errors.push(
          `.github/workflows/${entry.name}: 仍由生成器管理但台账已不声明；为避免旧 CI/CD 继续触发，先经使用者确认后删除或恢复台账`,
        );
      }
    }
  }

  for (const [file, content] of rendered.files) {
    const path = resolve(WORKFLOW_DIRECTORY, file);
    const shown = `.github/workflows/${file}`;
    const snapshot = inspectRegularFile(path, shown, errors);
    const existingCaseVariant = existingWorkflowNames.get(file.toLowerCase());
    if (existingCaseVariant && existingCaseVariant !== file) {
      errors.push(
        `${shown}: 与现有 .github/workflows/${existingCaseVariant} 仅大小写不同，拒绝生成跨平台冲突文件`,
      );
    }
    workflowSnapshots.set(file, snapshot);
    if (
      snapshot.exists &&
      !snapshot.invalid &&
      !snapshot.content.startsWith(`${MANAGED_MARKER}\n`)
    ) {
      errors.push(
        `${shown}: 已存在且不属于本渲染器，拒绝覆盖；请改 workflowFile/file，或在使用者确认后显式迁移`,
      );
    } else if (!snapshot.invalid && snapshot.content !== content) {
      artifacts.push({ path, shown, content, snapshot });
    }
  }

  const configSnapshot = inspectRegularFile(
    RELEASE_PLEASE_CONFIG_PATH,
    RELEASE_PLEASE_CONFIG_NAME,
    errors,
  );
  const manifestSnapshot = inspectRegularFile(
    RELEASE_PLEASE_MANIFEST_PATH,
    RELEASE_PLEASE_MANIFEST_NAME,
    errors,
  );

  if (rendered.releasePlease) {
    const releaseWorkflowSnapshot = workflowSnapshots.get(
      rendered.releasePlease.workflowFile,
    );
    if (
      configSnapshot.exists &&
      !configSnapshot.invalid &&
      configSnapshot.content !== rendered.releasePlease.configJson
    ) {
      const recordedDigest = managedConfigDigestFromWorkflow(
        releaseWorkflowSnapshot?.content,
      );
      if (
        recordedDigest === null ||
        recordedDigest !== contentHash(configSnapshot.content)
      ) {
        errors.push(
          `${RELEASE_PLEASE_CONFIG_NAME}: 现有内容无法由 managed release workflow 的摘要证明归属，拒绝覆盖；请先备份并由使用者确认迁移`,
        );
      }
    }

    let manifest;
    if (manifestSnapshot.exists && !manifestSnapshot.invalid) {
      try {
        manifest = JSON.parse(manifestSnapshot.content);
        errors.push(
          ...validateReleasePleaseManifest(rendered.releasePlease, manifest),
          ...validateReleasePleaseVersionSources(
            rendered.releasePlease,
            manifest,
          ),
        );
      } catch (error) {
        errors.push(
          `${RELEASE_PLEASE_MANIFEST_NAME}: JSON 解析失败：${error.message}`,
        );
      }
    } else if (!manifestSnapshot.invalid) {
      manifest = JSON.parse(rendered.releasePlease.initialManifestJson);
      errors.push(
        ...validateReleasePleaseVersionSources(
          rendered.releasePlease,
          manifest,
        ),
      );
      if (configSnapshot.exists || releaseWorkflowSnapshot?.exists) {
        errors.push(
          `${RELEASE_PLEASE_MANIFEST_NAME}: config 或 managed release workflow 已存在但 manifest 缺失，视为运行状态丢失；请从 Git/Release PR 恢复，不能用 initialManifest 重建`,
        );
      } else {
        artifacts.push({
          path: RELEASE_PLEASE_MANIFEST_PATH,
          shown: RELEASE_PLEASE_MANIFEST_NAME,
          content: rendered.releasePlease.initialManifestJson,
          snapshot: manifestSnapshot,
        });
      }
    }

    if (
      !configSnapshot.invalid &&
      configSnapshot.content !== rendered.releasePlease.configJson
    ) {
      artifacts.push({
        path: RELEASE_PLEASE_CONFIG_PATH,
        shown: RELEASE_PLEASE_CONFIG_NAME,
        content: rendered.releasePlease.configJson,
        snapshot: configSnapshot,
      });
    }
  } else {
    for (const [shown, snapshot] of [
      [RELEASE_PLEASE_CONFIG_NAME, configSnapshot],
      [RELEASE_PLEASE_MANIFEST_NAME, manifestSnapshot],
    ]) {
      if (snapshot.exists) {
        errors.push(
          `${shown}: 台账已停用 releasePlease，但旧产物仍存在；为避免旧发版继续触发，先经使用者确认后删除或恢复台账`,
        );
      }
    }
  }

  return { artifacts, errors };
}

function verifySnapshot(artifact) {
  const current = lstatIfPresent(artifact.path);
  if (!artifact.snapshot.exists) {
    if (current !== null) {
      throw new Error(`${artifact.shown}: 预检后突然出现，拒绝覆盖`);
    }
    return;
  }
  if (
    current === null ||
    current.isSymbolicLink() ||
    !current.isFile() ||
    readFileSync(artifact.path, "utf8") !== artifact.snapshot.content
  ) {
    throw new Error(`${artifact.shown}: 预检后发生变化，拒绝继续写入`);
  }
}

export function writeTransaction(
  artifacts,
  { rename = renameSync } = {},
) {
  if (artifacts.length === 0) return [];
  if (artifacts.some((artifact) => dirname(artifact.path) === WORKFLOW_DIRECTORY)) {
    mkdirSync(WORKFLOW_DIRECTORY, { recursive: true });
  }

  const staged = [];
  const applied = [];
  try {
    for (const [index, artifact] of artifacts.entries()) {
      const temporaryPath = resolve(
        dirname(artifact.path),
        `.${basename(artifact.path)}.cicd-stage-${process.pid}-${index}-${randomUUID()}`,
      );
      writeFileSync(temporaryPath, artifact.content, {
        encoding: "utf8",
        flag: "wx",
      });
      staged.push({ ...artifact, temporaryPath, backupPath: null });
    }

    for (const item of staged) {
      verifySnapshot(item);
      item.installed = false;
      applied.push(item);
      if (item.snapshot.exists) {
        item.backupPath = resolve(
          dirname(item.path),
          `.${basename(item.path)}.cicd-backup-${process.pid}-${randomUUID()}`,
        );
        rename(item.path, item.backupPath);
      }
      rename(item.temporaryPath, item.path);
      item.installed = true;
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const item of applied.reverse()) {
      try {
        if (item.installed && lstatIfPresent(item.path)) unlinkSync(item.path);
        if (item.backupPath && lstatIfPresent(item.backupPath)) {
          rename(item.backupPath, item.path);
          item.backupPath = null;
        }
      } catch (rollbackError) {
        rollbackErrors.push(`${item.shown}: ${rollbackError.message}`);
      }
    }
    for (const item of staged) {
      try {
        if (lstatIfPresent(item.temporaryPath)) unlinkSync(item.temporaryPath);
      } catch (cleanupError) {
        rollbackErrors.push(`${item.shown} 临时文件：${cleanupError.message}`);
      }
    }
    const suffix =
      rollbackErrors.length > 0
        ? `；回滚还遇到：${rollbackErrors.join("；")}`
        : "";
    throw new Error(`生成物事务写入失败：${error.message}${suffix}`);
  }

  const cleanupWarnings = [];
  for (const item of applied) {
    if (item.backupPath && lstatIfPresent(item.backupPath)) {
      try {
        unlinkSync(item.backupPath);
      } catch (error) {
        cleanupWarnings.push(
          `${item.shown}: 新产物已生效，但旧文件备份清理失败，保留在 ${item.backupPath}：${error.message}`,
        );
      }
    }
  }
  return cleanupWarnings;
}

function main() {
  const answers = readAnswers();
  if (answers === null) {
    process.stdout.write(`未找到 ${relative(ROOT, ANSWERS_PATH)}，跳过生成。\n先跑 npm run cicd:probe 并完成决策后再来。\n`);
    return 0;
  }

  const rendered = renderAll(answers);
  const { files, secretNames, releasePlease } = rendered;
  const { artifacts, errors } = prepareWritePlan(rendered);
  const initializedManifest = artifacts.some(
    (artifact) => artifact.path === RELEASE_PLEASE_MANIFEST_PATH,
  );

  if (errors.length > 0) {
    process.stderr.write(
      `台账违反设计不变量，未写出任何文件：\n${errors
        .map((error) => `- ${error}`)
        .join("\n")}\n`,
    );
    return 1;
  }

  let cleanupWarnings;
  try {
    cleanupWarnings = writeTransaction(artifacts);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 1;
  }
  for (const warning of cleanupWarnings) {
    process.stderr.write(`警告：${warning}\n`);
  }

  for (const file of files.keys()) {
    process.stdout.write(`已校准 .github/workflows/${file}\n`);
  }
  if (releasePlease) {
    process.stdout.write(`已校准 ${RELEASE_PLEASE_CONFIG_NAME}\n`);
    if (initializedManifest) {
      process.stdout.write(`已初始化 ${RELEASE_PLEASE_MANIFEST_NAME}\n`);
    } else if (lstatIfPresent(RELEASE_PLEASE_MANIFEST_PATH)) {
      process.stdout.write(`已保留现有 ${RELEASE_PLEASE_MANIFEST_NAME}（Release PR 运行状态，不覆盖）\n`);
    }
  }
  if (secretNames.length > 0) {
    process.stdout.write(`\n引用到的 secrets（需确认已在远端配置）：${secretNames.join(", ")}\n`);
  }
  return 0;
}

// 直接执行时才写盘；被 check-cicd.mjs import 时只用上面的纯函数。
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exitCode = main();
}
