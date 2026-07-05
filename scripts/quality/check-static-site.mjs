import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { projectRoot, readJson, readText } from "./lib/files.mjs";

const ROOT = projectRoot();
const CONFIG_PATH = resolve(ROOT, "docs/contracts/site-checks.json");

if (!existsSync(CONFIG_PATH)) {
  console.log("未找到 docs/contracts/site-checks.json，跳过静态站点检查。");
  process.exit(0);
}

const config = readJson(CONFIG_PATH);
const entryPath = resolve(ROOT, config.entryFile);

if (!existsSync(entryPath)) {
  console.log(`未找到 ${config.entryFile}，跳过静态站点检查（尚未搭建对应前端入口）。`);
  process.exit(0);
}

const errors = [];
const html = readText(entryPath);

for (const snippet of config.requiredSnippets ?? []) {
  if (!html.includes(snippet)) {
    errors.push(`${config.entryFile} missing required snippet: ${snippet}`);
  }
}

const resourceMatches = html.matchAll(/(?:href|src)="(\.\/[^"]+)"/g);
for (const match of resourceMatches) {
  const resourcePath = resolve(entryPath, "..", match[1]);
  if (!existsSync(resourcePath)) {
    errors.push(`${config.entryFile} references missing resource: ${match[1]}`);
  }
}

if (errors.length > 0) {
  console.error("Static site checks failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Static site checks passed.");
