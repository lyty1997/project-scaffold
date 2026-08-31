import { basename, extname, relative } from "node:path";
import { listFiles, projectRoot, readText } from "./lib/files.mjs";

const ROOT = projectRoot();

// Common secret keywords may be suffixes of longer identifiers such as
// client_secret or access_token, so do not require a leading word boundary;
// require only an assignment operator after the keyword.
const SECRET_KEYWORD = "(?:api[_-]?key|apikey|secret|token|password|passwd|pwd|access[_-]?key)";

const SECRET_PATTERNS = [
  { name: "private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "GitHub token", pattern: /gh[pousr]_[0-9A-Za-z_]{36,}/ },
  { name: "AWS access key", pattern: /AKIA[0-9A-Z]{16}/ },
  { name: "Slack token", pattern: /xox[baprs]-[0-9A-Za-z-]{10,}/ },
  // Quoted assignment: keyword: "value" / keyword = 'value'.
  { name: "quoted secret assignment", pattern: new RegExp(`${SECRET_KEYWORD}\\s*[:=]\\s*["'][^"']{8,}["']`, "i") },
  // Unquoted assignment: keyword=value, where the value is long enough, contains
  // no whitespace, quote, or comment delimiter, and ends at EOL or a comment.
  // The trailing boundary avoids truncating expressions such as
  // `token = document.createElement(...)` or `token = path.resolve(...)` at the
  // opening parenthesis while still covering shell, env, PowerShell, and config files.
  {
    name: "unquoted secret assignment",
    pattern: new RegExp(`${SECRET_KEYWORD}\\s*[:=]\\s*[^\\s"'#;,)]{12,}(?=\\s*(?:$|#|//))`, "i"),
  },
  // Credentials embedded in a URL authority (username and password before the host).
  { name: "credential in URL", pattern: /[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s:@]+@/i },
];

// Keep this aligned with scripts/init.mjs isTextFile: scan regular text
// extensions plus extensionless text files so secrets cannot hide in shell,
// PowerShell, Python, or files such as CODEOWNERS.
const TEXT_EXTENSIONS = new Set([
  ".css", ".html", ".js", ".json", ".jsx", ".md", ".mjs", ".cjs", ".ts", ".tsx",
  ".txt", ".yaml", ".yml", ".toml", ".ini", ".conf", ".env", ".sh", ".ps1", ".py",
]);
const EXTENSIONLESS_TEXT_FILES = new Set([".gitignore", ".editorconfig", ".gitattributes", "pre-commit", "CODEOWNERS", "Dockerfile"]);

function isScannable(path) {
  if (TEXT_EXTENSIONS.has(extname(path))) return true;
  return EXTENSIONLESS_TEXT_FILES.has(basename(path));
}

const errors = [];
for (const filePath of listFiles(ROOT, isScannable)) {
  const relativePath = relative(ROOT, filePath).replaceAll("\\", "/");
  if (relativePath.startsWith(".git/") || relativePath.startsWith("node_modules/")) {
    continue;
  }
  const lines = readText(filePath).split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (line.includes("pragma: allowlist secret")) continue;
    for (const { name, pattern } of SECRET_PATTERNS) {
      if (pattern.test(line)) {
        errors.push(`${filePath}:${index + 1}: possible ${name}`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error("Secret scan failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Secret scan passed.");
