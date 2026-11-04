// Exercise ownership boundaries through real initialization in a disposable copy.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { listFiles, projectRoot } from "../../../scripts/quality/lib/files.mjs";
import { portableOutputPath } from "../../../scripts/quality/lib/portable-docs.mjs";
import { detectSourceExtensions } from "../../../scripts/cicd/probe.mjs";

const ROOT = projectRoot();
// The package identity is authoritative; customized docs may contain example tokens.
if (JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8")).name !== "__PROJECT_SLUG__") {
  console.log("Scaffold layout fixtures skipped: project identity is initialized; normal project quality gates remain applicable.");
  process.exit(0);
}

const fixture = mkdtempSync(resolve(tmpdir(), "scaffold-layout-"));
const resultText = (result) => [result.stdout, result.stderr, result.error?.message].filter(Boolean).join("\n");
function run(script, input = "") {
  return spawnSync(process.execPath, [resolve(fixture, script)], {
    cwd: fixture, input, encoding: "utf8", timeout: 180_000, maxBuffer: 4 * 1024 * 1024,
  });
}
function scaffoldDigest() {
  const hash = createHash("sha256");
  for (const file of [...listFiles(resolve(fixture, "scaffold")), resolve(fixture, "SCAFFOLD.md"), resolve(fixture, "SCAFFOLD-zh.md")].sort()) {
    hash.update(file.slice(fixture.length));
    hash.update(readFileSync(file));
  }
  return hash.digest("hex");
}

