// CI/CD 门禁：零依赖，随 npm run quality 一起跑。
//
// 分两类校验，作用范围不同：
// 1. 安全红线 —— 对 .github/workflows 下**所有** workflow 生效（含手写的），
//    因为 pull_request_target 与错误的 secrets 写法是真实风险，不该因「不是生成的」而放过。
// 2. 漂移与完整性 —— workflow 用 managed 标记识别；release-please config 按台账存在性
//    识别并做字节比对；manifest 只校验 key 与 SemVer、不和 bootstrap 值做字节比对。
//    YAML/JSON 序列化不依赖字体度量，和当前 Archify HTML 一样可做跨机器确定性新鲜度检查。
//
// 台账不存在时直接跳过并 exit 0（同 check-static-site.mjs 的既有先例）。

import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { basename, extname, relative, resolve } from "node:path";
import { projectRoot } from "./lib/files.mjs";
import {
  MANAGED_MARKER,
  RELEASE_PLEASE_CONFIG_NAME,
  RELEASE_PLEASE_MANIFEST_NAME,
  readAnswers,
  renderAll,
  validateReleasePleaseManifest,
  validateReleasePleaseVersionSources,
} from "../cicd/render.mjs";

const ROOT = projectRoot();
const WORKFLOW_DIRECTORY = resolve(ROOT, ".github/workflows");
const ANSWERS_RELATIVE = "docs/contracts/cicd-answers.json";
const RELEASE_PLEASE_CONFIG_PATH = resolve(ROOT, RELEASE_PLEASE_CONFIG_NAME);
const RELEASE_PLEASE_MANIFEST_PATH = resolve(ROOT, RELEASE_PLEASE_MANIFEST_NAME);

const errors = [];
const referencedWorkflowSecrets = new Set();

function repoRelative(path) {
  return relative(ROOT, path).replaceAll("\\", "/");
}

function listWorkflowFiles() {
  let directoryStats;
  try {
    directoryStats = lstatSync(WORKFLOW_DIRECTORY);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    errors.push(`.github/workflows: 无法读取目录状态：${error.message}`);
    return [];
  }
  if (directoryStats.isSymbolicLink()) {
    errors.push(".github/workflows: 不得是符号链接目录");
    return [];
  }
  if (!directoryStats.isDirectory()) {
    errors.push(".github/workflows: 必须是目录");
    return [];
  }
  const paths = [];
  for (const entry of readdirSync(WORKFLOW_DIRECTORY, { withFileTypes: true })) {
    if (![".yml", ".yaml"].includes(extname(entry.name))) continue;
    const path = resolve(WORKFLOW_DIRECTORY, entry.name);
    const stats = lstatSync(path);
    if (stats.isSymbolicLink()) {
      errors.push(`.github/workflows/${entry.name}: workflow 不得是符号链接`);
    } else if (!stats.isFile()) {
      errors.push(`.github/workflows/${entry.name}: workflow 必须是普通文件`);
    } else {
      paths.push(path);
    }
  }
  return paths.sort();
}

function stripYamlComment(line) {
  let singleQuoted = false;
  let doubleQuoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === "'" && !doubleQuoted) {
      if (singleQuoted && line[index + 1] === "'") {
        index += 1;
      } else {
        singleQuoted = !singleQuoted;
      }
      continue;
    }
    if (
      character === '"' &&
      !singleQuoted &&
      (index === 0 || line[index - 1] !== "\\")
    ) {
      doubleQuoted = !doubleQuoted;
      continue;
    }
    if (
      character === "#" &&
      !singleQuoted &&
      !doubleQuoted &&
      (index === 0 || /\s/.test(line[index - 1]))
    ) {
      return line.slice(0, index);
    }
  }
  return line;
}

function activeYamlText(content) {
  const activeLines = [];
  let blockScalarIndent = null;
  for (const line of content.split(/\r?\n/)) {
    const active = stripYamlComment(line);
    const indentation = active.match(/^ */)[0].length;
    if (blockScalarIndent !== null) {
      if (active.trim() === "" || indentation > blockScalarIndent) {
        activeLines.push("");
        continue;
      }
      blockScalarIndent = null;
    }
    activeLines.push(active);
    if (
      /(?:^.*:\s+|^\s*-\s+)[|>](?:[+-]?[1-9]?|[1-9][+-]?)?\s*$/.test(
        active,
      )
    ) {
      const sequenceMapping = /^\s*-\s+[^:]+:\s+[|>]/.exec(active);
      blockScalarIndent = sequenceMapping
        ? /^\s*-\s+/.exec(active)[0].length
        : indentation;
    }
  }
  return activeLines.join("\n");
}

