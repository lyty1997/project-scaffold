// Zero-dependency CI/CD gate, included in npm run quality.
//
// Two check classes have different scopes:
// 1. Security boundaries apply to every workflow under .github/workflows,
//    including hand-written files. pull_request_target and malformed secret
//    references are real risks regardless of generator ownership.
// 2. Drift and completeness identify workflows by the managed marker, compare
//    release-please config bytes when the ledger declares it, and validate only
//    manifest keys and SemVer. YAML/JSON generation is deterministic across machines.
//
// When the decision ledger is absent, skip with exit 0 as check-static-site.mjs does.

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
    errors.push(`.github/workflows: could not inspect directory status: ${error.message}`);
    return [];
  }
  if (directoryStats.isSymbolicLink()) {
    errors.push(".github/workflows: must not be a symbolic-link directory");
    return [];
  }
  if (!directoryStats.isDirectory()) {
    errors.push(".github/workflows: must be a directory");
    return [];
  }
  const paths = [];
  for (const entry of readdirSync(WORKFLOW_DIRECTORY, { withFileTypes: true })) {
    if (![".yml", ".yaml"].includes(extname(entry.name))) continue;
    const path = resolve(WORKFLOW_DIRECTORY, entry.name);
    const stats = lstatSync(path);
    if (stats.isSymbolicLink()) {
      errors.push(`.github/workflows/${entry.name}: workflow must not be a symbolic link`);
    } else if (!stats.isFile()) {
      errors.push(`.github/workflows/${entry.name}: workflow must be a regular file`);
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
      // Let actionlint report invalid YAML escapes; preserve the source text so this scanner does not invent semantics.
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
    errors.push(`${shown}: could not inspect file status: ${error.message}`);
    return { exists: true, invalid: true };
  }
  if (stats.isSymbolicLink()) {
    errors.push(`${shown}: must not be a symbolic link`);
    return { exists: true, invalid: true };
  }
  if (!stats.isFile()) {
    errors.push(`${shown}: must be a regular file`);
    return { exists: true, invalid: true };
  }
  return { exists: true, content: readFileSync(path, "utf8") };
}

