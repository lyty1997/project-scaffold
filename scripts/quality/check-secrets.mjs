import { basename, extname, relative } from "node:path";
import { listFiles, projectRoot, readText } from "./lib/files.mjs";

const ROOT = projectRoot();

// 常见密钥关键字：允许作为更长标识符的后缀（client_secret / access_token 等），
// 因此前面不加 \b 词边界，只要求后面紧跟赋值符号。
const SECRET_KEYWORD = "(?:api[_-]?key|apikey|secret|token|password|passwd|pwd|access[_-]?key)";

const SECRET_PATTERNS = [
  { name: "private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "GitHub token", pattern: /gh[pousr]_[0-9A-Za-z_]{36,}/ },
  { name: "AWS access key", pattern: /AKIA[0-9A-Z]{16}/ },
  { name: "Slack token", pattern: /xox[baprs]-[0-9A-Za-z-]{10,}/ },
  // 带引号赋值：keyword: "值" / keyword = '值'
  { name: "quoted secret assignment", pattern: new RegExp(`${SECRET_KEYWORD}\\s*[:=]\\s*["'][^"']{8,}["']`, "i") },
  // 不带引号赋值：keyword=值（值足够长、无空白/引号/注释符），覆盖 shell / env / PowerShell / Python
  { name: "unquoted secret assignment", pattern: new RegExp(`${SECRET_KEYWORD}\\s*[:=]\\s*[^\\s"'#;,)]{12,}`, "i") },
  // URL 内嵌凭证：形如 协议://用户:口令@主机
  { name: "credential in URL", pattern: /[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s:@]+@/i },
];

// 与 scripts/init.mjs 的 isTextFile 保持一致：既扫常规文本扩展名，也扫这些无扩展名文本文件，
// 避免密钥藏在 shell/PowerShell/Python 脚本或 CODEOWNERS 之类文件里逃过扫描。
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