function decodeYamlDoubleQuotedScalar(token) {
  let decoded = "";
  for (let index = 1; index < token.length - 1; index += 1) {
    const character = token[index];
    if (character !== "\\") {
      decoded += character;
      continue;
    }
    index += 1;
    const escaped = token[index];
    if (escaped === "\n" || escaped === "\r") {
      if (escaped === "\r" && token[index + 1] === "\n") index += 1;
      while (token[index + 1] === " " || token[index + 1] === "\t") index += 1;
      continue;
    }
    const hexadecimalLength = { x: 2, u: 4, U: 8 }[escaped];
    if (hexadecimalLength) {
      const hexadecimal = token.slice(index + 1, index + 1 + hexadecimalLength);
      if (!new RegExp(`^[0-9a-fA-F]{${hexadecimalLength}}$`).test(hexadecimal)) {
        throw new Error("invalid YAML hexadecimal escape");
      }
      decoded += String.fromCodePoint(Number.parseInt(hexadecimal, 16));
      index += hexadecimalLength;
      continue;
    }
    const escapes = {
      0: "\0",
      a: "\x07",
      b: "\b",
      t: "\t",
      n: "\n",
      v: "\v",
      f: "\f",
      r: "\r",
      e: "\x1b",
      " ": " ",
      '"': '"',
      "/": "/",
      "\\": "\\",
      N: "\u0085",
      _: "\u00a0",
      L: "\u2028",
      P: "\u2029",
    };
    if (!Object.hasOwn(escapes, escaped)) {
      throw new Error("invalid YAML escape");
    }
    decoded += escapes[escaped];
  }
  return decoded;
}

function decodeYamlDoubleQuotedScalars(content) {
  return content.replace(/"(?:[^"\\]|\\[\s\S])*"/g, (token) => {
    try {
      return decodeYamlDoubleQuotedScalar(token);
    } catch {
      // 非法转义由 actionlint 报 YAML 语法错；这里保留原文，避免扫描器自造语义。
      return token;
    }
  });
}

function workflowTriggerText(content) {
  const triggerLines = [];
  let collecting = false;
  for (const line of content.split(/\r?\n/)) {
    if (line.trim() !== "" && !/^\s/.test(line)) {
      const decodedLine = decodeYamlDoubleQuotedScalars(line);
      collecting = /^(?:on|'on')\s*:/.test(decodedLine);
      if (collecting) triggerLines.push(line);
      continue;
    }
    if (collecting) triggerLines.push(line);
  }
  return triggerLines.join("\n");
}

function inspectRegularFile(path, shown) {
  let stats;
  try {
    stats = lstatSync(path);
  } catch (error) {
    if (error.code === "ENOENT") return { exists: false };
    errors.push(`${shown}: 无法读取文件状态：${error.message}`);
    return { exists: true, invalid: true };
  }
  if (stats.isSymbolicLink()) {
    errors.push(`${shown}: 不得是符号链接`);
    return { exists: true, invalid: true };
  }
  if (!stats.isFile()) {
    errors.push(`${shown}: 必须是普通文件`);
    return { exists: true, invalid: true };
  }
  return { exists: true, content: readFileSync(path, "utf8") };
}

