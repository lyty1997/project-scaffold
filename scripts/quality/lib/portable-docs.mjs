import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";
import { listFiles, projectRoot } from "./files.mjs";

export const ROOT = projectRoot();
export const DOCS_ROOT = resolve(ROOT, "docs");
export const PORTABLE_BUILD_ROOT = resolve(ROOT, "build/portable-docs");
export const PORTABLE_TEMPLATE = resolve(ROOT, "scripts/docs/portable-template.html");
export const PORTABLE_LINK_FILTER = resolve(ROOT, "scripts/docs/portable-local-links.lua");
export const PORTABLE_EXPORTER = resolve(ROOT, "scripts/docs/export-portable.mjs");
export const PORTABLE_MIN_PANDOC_VERSION = "2.12";

const SELF = fileURLToPath(import.meta.url);
const DEFAULT_GENERATOR_FILES = Object.freeze([
  SELF,
  PORTABLE_EXPORTER,
  PORTABLE_TEMPLATE,
  PORTABLE_LINK_FILTER,
]);
const IMAGE_TYPES = Object.freeze({
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
});
const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
const MAX_DOCUMENT_IMAGE_BYTES = 32 * 1024 * 1024;
const RAW_HTML_PATTERN = /<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*?)?\/?>/;

export function repoRelative(path) {
  return relative(ROOT, path).replaceAll("\\", "/");
}

function pathInside(root, path) {
  const candidate = relative(root, path);
  return candidate === "" || (!candidate.startsWith(`..${sep}`) && candidate !== ".." && !isAbsolute(candidate));
}

function regularFileWithinRoot(path, root, label) {
  const absolutePath = resolve(path);
  if (!pathInside(root, absolutePath)) {
    throw new Error(`${label} 逃逸允许根目录：${absolutePath}`);
  }
  if (!existsSync(absolutePath)) {
    throw new Error(`${label}不存在：${absolutePath}`);
  }
  const stats = lstatSync(absolutePath);
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error(`${label}必须是普通文件，不能是 symlink：${absolutePath}`);
  }
  const realRoot = realpathSync(root);
  const realPath = realpathSync(absolutePath);
  if (!pathInside(realRoot, realPath)) {
    throw new Error(`${label}真实路径逃逸允许根目录：${absolutePath}`);
  }
  return absolutePath;
}

function isEscaped(text, index) {
  let slashes = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) {
    slashes += 1;
  }
  return slashes % 2 === 1;
}

function maskInlineCode(line) {
  const chars = line.split("");
  let cursor = 0;
  while (cursor < line.length) {
    if (line[cursor] !== "`") {
      cursor += 1;
      continue;
    }
    let endOfRun = cursor;
    while (line[endOfRun] === "`") endOfRun += 1;
    const marker = line.slice(cursor, endOfRun);
    const close = line.indexOf(marker, endOfRun);
    if (close === -1) {
      cursor = endOfRun;
      continue;
    }
    for (let index = cursor; index < close + marker.length; index += 1) chars[index] = " ";
    cursor = close + marker.length;
  }
  return chars.join("");
}

