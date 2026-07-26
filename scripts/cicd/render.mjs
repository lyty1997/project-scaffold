// CI/CD 渲染器：台账 JSON -> workflow YAML。
//
// 设计见 docs/architecture/cicd-autosetup.md：
// - 真相源是 docs/contracts/cicd-answers.json，YAML 只是产物。本文件只写不读 YAML，
//   因此不需要 YAML 解析器，天然满足零第三方依赖约束。
// - 「结构与安全骨架」在这里固化，不依赖调用方临场记得；台账违反不变量时**硬失败**，
//   绝不悄悄修正后继续（那会把问题埋进产物里）。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { relative, resolve } from "node:path";
import { projectRoot } from "../quality/lib/files.mjs";

const ROOT = projectRoot();
const ANSWERS_PATH = resolve(ROOT, "docs/contracts/cicd-answers.json");
const WORKFLOW_DIRECTORY = resolve(ROOT, ".github/workflows");
export const MANAGED_MARKER = "# managed-by: scripts/cicd/render.mjs";

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
const SECRET_REFERENCE = /\$\{\{\s*secrets\.[A-Za-z_][A-Za-z0-9_]*\s*\}\}/g;
const LOOSE_SECRET_REFERENCE = /\$\{\{secrets\./;

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
}

function collectSecretNames(text, into) {
  for (const match of text.matchAll(SECRET_REFERENCE)) {
    const name = match[0].replace(/[^A-Za-z0-9_.]/g, "").replace("secrets.", "");
    into.add(name);
  }
}

// ---------------------------------------------------------------------------
// 装配：台账描述「做什么」，这里补齐「怎么做才安全」。
// ---------------------------------------------------------------------------

// 部署步骤的闸门表达式（不含 ${{ }}，便于与使用者自带的 if 条件合成同一个表达式块）：
// PR 上永不真发布；手动触发时默认走演练。
const DEPLOY_GUARD_EXPRESSION = "github.event_name != 'pull_request' && inputs.dry_run != 'true'";

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

function normalizeStep(step, where, errors, secretNames) {
  if (step["continue-on-error"] === true) {
    errors.push(`${where}: 禁止 continue-on-error: true —— 它会让 job 失败而 run 结论仍是 success，制造假绿`);
  }
  walkStrings(step, (text) => {
    checkSecretStyle(text, where, errors);
    collectSecretNames(text, secretNames);
  });

  const normalized = {};
  if (step.name) normalized.name = step.name;
  if (step.id) normalized.id = step.id;

  if (step.uses) {
    checkActionRef(step.uses, where, errors);
    normalized.uses = step.uses;
  }
  if (step.run) {
    normalized.run = step.run;
    // 不写 shell 时 Linux 默认是 `bash -e`（无 pipefail），`false | true` 会静默通过。
    normalized.shell = step.shell ?? "bash";
  }
  if (step.deployStep === true) {
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

function normalizeJob(job, where, errors, secretNames) {
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
  if (job.env) normalized.env = job.env;

  if (!Array.isArray(job.steps) || job.steps.length === 0) {
    errors.push(`${where}: job 必须至少有一个 step`);
    normalized.steps = [];
    return normalized;
  }
  normalized.steps = job.steps.map((step, index) =>
    normalizeStep(step, `${where}.steps[${index}]`, errors, secretNames));
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
    for (const job of spec.jobs) {
      document.jobs[job.id] = normalizeJob(job, `${where}.jobs[${job.id}]`, errors, secretNames);
    }
  }

  const header = [
    MANAGED_MARKER,
    `# answers-hash: ${answersHash}`,
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

// 渲染全部 workflow，返回 { file -> yaml } 与收集到的错误。供生成与门禁复用。
export function renderAll(answers) {
  const hash = answersHash(answers);
  const files = new Map();
  const errors = [];
  const secretNames = new Set();

  if (!Array.isArray(answers.workflows) || answers.workflows.length === 0) {
    errors.push("台账里没有声明任何 workflow（workflows 为空）");
    return { files, errors, secretNames: [] };
  }

  for (const spec of answers.workflows) {
    if (typeof spec.file !== "string" || !/^[\w.-]+\.ya?ml$/.test(spec.file)) {
      errors.push(`workflows[${spec.id ?? "?"}]: file 必须是形如 build.yml 的文件名`);
      continue;
    }
    const rendered = renderWorkflow(spec, hash);
    errors.push(...rendered.errors);
    for (const name of rendered.secretNames) secretNames.add(name);
    files.set(spec.file, rendered.yaml);
  }
  return { files, errors, secretNames: [...secretNames].sort() };
}

// 直接执行时才写盘；被 check-cicd.mjs import 时只用上面的纯函数。
if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const answers = readAnswers();
  if (answers === null) {
    process.stdout.write(`未找到 ${relative(ROOT, ANSWERS_PATH)}，跳过生成。\n先跑 npm run cicd:probe 并完成决策后再来。\n`);
    process.exit(0);
  }

  const { files, errors, secretNames } = renderAll(answers);
  if (errors.length > 0) {
    process.stderr.write("台账违反设计不变量，未写出任何文件：\n");
    for (const error of errors) process.stderr.write(`- ${error}\n`);
    process.exit(1);
  }

  mkdirSync(WORKFLOW_DIRECTORY, { recursive: true });
  for (const [file, yaml] of files) {
    writeFileSync(resolve(WORKFLOW_DIRECTORY, file), yaml, "utf8");
    process.stdout.write(`已生成 .github/workflows/${file}\n`);
  }
  if (secretNames.length > 0) {
    process.stdout.write(`\n引用到的 secrets（需确认已在远端配置）：${secretNames.join(", ")}\n`);
  }
}