// ---- 第一类：安全红线，对所有 workflow 生效 ----
for (const filePath of listWorkflowFiles()) {
  const shown = repoRelative(filePath);
  const workflowContent = readFileSync(filePath, "utf8");
  const lines = workflowContent.split(/\r?\n/);
  const uncommentedText = lines.map(stripYamlComment).join("\n");
  const triggerText = workflowTriggerText(uncommentedText);
  const structuralText = activeYamlText(workflowContent)
    .split("\n")
    .map((line) =>
      line.replace(
        /^(\s*(?:-\s*)?(?:"run"|'run'|run)\s*:).*$/,
        "$1",
      ),
    )
    .join("\n")
    .replace(/"(?:[^"\\]|\\[\s\S])*"/g, "")
    .replace(/'(?:[^']|'')*'/g, "");
  const policyText = [
    decodeYamlDoubleQuotedScalars(activeYamlText(workflowContent)),
    decodeYamlDoubleQuotedScalars(triggerText),
  ].join("\n");
  const semanticText = `${uncommentedText}\n${policyText}`;
  for (const expression of semanticText.matchAll(/\$\{\{([\s\S]*?)\}\}/g)) {
    for (const match of expression[1].matchAll(
      /\bsecrets\.([A-Za-z_][A-Za-z0-9_]*)\b/g,
    )) {
      referencedWorkflowSecrets.add(match[1]);
    }
  }

  if (/\bpull_request_target\b/.test(policyText)) {
    errors.push(
      `${shown}: 禁止 pull_request_target —— 它在 fork PR 上下文里能拿到仓库 secrets`,
    );
  }
  if (
    /(?:^|[\s,[\]{}:?-])[&*][^\s,\[\]{}]+/m.test(structuralText)
  ) {
    errors.push(
      `${shown}: workflow 不允许 YAML alias 或 anchor；零依赖安全扫描无法可靠展开后审计真实结构`,
    );
  }
  if (/(?:^|[\n{,])\s*\?\s+/m.test(structuralText)) {
    errors.push(
      `${shown}: workflow 不允许 YAML 显式 mapping key；请使用普通 key，确保安全扫描与 GitHub 语义一致`,
    );
  }
  if (/(?:^|\n)\s*!{1,2}(?:<[^>]+>|[^\s]+)\s+/m.test(structuralText)) {
    errors.push(
      `${shown}: workflow 不允许 YAML 显式 tag key；请使用普通 key，避免改写安全关键字段的解析语义`,
    );
  }
  const unquotedTriggerText = triggerText
    .replace(/"(?:[^"\\]|\\[\s\S])*"/g, "")
    .replace(/'(?:[^']|'')*'/g, "");
  if (/\*[^\s,\]}]+/.test(unquotedTriggerText)) {
    errors.push(
      `${shown}: on 触发器不允许 YAML alias；零依赖安全扫描无法审计别名展开后的真实事件`,
    );
  }
  if (/\$\{\{secrets\./.test(semanticText)) {
    errors.push(
      `${shown}: secrets 引用要写成 \${{ secrets.NAME }}（花括号内留空格），当前写法会被密钥扫描误判为泄漏`,
    );
  }
  if (/\$\{\{\s*secrets\s*\[/.test(semanticText)) {
    errors.push(
      `${shown}: secrets 不允许 bracket 写法，必须使用可静态登记来源的 \${{ secrets.NAME }}`,
    );
  }
  let unsafeContinueOnError = false;
  const continueOnErrorKeys = [
    /(?:^|[\n,{])\s*(?:-\s*)?(?:\?\s*)?["']?continue-on-error["']?\s*:/gi,
    /(?:^|\n)\s*\?\s*["']?continue-on-error["']?\s*\n\s*:\s*/gi,
  ];
  for (const keyPattern of continueOnErrorKeys) {
    for (const match of policyText.matchAll(keyPattern)) {
      const value = policyText.slice(match.index + match[0].length);
      if (!/^\s*false(?=\s|[,}\]]|$)/i.test(value)) {
        unsafeContinueOnError = true;
        break;
      }
    }
    if (unsafeContinueOnError) break;
  }
  if (unsafeContinueOnError) {
    errors.push(
      `${shown}: continue-on-error 只能省略或显式为 false；true、表达式与别名都可能制造假绿`,
    );
  }

  for (const [index, line] of lines.entries()) {
    const at = `${shown}:${index + 1}`;
    const active = stripYamlComment(line);
    if (active.trim() === "") continue;
    if (/["']\$\{\{\s*secrets\./.test(active)) {
      errors.push(`${at}: secrets 引用外面不要加引号，当前写法会被密钥扫描误判为泄漏`);
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
  for (const path of [RELEASE_PLEASE_CONFIG_PATH, RELEASE_PLEASE_MANIFEST_PATH]) {
    const snapshot = inspectRegularFile(path, repoRelative(path));
    if (snapshot.exists) {
      errors.push(`${repoRelative(path)}: 找不到 ${ANSWERS_RELATIVE}，Release 决策真相源缺失`);
    }
  }
} else {
  const {
    files,
    errors: renderErrors,
    secretNames,
    releasePlease,
  } = renderAll(answers);
  for (const error of renderErrors) {
    errors.push(`${ANSWERS_RELATIVE}: ${error}`);
  }

  // 声明的每个 workflow 都要真的存在，且内容与重新渲染的结果逐字节一致。
  for (const [file, expected] of files) {
    const target = resolve(WORKFLOW_DIRECTORY, file);
    const snapshot = inspectRegularFile(target, `.github/workflows/${file}`);
    if (!snapshot.exists) {
      errors.push(`.github/workflows/${file}: 台账声明了但文件不存在，跑 npm run gen:cicd 生成`);
      continue;
    }
    if (!snapshot.invalid && snapshot.content !== expected) {
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

  if (releasePlease) {
    const configSnapshot = inspectRegularFile(
      RELEASE_PLEASE_CONFIG_PATH,
      RELEASE_PLEASE_CONFIG_NAME,
    );
    if (!configSnapshot.exists) {
      errors.push(`${RELEASE_PLEASE_CONFIG_NAME}: 已启用 releasePlease 但配置文件不存在，跑 npm run gen:cicd 生成`);
    } else if (
      !configSnapshot.invalid &&
      configSnapshot.content !== releasePlease.configJson
    ) {
      errors.push(`${RELEASE_PLEASE_CONFIG_NAME}: 与台账确定性渲染结果不一致，跑 npm run gen:cicd 重新生成`);
    }

    const manifestSnapshot = inspectRegularFile(
      RELEASE_PLEASE_MANIFEST_PATH,
      RELEASE_PLEASE_MANIFEST_NAME,
    );
    if (!manifestSnapshot.exists) {
      const releaseWorkflowPath = resolve(
        WORKFLOW_DIRECTORY,
        releasePlease.workflowFile,
      );
      const releaseWorkflowExists = inspectRegularFile(
        releaseWorkflowPath,
        `.github/workflows/${releasePlease.workflowFile}`,
      ).exists;
      errors.push(
        configSnapshot.exists || releaseWorkflowExists
          ? `${RELEASE_PLEASE_MANIFEST_NAME}: config 或 release workflow 已存在但 manifest 缺失，属于运行状态丢失；请从 Git/Release PR 恢复`
          : `${RELEASE_PLEASE_MANIFEST_NAME}: 首次启用 releasePlease 但 manifest 尚未初始化，跑 npm run gen:cicd`,
      );
    } else if (!manifestSnapshot.invalid) {
      try {
        const manifest = JSON.parse(manifestSnapshot.content);
        errors.push(
          ...validateReleasePleaseManifest(releasePlease, manifest),
          ...validateReleasePleaseVersionSources(releasePlease, manifest),
        );
      } catch (error) {
        errors.push(`${RELEASE_PLEASE_MANIFEST_NAME}: JSON 解析失败：${error.message}`);
      }
    }
  } else {
    for (const path of [RELEASE_PLEASE_CONFIG_PATH, RELEASE_PLEASE_MANIFEST_PATH]) {
      if (inspectRegularFile(path, repoRelative(path)).exists) {
        errors.push(`${repoRelative(path)}: 台账未启用 releasePlease，属于残留配置，请删除或补回台账`);
      }
    }
  }

  // workflow 里引用到的每个 secret 都要在台账里登记来源，避免「配了没人知道从哪来」。
  const declared = new Set();
  if (answers.secrets !== undefined && !Array.isArray(answers.secrets)) {
    errors.push(`${ANSWERS_RELATIVE}: secrets 必须是数组`);
  }
  if (Array.isArray(answers.secrets)) {
    for (const [index, item] of answers.secrets.entries()) {
      if (typeof item?.name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(item.name)) {
        errors.push(`${ANSWERS_RELATIVE}: secrets[${index}].name 不是合法的 GitHub Actions secret 名`);
        continue;
      }
      if (declared.has(item.name)) {
        errors.push(`${ANSWERS_RELATIVE}: secret \`${item.name}\` 重复登记`);
      }
      declared.add(item.name);
      if (typeof item.source !== "string" || item.source.trim() === "") {
        errors.push(`${ANSWERS_RELATIVE}: secret \`${item.name}\` 必须登记非空 source`);
      }
    }
  }
  for (const name of new Set([...secretNames, ...referencedWorkflowSecrets])) {
    if (!declared.has(name)) {
      errors.push(`${ANSWERS_RELATIVE}: workflow 引用了 secret \`${name}\`，但 secrets 清单里没有登记它的来源`);
    }
  }

  // 每个部署目标都要写明回滚方式；包发布这类不可回滚的也必须显式写出来，不允许留空。
  if (answers.targets !== undefined && !Array.isArray(answers.targets)) {
    errors.push(`${ANSWERS_RELATIVE}: targets 必须是数组`);
  } else if (Array.isArray(answers.targets)) {
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
  process.exitCode = 1;
} else {
  console.log("CI/CD checks passed.");
}
