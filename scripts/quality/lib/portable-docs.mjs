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
    throw new Error(`${label} escapes the allowed root: ${absolutePath}`);
  }
  if (!existsSync(absolutePath)) {
    throw new Error(`${label} does not exist: ${absolutePath}`);
  }
  const stats = lstatSync(absolutePath);
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error(`${label} must be a regular file, not a symbolic link: ${absolutePath}`);
  }
  const realRoot = realpathSync(root);
  const realPath = realpathSync(absolutePath);
  if (!pathInside(realRoot, realPath)) {
    throw new Error(`${label} resolves outside the allowed root: ${absolutePath}`);
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
  if (!valid) throw new Error(`${label} file signature does not match its extension.`);
}

function normalizeImageTarget(rawTarget, sourcePath, root, line) {
  if (!rawTarget) throw new Error(`${sourcePath}:${line}: image target is empty.`);
  const unescaped = rawTarget.replace(/\\([\\()[\]<> ])/g, "$1");
  if (
    isAbsolute(unescaped) ||
    unescaped.startsWith("//") ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(unescaped)
  ) {
    throw new Error(`${sourcePath}:${line}: portable export accepts only repository-local images: ${rawTarget}`);
  }
  if (/[?#]/.test(unescaped)) {
    throw new Error(`${sourcePath}:${line}: local image paths must not include a query or fragment: ${rawTarget}`);
  }
  let decoded;
  try {
    decoded = decodeURIComponent(unescaped);
  } catch (error) {
    throw new Error(`${sourcePath}:${line}: image path has invalid URL encoding: ${error.message}`);
  }
  if (decoded.includes("\0") || /[?#]/.test(decoded)) {
    throw new Error(`${sourcePath}:${line}: image path contains a forbidden character.`);
  }
  return regularFileWithinRoot(resolve(dirname(sourcePath), decoded), root, `${sourcePath}:${line}: image`);
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
  const source = regularFileWithinRoot(sourcePath, root, "Portable Markdown source");
  if (extname(source).toLowerCase() !== ".md") {
    throw new Error(`Portable document source must be .md: ${source}`);
  }
  const sourceBytes = readFileSync(source);
  const sourceText = sourceBytes.toString("utf8");
  const withoutCode = markdownWithoutCode(sourceText);
  if (RAW_HTML_PATTERN.test(withoutCode)) {
    throw new Error(`${source} contains raw HTML; portable export accepts only auditable Markdown structure.`);
  }

  const imageRefs = findMarkdownImages(sourceText);
  if (imageRefs.length === 0) throw new Error(`${source} has no embeddable Markdown images.`);
  const cache = new Map();
  const images = [];
  let totalBytes = 0;
  for (const ref of imageRefs) {
    if (!cleanHeading(ref.alt)) {
      throw new Error(`${source}:${ref.line}: image must provide non-empty alt text.`);
    }
    const path = normalizeImageTarget(ref.target, source, root, ref.line);
    const extension = extname(path).toLowerCase();
    const mime = IMAGE_TYPES[extension];
    if (!mime) {
      throw new Error(`${source}:${ref.line}: unsupported or unknown image format ${extension || "<none>"}.`);
    }
    let bytes = cache.get(path);
    if (!bytes) {
      const size = statSync(path).size;
      if (size === 0 || size > MAX_IMAGE_BYTES) {
        throw new Error(`${source}:${ref.line}: image must be larger than 0 bytes and no more than 16 MiB: ${path}`);
      }
      bytes = readFileSync(path);
      verifyImageSignature(bytes, mime, `${source}:${ref.line}: image`);
      cache.set(path, bytes);
    }
    totalBytes += bytes.length;
    if (totalBytes > MAX_DOCUMENT_IMAGE_BYTES) {
      throw new Error(`${source} contains more than 32 MiB of images.`);
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
    if (!existsSync(generatorPath)) throw new Error(`Portable exporter file is missing: ${generatorPath}`);
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
  if (!pathInside(DOCS_ROOT, source)) throw new Error(`Portable source is outside docs/: ${source}`);
  const outputRelative = relative(DOCS_ROOT, source).replace(/\.md$/i, ".html");
  return resolve(PORTABLE_BUILD_ROOT, outputRelative);
}

export function findPortableSources(requested = []) {
  let candidates;
  if (requested.length > 0) {
    candidates = requested.map((value) => {
      if (value.startsWith("-")) throw new Error(`Unsupported portable export option: ${value}`);
      return resolve(ROOT, value);
    });
  } else {
    candidates = listFiles(DOCS_ROOT, (path) => path.endsWith(".md")).filter((path) =>
      findMarkdownImages(readFileSync(path, "utf8")).length > 0
    );
  }

  const unique = [...new Set(candidates)].sort();
  if (unique.length === 0) throw new Error("No document containing a local Markdown image was found.");
  for (const path of unique) {
    if (!pathInside(DOCS_ROOT, path)) throw new Error(`Portable documents must be inside docs/: ${path}`);
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
    return { errors: [`Portable HTML is missing: ${outputPath}`], expected };
  }
  const outputStats = lstatSync(outputPath);
  if (outputStats.isSymbolicLink() || !outputStats.isFile()) {
    return { errors: [`Portable HTML must be a regular file: ${outputPath}`], expected };
  }
  const html = readFileSync(outputPath, "utf8");
  if (!/^<!doctype html>/i.test(html)) errors.push("Portable output is missing an HTML5 doctype.");
  if (!/<html\b[^>]*\blang="(?:zh-CN|en)"/i.test(html)) errors.push("Portable output is missing a supported html lang value.");
  if (!/<h1\b/i.test(html)) errors.push("Portable output has no document H1.");
  if (metaContent(html, "portable-source") !== expected.sourceRelative) {
    errors.push("Portable output source path does not match the current Markdown source.");
  }
  if (metaContent(html, "portable-input-sha256") !== expected.inputSha256) {
    errors.push("Portable output input digest is stale.");
  }
  if (Number(metaContent(html, "portable-image-count")) !== expected.images.length) {
    errors.push("Portable output records an incorrect image count.");
  }
  const pandocVersion = metaContent(html, "portable-pandoc-version");
  if (!/^\d+(?:\.\d+)+$/.test(pandocVersion)) {
    errors.push("Portable output is missing a valid Pandoc version receipt.");
  } else if (compareVersions(pandocVersion, PORTABLE_MIN_PANDOC_VERSION) < 0) {
    errors.push(`Portable output uses Pandoc older than ${PORTABLE_MIN_PANDOC_VERSION}.`);
  }

  for (const forbidden of ["script", "link", "base", "form", "iframe", "object", "embed", "video", "audio", "source"]) {
    if (new RegExp(`<${forbidden}\\b`, "i").test(html)) {
      errors.push(`Portable output must not contain <${forbidden}>.`);
    }
  }
  for (const match of html.matchAll(/\shref\s*=\s*(["'])(.*?)\1/gi)) {
    if (!/^(?:#|https?:\/\/|mailto:|tel:)/i.test(match[2])) {
      errors.push(`Portable output still contains a local or unsafe href: ${match[2]}`);
    }
  }
  for (const match of html.matchAll(/\ssrc\s*=\s*(["'])(.*?)\1/gi)) {
    if (!/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(match[2])) {
      errors.push(`Portable output still contains a non-embedded src: ${match[2]}`);
    }
  }
  if (/\s(?:href|src)\s*=\s*(?!["'])/i.test(html)) {
    errors.push("Portable output contains an unquoted href or src.");
  }
  if (/\s(?:srcset|poster)\s*=/i.test(html)) {
    errors.push("Portable output must not contain srcset or poster resource references.");
  }
  if (/@import\b/i.test(html)) errors.push("Portable CSS must not contain @import.");
  for (const match of html.matchAll(/url\(([^)]*)\)/gi)) {
    const value = match[1].trim().replace(/^(["'])(.*)\1$/, "$2");
    if (!value.startsWith("data:")) errors.push(`Portable CSS still contains an external URL: ${value}`);
  }

  const allImageTags = [...html.matchAll(/<img\b[^>]*>/gi)];
  if (allImageTags.length !== expected.images.length) {
    errors.push(`Portable output contains ${allImageTags.length} img tags; expected ${expected.images.length}.`);
  }
  const embedded = [...html.matchAll(/<img\b[^>]*\bsrc="data:(image\/(?:png|jpeg|webp|gif));base64,([^"]+)"[^>]*>/gi)];
  if (embedded.length !== expected.images.length) {
    errors.push(`Portable output embeds ${embedded.length} images; expected ${expected.images.length}.`);
  }
  for (let index = 0; index < Math.min(embedded.length, expected.images.length); index += 1) {
    const [tag, mime, base64] = embedded[index];
    const image = expected.images[index];
    if (mime.toLowerCase() !== image.mime) {
      errors.push(`Portable image ${index + 1} has an incorrect MIME type.`);
    }
    const bytes = strictBase64(base64);
    if (!bytes || !bytes.equals(image.bytes)) {
      errors.push(`Portable image ${index + 1} bytes do not match the source image.`);
    }
    const alt = tag.match(/\balt="([^"]*)"/i)?.[1] ?? "";
    if (!alt.trim()) errors.push(`Portable image ${index + 1} is missing alt text.`);
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
