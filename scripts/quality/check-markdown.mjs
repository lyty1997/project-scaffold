import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { listFiles, projectRoot, readText } from "./lib/files.mjs";

const ROOT = projectRoot();
const DOCS_ROOT = resolve(ROOT, "docs");
const SKIP_PREFIXES = ["#", "http://", "https://", "mailto:", "tel:"];

function markdownFiles() {
  return listFiles(ROOT, (path) => path.endsWith(".md"));
}

function scanLinkTargets(line) {
  const targets = [];
  let index = 0;

  while (index < line.length) {
    const labelStart = line.indexOf("[", index);
    if (labelStart === -1) break;
    if (labelStart > 0 && line[labelStart - 1] === "!") {
      index = labelStart + 1;
      continue;
    }

    const labelEnd = line.indexOf("]", labelStart + 1);
    if (labelEnd === -1 || line[labelEnd + 1] !== "(") {
      index = labelStart + 1;
      continue;
    }

    const targetStart = labelEnd + 2;
    let targetEnd = targetStart;
    let depth = 0;
    let escaped = false;

    while (targetEnd < line.length) {
      const char = line[targetEnd];
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "(") {
        depth += 1;
      } else if (char === ")") {
        if (depth === 0) break;
        depth -= 1;
      }
      targetEnd += 1;
    }

    if (targetEnd < line.length) {
      targets.push(line.slice(targetStart, targetEnd));
      index = targetEnd + 1;
    } else {
      index = targetStart;
    }
  }

  return targets;
}

// Replace inline code with equal-length spaces so example link syntax is not treated as a real link.
function stripInlineCode(line) {
  return line.replace(/`[^`]*`/g, (match) => " ".repeat(match.length));
}

function normalizeTarget(rawTarget) {
  let target = rawTarget.trim();
  if (!target || SKIP_PREFIXES.some((prefix) => target.startsWith(prefix))) {
    return "";
  }
  if (target.includes(" ") && !target.startsWith("<")) {
    target = target.split(" ", 1)[0];
  }
  target = target.replace(/^<|>$/g, "");
  target = target.split("#", 1)[0].split("?", 1)[0];
  return decodeURIComponent(target);
}

function checkInternalLinks() {
  const errors = [];

  for (const markdownPath of markdownFiles()) {
    const text = readText(markdownPath);
    const lines = text.split(/\r?\n/);
    let inFence = false;
    for (const [index, rawLine] of lines.entries()) {
      if (/^\s*(```|~~~)/.test(rawLine)) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      const line = stripInlineCode(rawLine);
      for (const rawTarget of scanLinkTargets(line)) {
        const target = normalizeTarget(rawTarget);
        if (!target) continue;

        const resolvedTarget = resolve(resolve(markdownPath, ".."), target);
        const relativeTarget = relative(ROOT, resolvedTarget);
        if (relativeTarget.startsWith("..")) {
          errors.push(`${markdownPath}:${index + 1}: link escapes repo: ${rawTarget}`);
          continue;
        }
        if (!existsSync(resolvedTarget)) {
          errors.push(`${markdownPath}:${index + 1}: broken internal link: ${rawTarget}`);
        }
      }
    }
  }

  return errors;
}

function linkedMarkdownTargets(indexPath) {
  const indexText = readFileSync(indexPath, "utf8");
  const linkedTargets = new Set();
  let inFence = false;
  for (const rawLine of indexText.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(rawLine)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    for (const rawTarget of scanLinkTargets(stripInlineCode(rawLine))) {
      const target = normalizeTarget(rawTarget);
      if (target) linkedTargets.add(resolve(indexPath, "..", target));
    }
  }
  return linkedTargets;
}

function chinesePathFor(englishPath) {
  return englishPath.replace(/\.md$/, "-zh.md");
}

function englishPathFor(chinesePath) {
  return chinesePath.replace(/-zh\.md$/, ".md");
}

function checkDocsLanguageIndexes() {
  const englishIndex = resolve(DOCS_ROOT, "README.md");
  const chineseIndex = resolve(DOCS_ROOT, "README-zh.md");
  const errors = [];

  for (const indexPath of [englishIndex, chineseIndex]) {
    if (!existsSync(indexPath)) {
      errors.push(`${relative(ROOT, indexPath).replaceAll("\\", "/")} does not exist`);
    }
  }
  if (errors.length > 0) return errors;

  const englishTargets = linkedMarkdownTargets(englishIndex);
  const chineseTargets = linkedMarkdownTargets(chineseIndex);

  if (!englishTargets.has(chineseIndex)) {
    errors.push("docs/README.md does not link to docs/README-zh.md");
  }
  if (!chineseTargets.has(englishIndex)) {
    errors.push("docs/README-zh.md does not link to docs/README.md");
  }

  for (const docPath of listFiles(DOCS_ROOT, (path) => path.endsWith(".md"))) {
    const isChinese = docPath.endsWith("-zh.md");
    const counterpart = isChinese ? englishPathFor(docPath) : chinesePathFor(docPath);
    const shown = relative(ROOT, docPath).replaceAll("\\", "/");
    const counterpartShown = relative(ROOT, counterpart).replaceAll("\\", "/");

    if (!existsSync(counterpart)) {
      errors.push(`${shown} is missing language counterpart ${counterpartShown}`);
    }

    const expectedTargets = isChinese ? chineseTargets : englishTargets;
    const ownIndex = isChinese ? chineseIndex : englishIndex;
    if (docPath !== ownIndex && !expectedTargets.has(docPath)) {
      const indexShown = relative(ROOT, ownIndex).replaceAll("\\", "/");
      errors.push(`${indexShown} does not index ${shown}`);
    }

    if (!linkedMarkdownTargets(docPath).has(counterpart)) {
      errors.push(`${shown} does not link to its language counterpart ${counterpartShown}`);
    }
  }

  return errors;
}

const errors = [...checkInternalLinks(), ...checkDocsLanguageIndexes()];

if (errors.length > 0) {
  console.error("Markdown documentation checks failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Markdown documentation checks passed.");
