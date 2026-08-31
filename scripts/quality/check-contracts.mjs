import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { listFiles, projectRoot, readJson, readText } from "./lib/files.mjs";

const ROOT = projectRoot();
const TERMS_PATH = resolve(ROOT, "docs/contracts/contract-terms.json");
const RULES_PATH = resolve(ROOT, "docs/contracts/contract-rules.json");

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function pathMatches(relativePath, patterns) {
  return patterns.some((pattern) => {
    if (pattern.endsWith("/")) return relativePath.startsWith(pattern);
    return relativePath === pattern;
  });
}

function compileMatcher(term, match = "word") {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (match === "regex") return new RegExp(term);
  if (match === "literal") return new RegExp(escaped);
  if (match === "markdown_code") return new RegExp(`\`${escaped}\``);
  // word uses Unicode-aware boundaries, treating ASCII, CJK, and multi-word
  // phrases consistently around letters, digits, and underscores. This prevents
  // CJK contract terms from degrading into false-positive substring matches.
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "u");
}

function scanFiles(rules) {
  const scan = rules.scan ?? {};
  const roots = asArray(scan.roots);
  const extensions = new Set(asArray(scan.extensions));
  const skipPaths = asArray(scan.skip_paths);
  const files = [];

  for (const rootName of roots) {
    const root = resolve(ROOT, rootName);
    if (!existsSync(root)) continue;
    for (const filePath of listFiles(root, (path) => extensions.has(path.slice(path.lastIndexOf("."))))) {
      const relativePath = relative(ROOT, filePath).replaceAll("\\", "/");
      if (!pathMatches(relativePath, skipPaths)) {
        files.push(filePath);
      }
    }
  }

  return files.sort();
}

function validateContractFiles(terms, rules) {
  const errors = [];
  if (!terms.terms || typeof terms.terms !== "object" || Array.isArray(terms.terms)) {
    errors.push(`${TERMS_PATH}: terms must be an object`);
  }
  if (!rules.scan || typeof rules.scan !== "object" || Array.isArray(rules.scan)) {
    errors.push(`${RULES_PATH}: scan must be an object`);
  }
  for (const key of ["forbidden_terms", "scoped_terms"]) {
    if (!Array.isArray(rules[key])) {
      errors.push(`${RULES_PATH}: ${key} must be an array`);
    }
  }
  return errors;
}

function checkForbiddenAndScopedTerms(rules) {
  const errors = [];
  // Compile configured regular expressions and collect a clear error when JSON
  // contains an invalid pattern, especially for match:"regex", rather than
  // terminating the entire gate with an uncaught stack trace.
  const compileRules = (list, kind) =>
    asArray(list)
      .map((rule) => {
        try {
          return { ...rule, matcher: compileMatcher(rule.term, rule.match) };
        } catch (error) {
          errors.push(`${RULES_PATH}: ${kind} rule for \`${rule.term}\` has an invalid regular expression: ${error.message}`);
          return null;
        }
      })
      .filter(Boolean);
  const forbidden = compileRules(rules.forbidden_terms, "forbidden_terms");
  const scoped = compileRules(rules.scoped_terms, "scoped_terms");

  for (const filePath of scanFiles(rules)) {
    const relativePath = relative(ROOT, filePath).replaceAll("\\", "/");
    const lines = readText(filePath).split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      for (const rule of forbidden) {
        if (!rule.matcher.test(line)) continue;
        if (pathMatches(relativePath, asArray(rule.allowed_paths))) continue;
        errors.push(`${filePath}:${index + 1}: forbidden contract term \`${rule.term}\`; use \`${rule.use ?? "<unspecified>"}\`. Reason: ${rule.reason ?? "not specified"}`);
      }
      for (const rule of scoped) {
        if (!rule.matcher.test(line)) continue;
        if (pathMatches(relativePath, asArray(rule.allowed_paths))) continue;
        errors.push(`${filePath}:${index + 1}: contract term \`${rule.term}\` is not allowed at this path. Reason: ${rule.reason ?? "not specified"}`);
      }
    }
  }

  return errors;
}

function checkTermSources(terms) {
  const errors = [];
  for (const [term, spec] of Object.entries(terms.terms ?? {})) {
    if (spec?.canonical !== true) continue;
    const matcher = compileMatcher(term, "literal");
    for (const source of asArray(spec.source)) {
      const sourcePath = resolve(ROOT, source);
      if (!existsSync(sourcePath)) continue;
      if (!matcher.test(readText(sourcePath))) {
        errors.push(`${source}: missing canonical contract term \`${term}\``);
      }
    }
  }
  return errors;
}

function checkEnums(terms) {
  const errors = [];
  for (const [enumName, spec] of Object.entries(terms.enums ?? {})) {
    const members = asArray(spec.members);
    const sources = asArray(spec.source);
    if (members.length === 0 || sources.length === 0) {
      errors.push(`${TERMS_PATH}: enum \`${enumName}\` must declare members and source`);
      continue;
    }
    for (const source of sources) {
      const sourcePath = resolve(ROOT, source);
      if (!existsSync(sourcePath)) continue;
      const text = readText(sourcePath);
      for (const member of members) {
        if (!compileMatcher(member, "word").test(text)) {
          errors.push(`${source}: enum \`${enumName}\` is missing member \`${member}\``);
        }
      }
    }
  }
  return errors;
}

const terms = readJson(TERMS_PATH);
const rules = readJson(RULES_PATH);
const errors = [
  ...validateContractFiles(terms, rules),
  ...checkForbiddenAndScopedTerms(rules),
  ...checkTermSources(terms),
  ...checkEnums(terms),
];

if (errors.length > 0) {
  console.error("Contract term checks failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Contract term checks passed.");
