import { existsSync } from "node:fs";
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
const ROOT_DOCUMENTS = [
  "AGENTS.md",
  "CLAUDE.md",
  "CONTRIBUTING.md",
  "README.md",
  "SCAFFOLD.md",
  ".github/pull_request_template.md",
];

function shown(path) {
  return relative(ROOT, path).replaceAll("\\", "/");
}

function siblingChinesePath(path) {
  return path.replace(/\.md$/, "-zh.md");
}

function addTreePairs(pairs, directory) {
  for (const path of listFiles(directory, (candidate) => candidate.endsWith(".md") && !candidate.endsWith("-zh.md"))) {
    pairs.push([path, siblingChinesePath(path)]);
  }
}

function documentPairs() {
  const pairs = ROOT_DOCUMENTS.map((path) => {
    const english = resolve(ROOT, path);
    return [english, siblingChinesePath(english)];
  });

  addTreePairs(pairs, resolve(ROOT, "docs"));
  addTreePairs(pairs, resolve(ROOT, "codex-rules"));

  for (const english of listFiles(resolve(ROOT, ".claude/rules"), (path) => path.endsWith(".md"))) {
    const stem = basename(english, ".md");
    pairs.push([english, resolve(ROOT, ".claude/rules-zh", `${stem}-zh.md`)]);
  }

  for (const english of listFiles(resolve(ROOT, ".claude/skills"), (path) => {
    const pathShown = shown(path);
    return basename(path) === "SKILL.md" && !pathShown.startsWith(".claude/skills/archify/");
  })) {
    pairs.push([english, siblingChinesePath(english)]);
  }

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
  return pathShown.endsWith("-zh.md") || pathShown.startsWith(".claude/rules-zh/");
}

function isEnglishScanExcluded(path) {
  const pathShown = shown(path);
  return (
    isChineseDocument(path) ||
    pathShown.startsWith(".claude/skills/archify/") ||
    /^docs\/diagrams\/.*\.archify\.html$/.test(pathShown)
  );
}

function isAllowedFunctionalData(path, line, previousLine) {
  if (line.includes(ALLOW_MARKER) || previousLine.includes(ALLOW_MARKER)) return true;
  if (shown(path) === "docs/contracts/contract-rules.json") {
    return /^\s*"(?:term|use)"\s*:/.test(line);
  }
  return false;
}

function checkEnglishSurfaces() {
  const errors = [];
  for (const path of listFiles(ROOT, isTextFile)) {
    if (isEnglishScanExcluded(path)) continue;
    const lines = readText(path).split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      if (!HAN.test(line)) continue;
      const previousLine = index > 0 ? lines[index - 1] : "";
      if (!isAllowedFunctionalData(path, line, previousLine)) {
        errors.push(`${shown(path)}:${index + 1}: contains Han text on an English-default surface`);
      }
    }
  }
  return errors;
}

const errors = [...checkDocumentPairs(), ...checkEnglishSurfaces()];

if (errors.length > 0) {
  console.error(`Localization checks failed (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Localization checks passed: English defaults and Chinese document pairs are synchronized.");
