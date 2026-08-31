import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { projectRoot, readJson, readText } from "./lib/files.mjs";

const ROOT = projectRoot();
const CONFIG_PATH = resolve(ROOT, "docs/contracts/site-checks.json");

if (!existsSync(CONFIG_PATH)) {
  console.log("docs/contracts/site-checks.json was not found; skipping static-site checks.");
  process.exit(0);
}

const config = readJson(CONFIG_PATH);
const entryPath = resolve(ROOT, config.entryFile);

if (!existsSync(entryPath)) {
  console.log(`${config.entryFile} was not found; skipping static-site checks because the frontend entry is not set up.`);
  process.exit(0);
}

const errors = [];
const html = readText(entryPath);

for (const snippet of config.requiredSnippets ?? []) {
  if (!html.includes(snippet)) {
    errors.push(`${config.entryFile} missing required snippet: ${snippet}`);
  }
}

// Cover single/double quotes and arbitrary relative paths. Skip absolute URLs
// (http(s)://, //, data:, mailto:, and similar), root-relative paths that must be
// validated at deployment, and anchor-only references.
const resourceMatches = html.matchAll(/(?:href|src)\s*=\s*("([^"]+)"|'([^']+)')/gi);
for (const match of resourceMatches) {
  const url = (match[2] ?? match[3] ?? "").trim();
  if (!url) continue;
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url)) continue;
  if (url.startsWith("/")) continue;
  const cleanUrl = url.split(/[?#]/, 1)[0];
  const resourcePath = resolve(entryPath, "..", cleanUrl);
  if (!existsSync(resourcePath)) {
    errors.push(`${config.entryFile} references missing resource: ${url}`);
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
