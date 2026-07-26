// CI/CD 门禁：零依赖，随 npm run quality 一起跑。
//
// 分两类校验，作用范围不同：
// 1. 安全红线 —— 对 .github/workflows 下**所有** workflow 生效（含手写的），
//    因为 pull_request_target 与错误的 secrets 写法是真实风险，不该因「不是生成的」而放过。
// 2. 漂移与完整性 —— 只对带 managed 标记的生成物生效，靠「重新渲染 + 字节比对」判定。
//    这与被废弃的 check:diagrams:fresh 不同：YAML 序列化不依赖字体度量，跨机器字节确定。
//
// 台账不存在时直接跳过并 exit 0（同 check-static-site.mjs 的既有先例）。

import { existsSync, readFileSync } from "node:fs";
import { basename, extname, relative, resolve } from "node:path";
import { listFiles, projectRoot } from "./lib/files.mjs";
import { MANAGED_MARKER, readAnswers, renderAll } from "../cicd/render.mjs";

const ROOT = projectRoot();
const WORKFLOW_DIRECTORY = resolve(ROOT, ".github/workflows");
const ANSWERS_RELATIVE = "docs/contracts/cicd-answers.json";

const errors = [];

function repoRelative(path) {
  return relative(ROOT, path).replaceAll("\\", "/");
}

function listWorkflowFiles() {
  if (!existsSync(WORKFLOW_DIRECTORY)) return [];
  return listFiles(WORKFLOW_DIRECTORY, (path) => [".yml", ".yaml"].includes(extname(path)));
}

// ---- 第一类：安全红线，对所有 workflow 生效 ----
for (const filePath of listWorkflowFiles()) {
  const shown = repoRelative(filePath);
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    const at = `${shown}:${index + 1}`;
    if (/^\s*pull_request_target\s*:/.test(line)) {
      errors.push(`${at}: 禁止 pull_request_target —— 它在 fork PR 上下文里能拿到仓库 secrets`);
    }
    if (/\$\{\{secrets\./.test(line)) {
      errors.push(`${at}: secrets 引用要写成 \${{ secrets.NAME }}（花括号内留空格），当前写法会被密钥扫描误判为泄漏`);
    }
    if (/["']\$\{\{\s*secrets\./.test(line)) {
      errors.push(`${at}: secrets 引用外面不要加引号，当前写法会被密钥扫描误判为泄漏`);
    }
    if (/^\s*continue-on-error\s*:\s*true\s*$/.test(line)) {
      errors.push(`${at}: 禁止 continue-on-error: true —— 会让 job 失败而 run 结论仍是 success，制造假绿`);
    }
  }
}

// ---- 第二类：台账驱动的完整性与漂移 ----
const answers = readAnswers();

if (answers === null) {
  // 台账不存在：还没决定要不要搭 CI/CD，这是合法状态。
  // 但如果已经有 managed 生成物却没有台账，那是真相源丢失，必须报错。
  const orphans = listWorkflowFiles().filter((path) => readFileSync(path, "utf8").includes(MANAGED_MARKER));
  for (const orphan of orphans) {
    errors.push(`${repoRelative(orphan)}: 带 managed 标记但找不到 ${ANSWERS_RELATIVE}，真相源丢失，无法校验`);
  }
} else {
  const { files, errors: renderErrors, secretNames } = renderAll(answers);
  for (const error of renderErrors) {
    errors.push(`${ANSWERS_RELATIVE}: ${error}`);
  }

  // 声明的每个 workflow 都要真的存在，且内容与重新渲染的结果逐字节一致。
  for (const [file, expected] of files) {
    const target = resolve(WORKFLOW_DIRECTORY, file);
    if (!existsSync(target)) {
      errors.push(`.github/workflows/${file}: 台账声明了但文件不存在，跑 npm run gen:cicd 生成`);
      continue;
    }
    if (readFileSync(target, "utf8") !== expected) {
      errors.push(`.github/workflows/${file}: 与台账重新渲染的结果不一致（手工改过或台账已变），跑 npm run gen:cicd 重新生成`);
    }
  }

  // 生成物不能多出台账里没声明的 managed 文件（改名/删条目后的残留）。
  for (const filePath of listWorkflowFiles()) {
    const name = basename(filePath);
    if (files.has(name)) continue;
    if (readFileSync(filePath, "utf8").includes(MANAGED_MARKER)) {
      errors.push(`${repoRelative(filePath)}: 带 managed 标记但台账里已无对应条目，属于残留，请删除或补回台账`);
    }
  }

  // workflow 里引用到的每个 secret 都要在台账里登记来源，避免「配了没人知道从哪来」。
  const declared = new Set(
    Array.isArray(answers.secrets)
      ? answers.secrets.filter((item) => typeof item?.name === "string").map((item) => item.name)
      : [],
  );
  for (const name of secretNames) {
    if (!declared.has(name)) {
      errors.push(`${ANSWERS_RELATIVE}: workflow 引用了 secret \`${name}\`，但 secrets 清单里没有登记它的来源`);
    }
  }

  // 每个部署目标都要写明回滚方式；包发布这类不可回滚的也必须显式写出来，不允许留空。
  if (Array.isArray(answers.targets)) {
    for (const target of answers.targets) {
      if (typeof target?.kind !== "string") {
        errors.push(`${ANSWERS_RELATIVE}: targets 里存在缺少 kind 的条目`);
        continue;
      }
      if (typeof target.rollback !== "string" || target.rollback.trim() === "") {
        errors.push(`${ANSWERS_RELATIVE}: 部署目标 \`${target.kind}\` 没有写回滚方式（不可回滚的目标也要写明「不可回滚，只能发新版本」）`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error("CI/CD checks failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("CI/CD checks passed.");