function markdownWithoutCode(text) {
  const output = [];
  let fence = null;
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(`{3,}|~{3,})/);
    if (fence) {
      if (match && match[1][0] === fence.char && match[1].length >= fence.length) fence = null;
      output.push(" ".repeat(line.length));
      continue;
    }
    if (match) {
      fence = { char: match[1][0], length: match[1].length };
      output.push(" ".repeat(line.length));
      continue;
    }
    output.push(maskInlineCode(line));
  }
  return output.join("\n");
}

function findLabelEnd(line, start) {
  let depth = 0;
  for (let cursor = start; cursor < line.length; cursor += 1) {
    if (isEscaped(line, cursor)) continue;
    if (line[cursor] === "[") depth += 1;
    if (line[cursor] !== "]") continue;
    if (depth === 0) return cursor;
    depth -= 1;
  }
  return -1;
}

function parseImageDestination(line, openParen) {
  let cursor = openParen + 1;
  while (/\s/.test(line[cursor] ?? "")) cursor += 1;
  if (line[cursor] === "<") {
    const close = line.indexOf(">", cursor + 1);
    if (close === -1) return null;
    const end = line.indexOf(")", close + 1);
    if (end === -1) return null;
    return { target: line.slice(cursor + 1, close), end };
  }

  const start = cursor;
  let depth = 0;
  let targetEnd = -1;
  let quote = "";
  for (; cursor < line.length; cursor += 1) {
    const char = line[cursor];
    if (isEscaped(line, cursor)) continue;
    if (quote) {
      if (char === quote) quote = "";
      continue;
    }
    if ((char === '"' || char === "'") && targetEnd !== -1) {
      quote = char;
      continue;
    }
    if (char === "(") {
      depth += 1;
      continue;
    }
    if (char === ")") {
      if (depth === 0) {
        return {
          target: line.slice(start, targetEnd === -1 ? cursor : targetEnd),
          end: cursor,
        };
      }
      depth -= 1;
      continue;
    }
    if (/\s/.test(char) && depth === 0 && targetEnd === -1) targetEnd = cursor;
  }
  return null;
}

export function findMarkdownImages(text) {
  const masked = markdownWithoutCode(text);
  const originalLines = text.split(/\r?\n/);
  const maskedLines = masked.split("\n");
  const images = [];

  for (let lineIndex = 0; lineIndex < maskedLines.length; lineIndex += 1) {
    const line = maskedLines[lineIndex];
    const original = originalLines[lineIndex] ?? "";
    let cursor = 0;
    while (cursor < line.length) {
      const start = line.indexOf("![", cursor);
      if (start === -1) break;
      if (isEscaped(line, start)) {
        cursor = start + 2;
        continue;
      }
      const labelEnd = findLabelEnd(line, start + 2);
      if (labelEnd === -1) break;
      let openParen = labelEnd + 1;
      while (/\s/.test(line[openParen] ?? "")) openParen += 1;
      if (line[openParen] !== "(") {
        cursor = labelEnd + 1;
        continue;
      }
      const destination = parseImageDestination(original, openParen);
      if (!destination) {
        cursor = openParen + 1;
        continue;
      }
      images.push({
        alt: original.slice(start + 2, labelEnd).trim(),
        target: destination.target.trim(),
        line: lineIndex + 1,
      });
      cursor = destination.end + 1;
    }
  }
  return images;
}

function verifyImageSignature(bytes, mime, label) {
  const valid =
    (mime === "image/png" &&
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
    (mime === "image/jpeg" && bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
    (mime === "image/gif" && ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"))) ||
    (mime === "image/webp" &&
      bytes.length >= 12 &&
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP");
  if (!valid) throw new Error(`${label} 的文件签名与扩展名不一致。`);
}

function normalizeImageTarget(rawTarget, sourcePath, root, line) {
  if (!rawTarget) throw new Error(`${sourcePath}:${line}: 图片目标为空。`);
  const unescaped = rawTarget.replace(/\\([\\()[\]<> ])/g, "$1");
  if (
    isAbsolute(unescaped) ||
    unescaped.startsWith("//") ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(unescaped)
  ) {
    throw new Error(`${sourcePath}:${line}: 便携导出只接受仓库内本地图片：${rawTarget}`);
  }
  if (/[?#]/.test(unescaped)) {
    throw new Error(`${sourcePath}:${line}: 本地图片路径不能带 query 或 fragment：${rawTarget}`);
  }
  let decoded;
  try {
    decoded = decodeURIComponent(unescaped);
  } catch (error) {
    throw new Error(`${sourcePath}:${line}: 图片路径 URL 编码无效：${error.message}`);
  }
  if (decoded.includes("\0") || /[?#]/.test(decoded)) {
    throw new Error(`${sourcePath}:${line}: 图片路径包含不允许的字符。`);
  }
  return regularFileWithinRoot(resolve(dirname(sourcePath), decoded), root, `${sourcePath}:${line}: 图片`);
}

function cleanHeading(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_~`]/g, "")
    .trim();
}

function addHashInput(hash, label, bytes) {
  hash.update(label);
  hash.update("\0");
  hash.update(bytes);
  hash.update("\0");
}

