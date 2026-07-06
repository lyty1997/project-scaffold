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
  // word：Unicode 感知的词边界，ASCII 与中文（及多词短语）统一按"字母/数字/下划线"判定边界，
  // 避免中文契约词退化成子串匹配（例如 `草稿` 命中 `草稿箱` 造成误判）。
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
  // 编译规则里的正则；用户在 JSON 里写错正则（尤其 match:"regex"）时收集为清晰错误，
  // 而不是让整个门禁抛未捕获异常、只剩一段栈信息。
  const compileRules = (list, kind) =>
    asArray(list)
      .map((rule) => {
        try {
          return { ...rule, matcher: compileMatcher(rule.term, rule.match) };
        } catch (error) {
          errors.push(`${RULES_PATH}: ${kind} 规则词 \`${rule.term}\` 的正则无法编译：${error.message}`);
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
        errors.push(`${filePath}:${index + 1}: 禁用契约词 \`${rule.term}\`，应使用 \`${rule.use ?? "<unspecified>"}\`；原因：${rule.reason ?? "未说明"}`);
      }
      for (const rule of scoped) {
        if (!rule.matcher.test(line)) continue;
        if (pathMatches(relativePath, asArray(rule.allowed_paths))) continue;
        errors.push(`${filePath}:${index + 1}: 契约词 \`${rule.term}\` 不允许出现在该路径；原因：${rule.reason ?? "未说明"}`);
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
        errors.push(`${source}: 缺少 canonical 契约词 \`${term}\``);
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
          errors.push(`${source}: 枚举 \`${enumName}\` 缺少成员 \`${member}\``);
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

