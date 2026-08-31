import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, delimiter, dirname, relative, resolve, sep } from "node:path";
import {
  PORTABLE_EXPORTER,
  PORTABLE_LINK_FILTER,
  PORTABLE_MIN_PANDOC_VERSION,
  PORTABLE_TEMPLATE,
  ROOT,
  checkPortableHtml,
  compareVersions,
  findPortableSources,
  inspectPortableSource,
  portableOutputPath,
  repoRelative,
} from "../quality/lib/portable-docs.mjs";

function pandocInfo() {
  const executable = process.env.PANDOC_BIN?.trim() || "pandoc";
  const result = spawnSync(executable, ["--version"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  if (result.error) {
    throw new Error(
      `无法启动 Pandoc：${result.error.message}。请安装 Pandoc ${PORTABLE_MIN_PANDOC_VERSION}+，` +
        "或用 PANDOC_BIN 指定可执行文件。"
    );
  }
  if (result.status !== 0) {
    throw new Error(`Pandoc --version 失败（exit ${result.status}）：${result.stderr || result.stdout}`);
  }
  const version = result.stdout.match(/^pandoc\s+(\d+(?:\.\d+)+)/m)?.[1] ?? "";
  if (!version || compareVersions(version, PORTABLE_MIN_PANDOC_VERSION) < 0) {
    throw new Error(`需要 Pandoc ${PORTABLE_MIN_PANDOC_VERSION}+，当前为 ${version || "未知版本"}。`);
  }
  return { executable, version };
}

function ensureSafeOutputParent(outputPath) {
  const parent = dirname(outputPath);
  const relativeParent = relative(ROOT, parent);
  if (relativeParent === ".." || relativeParent.startsWith(`..${sep}`)) {
    throw new Error(`便携输出逃逸仓库：${outputPath}`);
  }
  let cursor = ROOT;
  for (const segment of relativeParent.split(sep).filter(Boolean)) {
    cursor = resolve(cursor, segment);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) {
      throw new Error(`便携输出目录不能经过 symlink：${cursor}`);
    }
  }
  mkdirSync(parent, { recursive: true });
  if (existsSync(outputPath)) {
    const stats = lstatSync(outputPath);
    if (stats.isSymbolicLink() || !stats.isFile()) {
      throw new Error(`便携输出必须是普通文件：${outputPath}`);
    }
  }
}

function commitCandidate(candidatePath, outputPath, tempDirectory) {
  const backupPath = resolve(tempDirectory, "previous.html");
  let backedUp = false;
  if (existsSync(outputPath)) {
    renameSync(outputPath, backupPath);
    backedUp = true;
  }
  try {
    renameSync(candidatePath, outputPath);
  } catch (error) {
    if (backedUp && existsSync(backupPath)) renameSync(backupPath, outputPath);
    throw error;
  }
}

function exportDocument(sourcePath, pandoc) {
  const source = inspectPortableSource(sourcePath);
  const outputPath = portableOutputPath(sourcePath);
  ensureSafeOutputParent(outputPath);
  const tempDirectory = mkdtempSync(resolve(dirname(outputPath), ".portable-"));
  const candidatePath = resolve(tempDirectory, basename(outputPath));

  try {
    const resourcePath = [dirname(source.source), ROOT].join(delimiter);
    const embedFlag = compareVersions(pandoc.version, "3.0") >= 0 ? "--embed-resources" : "--self-contained";
    const args = [
      "--from=gfm",
      "--to=html5",
      "--standalone",
      embedFlag,
      `--template=${PORTABLE_TEMPLATE}`,
      `--lua-filter=${PORTABLE_LINK_FILTER}`,
      `--resource-path=${resourcePath}`,
      `--variable=pagetitle:${source.title}`,
      `--variable=lang:${source.locale}`,
      `--variable=portable-source:${source.sourceRelative}`,
      `--variable=portable-input-sha256:${source.inputSha256}`,
      `--variable=portable-image-count:${source.images.length}`,
      `--variable=portable-pandoc-version:${pandoc.version}`,
      "--toc",
      "--toc-depth=3",
      "--section-divs",
      "--wrap=none",
      "--strip-comments",
      `--output=${candidatePath}`,
      source.source,
    ];
    const result = spawnSync(pandoc.executable, args, {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      env: {
        ...process.env,
        http_proxy: "",
        https_proxy: "",
        HTTP_PROXY: "",
        HTTPS_PROXY: "",
        ALL_PROXY: "",
      },
    });
    if (result.error) throw new Error(`Pandoc 无法启动：${result.error.message}`);
    if (result.status !== 0) {
      throw new Error(
        `Pandoc 导出 ${source.sourceRelative} 失败（exit ${result.status}）：\n` +
          [result.stdout, result.stderr].filter(Boolean).join("\n")
      );
    }
    if (result.stderr.trim()) {
      throw new Error(`Pandoc 导出 ${source.sourceRelative} 返回警告：\n${result.stderr.trim()}`);
    }

    const checked = checkPortableHtml(source.source, candidatePath);
    if (checked.errors.length > 0) {
      throw new Error(
        `${source.sourceRelative} 的便携产物未通过写盘前检查：\n` +
          checked.errors.map((error) => `- ${error}`).join("\n")
      );
    }
    commitCandidate(candidatePath, outputPath, tempDirectory);
    return {
      ...checked.receipt,
      output: repoRelative(outputPath),
    };
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
}

if (resolve(process.argv[1] ?? "") !== PORTABLE_EXPORTER) {
  throw new Error("便携导出器入口解析失败。");
}

try {
  const sources = findPortableSources(process.argv.slice(2));
  const pandoc = pandocInfo();
  const receipts = sources.map((source) => exportDocument(source, pandoc));
  console.log(`已用 Pandoc ${pandoc.version} 生成 ${receipts.length} 份便携单文件 HTML：`);
  for (const receipt of receipts) {
    console.log(
      `- ${receipt.output} (${receipt.images} image(s), ${receipt.bytes} bytes, ` +
        `input ${receipt.inputSha256})`
    );
  }
} catch (error) {
  console.error(`便携文档导出失败：${error.message}`);
  process.exit(1);
}