export function inspectPortableSource(
  sourcePath,
  { root = ROOT, generatorFiles = DEFAULT_GENERATOR_FILES } = {}
) {
  const source = regularFileWithinRoot(sourcePath, root, "便携 Markdown 源");
  if (extname(source).toLowerCase() !== ".md") {
    throw new Error(`便携文档源必须是 .md：${source}`);
  }
  const sourceBytes = readFileSync(source);
  const sourceText = sourceBytes.toString("utf8");
  const withoutCode = markdownWithoutCode(sourceText);
  if (RAW_HTML_PATTERN.test(withoutCode)) {
    throw new Error(`${source} 包含原始 HTML；便携导出只接受可审查的 Markdown 结构。`);
  }

  const imageRefs = findMarkdownImages(sourceText);
  if (imageRefs.length === 0) throw new Error(`${source} 没有可内嵌的 Markdown 图片。`);
  const cache = new Map();
  const images = [];
  let totalBytes = 0;
  for (const ref of imageRefs) {
    if (!cleanHeading(ref.alt)) {
      throw new Error(`${source}:${ref.line}: 图片必须提供非空 alt 文本。`);
    }
    const path = normalizeImageTarget(ref.target, source, root, ref.line);
    const extension = extname(path).toLowerCase();
    const mime = IMAGE_TYPES[extension];
    if (!mime) {
      throw new Error(`${source}:${ref.line}: 不支持主动或未知图片格式 ${extension || "<none>"}。`);
    }
    let bytes = cache.get(path);
    if (!bytes) {
      const size = statSync(path).size;
      if (size === 0 || size > MAX_IMAGE_BYTES) {
        throw new Error(`${source}:${ref.line}: 图片必须大于 0 且不超过 16 MiB：${path}`);
      }
      bytes = readFileSync(path);
      verifyImageSignature(bytes, mime, `${source}:${ref.line}: 图片`);
      cache.set(path, bytes);
    }
    totalBytes += bytes.length;
    if (totalBytes > MAX_DOCUMENT_IMAGE_BYTES) {
      throw new Error(`${source} 的图片总量超过 32 MiB。`);
    }
    images.push({ ...ref, path, mime, bytes });
  }

  const sourceRelative = relative(root, source).replaceAll("\\", "/");
  const firstHeading = withoutCode.match(/^#\s+(.+)$/m);
  const title = cleanHeading(firstHeading?.[1] ?? basename(source, ".md"));
  const locale = /[\u3400-\u9fff]/u.test(sourceText) ? "zh-CN" : "en";
  const hash = createHash("sha256");
  addHashInput(hash, sourceRelative, sourceBytes);
  for (const imagePath of [...cache.keys()].sort()) {
    addHashInput(
      hash,
      relative(root, imagePath).replaceAll("\\", "/"),
      cache.get(imagePath)
    );
  }
  for (const generatorPath of generatorFiles) {
    if (!existsSync(generatorPath)) throw new Error(`缺少便携导出器文件：${generatorPath}`);
    addHashInput(hash, `@generator/${basename(generatorPath)}`, readFileSync(generatorPath));
  }

  return {
    source,
    sourceRelative,
    sourceText,
    title,
    locale,
    images,
    totalImageBytes: totalBytes,
    inputSha256: hash.digest("hex"),
  };
}

export function portableOutputPath(sourcePath) {
  const source = resolve(sourcePath);
  if (!pathInside(DOCS_ROOT, source)) throw new Error(`便携源不在 docs/：${source}`);
  const outputRelative = relative(DOCS_ROOT, source).replace(/\.md$/i, ".html");
  return resolve(PORTABLE_BUILD_ROOT, outputRelative);
}

export function findPortableSources(requested = []) {
  let candidates;
  if (requested.length > 0) {
    candidates = requested.map((value) => {
      if (value.startsWith("-")) throw new Error(`不支持便携导出选项：${value}`);
      return resolve(ROOT, value);
    });
  } else {
    candidates = listFiles(DOCS_ROOT, (path) => path.endsWith(".md")).filter((path) =>
      findMarkdownImages(readFileSync(path, "utf8")).length > 0
    );
  }

  const unique = [...new Set(candidates)].sort();
  if (unique.length === 0) throw new Error("没有找到包含本地 Markdown 图片的文档。");
  for (const path of unique) {
    if (!pathInside(DOCS_ROOT, path)) throw new Error(`便携文档必须位于 docs/：${path}`);
    inspectPortableSource(path);
  }
  return unique;
}

export function compareVersions(left, right) {
  const a = String(left).split(".").map(Number);
  const b = String(right).split(".").map(Number);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

function metaContent(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.match(new RegExp(`<meta\\s+name="${escaped}"\\s+content="([^"]*)"\\s*/?>`, "i"))?.[1] ?? "";
}

function strictBase64(value) {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    return null;
  }
  const bytes = Buffer.from(value, "base64");
  return bytes.toString("base64") === value ? bytes : null;
}

export function checkPortableHtml(
  sourcePath,
  outputPath,
  { root = ROOT, generatorFiles = DEFAULT_GENERATOR_FILES } = {}
) {
  const expected = inspectPortableSource(sourcePath, { root, generatorFiles });
  const errors = [];
  if (!existsSync(outputPath)) {
    return { errors: [`缺少便携 HTML：${outputPath}`], expected };
  }
  const outputStats = lstatSync(outputPath);
  if (outputStats.isSymbolicLink() || !outputStats.isFile()) {
    return { errors: [`便携 HTML 必须是普通文件：${outputPath}`], expected };
  }
  const html = readFileSync(outputPath, "utf8");
  if (!/^<!doctype html>/i.test(html)) errors.push("便携产物缺少 HTML5 doctype。");
  if (!/<html\b[^>]*\blang="(?:zh-CN|en)"/i.test(html)) errors.push("便携产物缺少受支持的 html lang。");
  if (!/<h1\b/i.test(html)) errors.push("便携产物没有正文 H1。");
  if (metaContent(html, "portable-source") !== expected.sourceRelative) {
    errors.push("便携产物记录的源路径与当前 Markdown 不一致。");
  }
  if (metaContent(html, "portable-input-sha256") !== expected.inputSha256) {
    errors.push("便携产物输入摘要已过期。");
  }
  if (Number(metaContent(html, "portable-image-count")) !== expected.images.length) {
    errors.push("便携产物记录的图片数量不正确。");
  }
  const pandocVersion = metaContent(html, "portable-pandoc-version");
  if (!/^\d+(?:\.\d+)+$/.test(pandocVersion)) {
    errors.push("便携产物缺少合法 Pandoc 版本回执。");
  } else if (compareVersions(pandocVersion, PORTABLE_MIN_PANDOC_VERSION) < 0) {
    errors.push(`便携产物 Pandoc 版本低于 ${PORTABLE_MIN_PANDOC_VERSION}。`);
  }

  for (const forbidden of ["script", "link", "base", "form", "iframe", "object", "embed", "video", "audio", "source"]) {
    if (new RegExp(`<${forbidden}\\b`, "i").test(html)) {
      errors.push(`便携产物不得包含 <${forbidden}>。`);
    }
  }
  for (const match of html.matchAll(/\shref\s*=\s*(["'])(.*?)\1/gi)) {
    if (!/^(?:#|https?:\/\/|mailto:|tel:)/i.test(match[2])) {
      errors.push(`便携产物仍含本地或不安全 href：${match[2]}`);
    }
  }
  for (const match of html.matchAll(/\ssrc\s*=\s*(["'])(.*?)\1/gi)) {
    if (!/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(match[2])) {
      errors.push(`便携产物仍含非内嵌 src：${match[2]}`);
    }
  }
  if (/\s(?:href|src)\s*=\s*(?!["'])/i.test(html)) {
    errors.push("便携产物包含未加引号的 href 或 src。");
  }
  if (/\s(?:srcset|poster)\s*=/i.test(html)) {
    errors.push("便携产物不得包含 srcset 或 poster 资源引用。");
  }
  if (/@import\b/i.test(html)) errors.push("便携 CSS 不得包含 @import。");
  for (const match of html.matchAll(/url\(([^)]*)\)/gi)) {
    const value = match[1].trim().replace(/^(["'])(.*)\1$/, "$2");
    if (!value.startsWith("data:")) errors.push(`便携 CSS 仍含外部 url：${value}`);
  }

  const allImageTags = [...html.matchAll(/<img\b[^>]*>/gi)];
  if (allImageTags.length !== expected.images.length) {
    errors.push(`便携产物共有 ${allImageTags.length} 个 img 标签，预期 ${expected.images.length} 个。`);
  }
  const embedded = [...html.matchAll(/<img\b[^>]*\bsrc="data:(image\/(?:png|jpeg|webp|gif));base64,([^"]+)"[^>]*>/gi)];
  if (embedded.length !== expected.images.length) {
    errors.push(`便携产物内嵌 ${embedded.length} 张图片，预期 ${expected.images.length} 张。`);
  }
  for (let index = 0; index < Math.min(embedded.length, expected.images.length); index += 1) {
    const [tag, mime, base64] = embedded[index];
    const image = expected.images[index];
    if (mime.toLowerCase() !== image.mime) {
      errors.push(`第 ${index + 1} 张便携图片 MIME 不正确。`);
    }
    const bytes = strictBase64(base64);
    if (!bytes || !bytes.equals(image.bytes)) {
      errors.push(`第 ${index + 1} 张便携图片字节与原图不一致。`);
    }
    const alt = tag.match(/\balt="([^"]*)"/i)?.[1] ?? "";
    if (!alt.trim()) errors.push(`第 ${index + 1} 张便携图片缺少 alt 文本。`);
  }

  return {
    errors: [...new Set(errors)],
    expected,
    receipt: {
      source: expected.sourceRelative,
      output: outputPath,
      images: expected.images.length,
      inputSha256: expected.inputSha256,
      bytes: outputStats.size,
      pandocVersion,
    },
  };
}
