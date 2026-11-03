import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { basename, dirname, extname, relative, resolve } from "node:path";
import { listFiles, projectRoot, readText } from "./lib/files.mjs";

const ROOT = projectRoot();
const HAN = /\p{Script=Han}/u;
const ALLOW_MARKER = "localization-allow-cjk";
const TEXT_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".lua",
  ".md",
  ".mjs",
  ".ps1",
  ".py",
  ".sh",
  ".txt",
  ".yaml",
  ".yml",
]);
const TEXT_BASENAMES = new Set([
  ".editorconfig",
  ".gitattributes",
  ".gitignore",
  "commit-msg",
  "pre-commit",
]);
const ROOT_DOCUMENTS = ["README.md", "SCAFFOLD.md"];
const INDEX_VISIBLE_ENGLISH_FILES = [
  ".agents/skills/archify/SKILL.md",
  ".agents/skills/archify/agents/openai.yaml",
];

function shown(path) {
  return relative(ROOT, path).replaceAll("\\", "/");
}

function siblingChinesePath(path) {
  return path.replace(/\.md$/, "-zh.md");
}

function addTreePairs(pairs, directory) {
  for (const path of listFiles(directory, (candidate) => candidate.endsWith(".md") && !/-zh\.md$/i.test(candidate))) {
    pairs.push([path, siblingChinesePath(path)]);
  }
}

function documentPairs() {
  const pairs = ROOT_DOCUMENTS.map((path) => {
    const english = resolve(ROOT, path);
    return [english, siblingChinesePath(english)];
  });

  addTreePairs(pairs, resolve(ROOT, "docs"));
  return pairs;
}

function checkDocumentPairs() {
  const errors = [];
  for (const [english, chinese] of documentPairs()) {
    if (!existsSync(english)) {
      errors.push(`${shown(english)} is missing`);
      continue;
    }
    if (!existsSync(chinese)) {
      errors.push(`${shown(english)} is missing Chinese counterpart ${shown(chinese)}`);
      continue;
    }

    const chineseTarget = relative(dirname(english), chinese).replaceAll("\\", "/");
    const englishTarget = relative(dirname(chinese), english).replaceAll("\\", "/");
    if (!readText(english).includes(chineseTarget)) {
      errors.push(`${shown(english)} does not link to ${shown(chinese)}`);
    }
    if (!readText(chinese).includes(englishTarget)) {
      errors.push(`${shown(chinese)} does not link to ${shown(english)}`);
    }
  }
  return errors;
}

function isTextFile(path) {
  return TEXT_EXTENSIONS.has(extname(path).toLowerCase()) || TEXT_BASENAMES.has(basename(path));
}

function isChineseDocument(path) {
  const pathShown = shown(path);
  return /-zh\.md$/i.test(pathShown) && (pathShown.startsWith("docs/") || /^(?:README|SCAFFOLD)-zh\.md$/i.test(pathShown));
}

function checkEnglishOnlyInstructions() {
  const errors = [];
  for (const parent of [ROOT, resolve(ROOT, "codex-rules"), resolve(ROOT, ".claude")]) {
    if (!existsSync(parent)) continue;
    for (const entry of readdirSync(parent, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^(?:codex-)?rules-zh$/i.test(entry.name)) continue;
      const directory = resolve(parent, entry.name);
      if (readdirSync(directory).length > 0) {
        errors.push(`${shown(directory)}: translated rules directories must be empty or absent`);
      }
    }
  }
  for (const path of listFiles(ROOT)) {
    const pathShown = shown(path);
    const translatedRulesDirectory = /^(?:codex-rules-zh\/|codex-rules\/(?:.*\/)?rules-zh\/|\.claude\/rules-zh\/)/i.test(pathShown);
    const translatedInstruction =
      /^(?:(?:AGENTS|CLAUDE|CONTRIBUTING)|\.github\/pull_request_template)-zh\.md$/i.test(pathShown) ||
      (/^(?:codex-rules\/|\.claude\/rules\/)/i.test(pathShown) && /-zh\.md$/i.test(pathShown)) ||
      (/^\.(?:claude|agents)\/skills\//i.test(pathShown) &&
        /^SKILL-zh\.md$/i.test(basename(path)) &&
        !pathShown.startsWith(".claude/skills/archify/"));
    if (translatedRulesDirectory || translatedInstruction) {
      errors.push(`${pathShown}: instruction and workflow guidance must have one English version only`);
    }
  }
  return errors;
}

function isEnglishScanExcluded(path) {
  const pathShown = shown(path);
  return (
    isChineseDocument(path) ||
    pathShown.startsWith(".claude/skills/archify/") ||
    /^docs\/diagrams\/.*\.archify\.html$/.test(pathShown)
  );
}

function isAllowedFunctionalData(pathShown, line, previousLine) {
  if (line.includes(ALLOW_MARKER) || previousLine.includes(ALLOW_MARKER)) return true;
  if (pathShown === "docs/contracts/contract-rules.json") {
    return /^\s*"(?:term|use)"\s*:/.test(line);
  }
  return false;
}

function scanEnglishText(pathShown, text, errors) {
  const lines = text.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (!HAN.test(line)) continue;
    const previousLine = index > 0 ? lines[index - 1] : "";
    if (!isAllowedFunctionalData(pathShown, line, previousLine)) {
      errors.push(`${pathShown}:${index + 1}: contains Han text on an English-default surface`);
    }
  }
}

function checkEnglishSurfaces() {
  const errors = [];
  const scanned = new Set();
  for (const path of listFiles(ROOT, isTextFile)) {
    if (isEnglishScanExcluded(path)) continue;
    const pathShown = shown(path);
    scanned.add(pathShown);
    scanEnglishText(pathShown, readText(path), errors);
  }

  // Hosted Codex may mount .agents as an empty read-only skill view. CI sees the
  // tracked files, so scan their staged bytes when the working-tree paths are hidden.
  for (const pathShown of INDEX_VISIBLE_ENGLISH_FILES) {
    if (scanned.has(pathShown)) continue;
    const indexed = spawnSync("git", ["show", `:${pathShown}`], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });
    if (indexed.status !== 0) {
      errors.push(`${pathShown}: cannot read tracked bytes from the Git index`);
      continue;
    }
    scanEnglishText(pathShown, indexed.stdout, errors);
  }
  return errors;
}

const errors = [...checkDocumentPairs(), ...checkEnglishOnlyInstructions(), ...checkEnglishSurfaces()];

if (errors.length > 0) {
  console.error(`Localization checks failed (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Localization checks passed: English-only instructions, English defaults, and project document pairs are valid.");