// ---- Class 1: security boundaries for every workflow ----
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
      `${shown}: pull_request_target is forbidden because fork PR code can access repository secrets`,
    );
  }
  if (
    /(?:^|[\s,[\]{}:?-])[&*][^\s,\[\]{}]+/m.test(structuralText)
  ) {
    errors.push(
      `${shown}: YAML aliases and anchors are not allowed because the zero-dependency security scanner cannot reliably audit their expanded structure`,
    );
  }
  if (/(?:^|[\n{,])\s*\?\s+/m.test(structuralText)) {
    errors.push(
      `${shown}: explicit YAML mapping keys are not allowed; use ordinary keys so security scanning matches GitHub semantics`,
    );
  }
  if (/(?:^|\n)\s*!{1,2}(?:<[^>]+>|[^\s]+)\s+/m.test(structuralText)) {
    errors.push(
      `${shown}: explicit YAML tag keys are not allowed; use ordinary keys so parsing semantics cannot rewrite security-critical fields`,
    );
  }
  const unquotedTriggerText = triggerText
    .replace(/"(?:[^"\\]|\\[\s\S])*"/g, "")
    .replace(/'(?:[^']|'')*'/g, "");
  if (/\*[^\s,\]}]+/.test(unquotedTriggerText)) {
    errors.push(
      `${shown}: the on trigger must not use a YAML alias because the zero-dependency scanner cannot audit expanded events`,
    );
  }
  if (/\$\{\{secrets\./.test(semanticText)) {
    errors.push(
      `${shown}: secret references must use \${{ secrets.NAME }} with spaces inside the braces; the current form is flagged by the secret scanner`,
    );
  }
  if (/\$\{\{\s*secrets\s*\[/.test(semanticText)) {
    errors.push(
      `${shown}: bracket notation is not allowed for secrets; use statically auditable \${{ secrets.NAME }}`,
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
      `${shown}: continue-on-error must be omitted or explicitly false; true, expressions, and aliases can create false-green results`,
    );
  }

  for (const [index, line] of lines.entries()) {
    const at = `${shown}:${index + 1}`;
    const active = stripYamlComment(line);
    if (active.trim() === "") continue;
    if (/["']\$\{\{\s*secrets\./.test(active)) {
      errors.push(`${at}: do not quote secret references; the current form is flagged by the secret scanner`);
    }
  }
}

// ---- Class 2: ledger-driven completeness and drift ----
const answers = readAnswers();

if (answers === null) {
  // A missing ledger is valid before the CI/CD decision is made. A managed
  // artifact without its ledger means the source of truth was lost and must fail.
  const orphans = listWorkflowFiles().filter((path) => readFileSync(path, "utf8").includes(MANAGED_MARKER));
  for (const orphan of orphans) {
    errors.push(`${repoRelative(orphan)}: has a managed marker but ${ANSWERS_RELATIVE} is missing; the source of truth is lost and validation cannot continue`);
  }
  for (const path of [RELEASE_PLEASE_CONFIG_PATH, RELEASE_PLEASE_MANIFEST_PATH]) {
    const snapshot = inspectRegularFile(path, repoRelative(path));
    if (snapshot.exists) {
      errors.push(`${repoRelative(path)}: ${ANSWERS_RELATIVE} is missing, so the release decision source of truth is unavailable`);
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

  // Every declared workflow must exist and match a fresh rendering byte for byte.
  for (const [file, expected] of files) {
    const target = resolve(WORKFLOW_DIRECTORY, file);
    const snapshot = inspectRegularFile(target, `.github/workflows/${file}`);
    if (!snapshot.exists) {
      errors.push(`.github/workflows/${file}: declared in the ledger but missing; run npm run gen:cicd`);
      continue;
    }
    if (!snapshot.invalid && snapshot.content !== expected) {
      errors.push(`.github/workflows/${file}: differs from a fresh ledger rendering; run npm run gen:cicd to regenerate it`);
    }
  }

  // Managed artifacts not declared in the ledger are stale leftovers from renamed or removed entries.
  for (const filePath of listWorkflowFiles()) {
    const name = basename(filePath);
    if (files.has(name)) continue;
    if (readFileSync(filePath, "utf8").includes(MANAGED_MARKER)) {
      errors.push(`${repoRelative(filePath)}: has a managed marker but no ledger entry; remove the stale artifact or restore the entry`);
    }
  }

  if (releasePlease) {
    const configSnapshot = inspectRegularFile(
      RELEASE_PLEASE_CONFIG_PATH,
      RELEASE_PLEASE_CONFIG_NAME,
    );
    if (!configSnapshot.exists) {
      errors.push(`${RELEASE_PLEASE_CONFIG_NAME}: releasePlease is enabled but the config is missing; run npm run gen:cicd`);
    } else if (
      !configSnapshot.invalid &&
      configSnapshot.content !== releasePlease.configJson
    ) {
      errors.push(`${RELEASE_PLEASE_CONFIG_NAME}: differs from the deterministic ledger rendering; run npm run gen:cicd`);
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
          ? `${RELEASE_PLEASE_MANIFEST_NAME}: config or a release workflow exists but the manifest is missing, indicating lost runtime state; restore it from Git or a Release PR`
          : `${RELEASE_PLEASE_MANIFEST_NAME}: releasePlease is enabled for the first time but the manifest is not initialized; run npm run gen:cicd`,
      );
    } else if (!manifestSnapshot.invalid) {
      try {
        const manifest = JSON.parse(manifestSnapshot.content);
        errors.push(
          ...validateReleasePleaseManifest(releasePlease, manifest),
          ...validateReleasePleaseVersionSources(releasePlease, manifest),
        );
      } catch (error) {
        errors.push(`${RELEASE_PLEASE_MANIFEST_NAME}: failed to parse JSON: ${error.message}`);
      }
    }
  } else {
    for (const path of [RELEASE_PLEASE_CONFIG_PATH, RELEASE_PLEASE_MANIFEST_PATH]) {
      if (inspectRegularFile(path, repoRelative(path)).exists) {
        errors.push(`${repoRelative(path)}: releasePlease is disabled in the ledger; remove this stale config or restore the ledger entry`);
      }
    }
  }

  // Every referenced secret must record its provenance in the ledger.
  const declared = new Set();
  if (answers.secrets !== undefined && !Array.isArray(answers.secrets)) {
    errors.push(`${ANSWERS_RELATIVE}: secrets must be an array`);
  }
  if (Array.isArray(answers.secrets)) {
    for (const [index, item] of answers.secrets.entries()) {
      if (typeof item?.name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(item.name)) {
        errors.push(`${ANSWERS_RELATIVE}: secrets[${index}].name is not a valid GitHub Actions secret name`);
        continue;
      }
      if (declared.has(item.name)) {
        errors.push(`${ANSWERS_RELATIVE}: secret \`${item.name}\` is registered more than once`);
      }
      declared.add(item.name);
      if (typeof item.source !== "string" || item.source.trim() === "") {
        errors.push(`${ANSWERS_RELATIVE}: secret \`${item.name}\` must register a non-empty source`);
      }
    }
  }
  for (const name of new Set([...secretNames, ...referencedWorkflowSecrets])) {
    if (!declared.has(name)) {
      errors.push(`${ANSWERS_RELATIVE}: workflow references secret \`${name}\`, but its source is not registered in the secrets inventory`);
    }
  }

  // Every deployment target must state its rollback method. Irreversible package publication must say so explicitly.
  if (answers.targets !== undefined && !Array.isArray(answers.targets)) {
    errors.push(`${ANSWERS_RELATIVE}: targets must be an array`);
  } else if (Array.isArray(answers.targets)) {
    for (const target of answers.targets) {
      if (typeof target?.kind !== "string") {
        errors.push(`${ANSWERS_RELATIVE}: a targets entry is missing kind`);
        continue;
      }
      if (typeof target.rollback !== "string" || target.rollback.trim() === "") {
        errors.push(`${ANSWERS_RELATIVE}: deployment target \`${target.kind}\` has no rollback method; irreversible targets must explicitly state that only a new version can recover`);
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