try {
  const inventory = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: ROOT, encoding: "utf8", maxBuffer: 4 * 1024 * 1024,
  });
  assert.equal(inventory.status, 0, resultText(inventory));
  for (const name of new Set(inventory.stdout.split("\0").filter(Boolean))) {
    const source = resolve(ROOT, name);
    const target = resolve(fixture, name);
    if (existsSync(source)) {
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(source, target);
    } else if (name.startsWith(".agents/")) {
      // Managed hosts can hide tracked discovery entries; materialize only their indexed bytes.
      const indexed = spawnSync("git", ["show", `:${name}`], { cwd: ROOT });
      assert.equal(indexed.status, 0, `Cannot read indexed discovery entry ${name}`);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, indexed.stdout);
    }
  }

  const probeRoot = resolve(fixture, "scaffold/build/source-probe");
  for (const name of ["public/index.html", "src/app.js", "scaffold/docs/preview.html", "scaffold/scripts/runner.mjs", "scripts/check.mjs", "docs/example.html"]) {
    const target = resolve(probeRoot, name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, "");
  }
  assert.deepEqual(detectSourceExtensions(probeRoot), { ".html": 1, ".js": 1 }, "Scaffold or tooling files contaminated project-source counts");
  rmSync(probeRoot, { recursive: true });

  const manifestPath = resolve(fixture, "scaffold/project-files.json");
  const manifestBytes = readFileSync(manifestPath);
  const initialReadme = readFileSync(resolve(fixture, "README.md"));
  for (const forbidden of ["scaffold/docs/architecture/dev-workflow.md", "ScAfFoLd/docs/architecture/dev-workflow.md", "scaffold./docs/architecture/dev-workflow.md", "SCAFFOLD.md", "../outside.md", "/outside.md", "docs/../README.md"]) {
    const manifest = JSON.parse(manifestBytes);
    manifest.files.push(forbidden);
    writeFileSync(manifestPath, JSON.stringify(manifest));
    const rejected = run("scaffold/scripts/init.mjs");
    assert.notEqual(rejected.status, 0, `Initializer accepted ${forbidden}`);
    assert.match(resultText(rejected), /Invalid project initialization path/);
    assert.deepEqual(readFileSync(resolve(fixture, "README.md")), initialReadme, "Invalid manifest changed a project file");
  }
  writeFileSync(manifestPath, manifestBytes);

  const before = scaffoldDigest();
  const initialized = run("scaffold/scripts/init.mjs", "LayoutFixture\n\n\nDisposable initialization fixture\nexample-owner\n\n\nn\nn\n");
  assert.equal(initialized.status, 0, resultText(initialized));
  assert.match(resultText(initialized), /CI\/CD fixture checks passed/);
  assert.equal(JSON.parse(readFileSync(resolve(fixture, "package.json"))).name, "layout-fixture");
  assert.match(readFileSync(resolve(fixture, "README.md"), "utf8"), /LayoutFixture/);
  assert.match(readFileSync(resolve(fixture, "docs/architecture/open-decisions.md"), "utf8"), /CI\/CD setup:/);
  assert.match(readFileSync(resolve(fixture, "docs/architecture/open-decisions-zh.md"), "utf8"), /CI\/CD/);
  assert.equal(scaffoldDigest(), before, "Initialization modified scaffold reference or maintenance files");
  assert.doesNotMatch(readFileSync(resolve(fixture, "docs/progress.md"), "utf8"), /^## \d{4}-\d{2}-\d{2}/m, "Project inherited scaffold history");

  const preview = run("scaffold/scripts/init.mjs", "y\n127.0.0.1\n8088\nfixture-user\n/tmp/layout-fixture\n\nn\n");
  assert.equal(preview.status, 0, resultText(preview));
  assert.match(readFileSync(resolve(fixture, "scripts/dev/dev-workflow.env"), "utf8"), /SSH_KEY_NAME=id_ed25519_layout-fixture_preview/);
  assert.equal(scaffoldDigest(), before, "Preview initialization modified scaffold references");

  const customized = new Map();
  for (const name of ["README.md", "README-zh.md", "docs/progress.md", "docs/progress-zh.md"]) {
    const path = resolve(fixture, name);
    const bytes = readFileSync(path, "utf8") + "\n## 2026-11-04 / Project customization\n\nProject-specific work; example token: `__PROJECT_NAME__`.\n";
    writeFileSync(path, bytes);
    customized.set(path, bytes);
  }
  const downstream = run("scaffold/scripts/quality/check-layout-fixtures.mjs");
  assert.equal(downstream.status, 0, resultText(downstream));
  assert.match(resultText(downstream), /fixtures skipped: project identity is initialized/);
  assert.equal(scaffoldDigest(), before, "Downstream layout gate modified scaffold files");
  for (const [path, bytes] of customized) {
    assert.equal(readFileSync(path, "utf8"), bytes, "Downstream layout gate rewrote project content");
    writeFileSync(path, bytes.replace("`__PROJECT_NAME__`", "`project-name`"));
  }

  const translation = resolve(fixture, "scaffold/docs/architecture/scaffold-layout-zh.md");
  const translationBytes = readFileSync(translation);
  rmSync(translation);
  for (const checker of ["scripts/quality/check-markdown.mjs", "scripts/quality/check-localization.mjs"]) {
    const rejected = run(checker);
    assert.notEqual(rejected.status, 0, `${checker} accepted a missing scaffold translation`);
    assert.match(resultText(rejected), /scaffold-layout-zh\.md/);
  }
  writeFileSync(translation, translationBytes);

  if (process.platform !== "win32") {
    const linkPath = resolve(fixture, "docs/linked-readme.md");
    symlinkSync(resolve(fixture, "README.md"), linkPath);
    const manifest = JSON.parse(manifestBytes);
    manifest.files.push("docs/linked-readme.md");
    writeFileSync(manifestPath, JSON.stringify(manifest));
    const rejected = run("scaffold/scripts/init.mjs");
    assert.notEqual(rejected.status, 0, "Initializer accepted a symlink");
    assert.match(resultText(rejected), /contains a symlink/);
    rmSync(linkPath);
    writeFileSync(manifestPath, manifestBytes);
  }

  const pkgPath = resolve(fixture, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath));
  pkg.scripts.quality = 'node -e "process.exit(17)"';
  writeFileSync(pkgPath, JSON.stringify(pkg));
  const failed = run("scaffold/scripts/init.mjs", "y\nn\nn\n");
  assert.equal(failed.status, 1, "Initializer hid a failing quality gate");
  assert.match(resultText(failed), /quality gate failed/);

  assert.equal(portableOutputPath(resolve(ROOT, "docs/architecture/overview.md")), resolve(ROOT, "build/portable-docs/architecture/overview.html"));
  assert.equal(portableOutputPath(resolve(ROOT, "scaffold/docs/architecture/scaffold-layout.md")), resolve(ROOT, "scaffold/build/portable-docs/architecture/scaffold-layout.html"));
  assert.throws(() => portableOutputPath(resolve(ROOT, "scaffold/examples/outside.md")), /outside docs/);
  console.log("Scaffold layout fixtures passed: initialization, downstream maintenance skip, source-probe ownership, unchanged references, preview rerun, translations, path isolation, export ownership, and failure propagation.");
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
