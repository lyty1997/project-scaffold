// Persistently verify that the actionlint wrapper does not swallow failures.
// Fixtures live outside .github/workflows so repository discovery cannot treat invalid.yml as a real workflow.

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { projectRoot } from "./lib/files.mjs";
import { runActionlint } from "./check-workflows.mjs";
import { renderAll } from "../cicd/render.mjs";

const fixture = (name) =>
  resolve(projectRoot(), "scripts/quality/fixtures/actionlint", name);

const valid = runActionlint([fixture("valid.yml")], { stdio: "pipe" });
assert.equal(
  valid.status,
  0,
  `The valid fixture should pass actionlint:\n${valid.stderr || valid.stdout || valid.error?.message || ""}`,
);

const invalid = runActionlint([fixture("invalid.yml")], { stdio: "pipe" });
const invalidOutput = `${invalid.stdout ?? ""}${invalid.stderr ?? ""}`;
assert.equal(
  invalid.status,
  1,
  `The invalid fixture should produce a lint finding with exit code 1, received ${invalid.status}:\n${invalidOutput}`,
);
assert.match(invalidOutput, /unexpected key "branch"/);

const releaseAnswers = JSON.parse(
  readFileSync(resolve(projectRoot(), "scripts/cicd/fixtures/release-node.json"), "utf8"),
);
const release = renderAll(releaseAnswers);
assert.deepEqual(release.errors, []);
const deployAnswers = JSON.parse(
  readFileSync(
    resolve(projectRoot(), "scripts/cicd/fixtures/deploy-dry-run.json"),
    "utf8",
  ),
);
const deploy = renderAll(deployAnswers);
assert.deepEqual(deploy.errors, []);

const temporaryDirectory = mkdtempSync(join(tmpdir(), "project-scaffold-actionlint-"));
try {
  const generatedWorkflow = resolve(temporaryDirectory, "release-please.yml");
  writeFileSync(generatedWorkflow, release.files.get("release-please.yml"), "utf8");
  const generated = runActionlint([generatedWorkflow], { stdio: "pipe" });
  assert.equal(
    generated.status,
    0,
    `The generated Release Please workflow must pass actionlint:\n${generated.stderr || generated.stdout || ""}`,
  );

  const generatedDeployWorkflow = resolve(temporaryDirectory, "deploy-dry-run.yml");
  writeFileSync(
    generatedDeployWorkflow,
    deploy.files.get("deploy-dry-run.yml"),
    "utf8",
  );
  const generatedDeploy = runActionlint([generatedDeployWorkflow], {
    stdio: "pipe",
  });
  assert.equal(
    generatedDeploy.status,
    0,
    `The generated Boolean dry_run workflow must pass actionlint:\n${generatedDeploy.stderr || generatedDeploy.stdout || ""}`,
  );
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

console.log("actionlint fixture checks passed.");
