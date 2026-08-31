// Persistent regression fixtures for the CI/CD renderer. They run within
// check:cicd without introducing a project test framework and verify deterministic
// output plus failure boundaries for the current increment.

import assert from "node:assert/strict";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { projectRoot } from "./lib/files.mjs";
import {
  renderAll,
  validateReleasePleaseManifest,
  writeTransaction,
} from "../cicd/render.mjs";

const ROOT = projectRoot();
const RELEASE_ACTION_SHA = "45996ed1f6d02564a971a2fa1b5860e934307cf7";

function readFixture(name) {
  return JSON.parse(
    readFileSync(resolve(ROOT, "scripts/cicd/fixtures", name), "utf8"),
  );
}

function renderedFixture(name) {
  const answers = readFixture(name);
  const first = renderAll(answers);
  const second = renderAll(answers);

  assert.deepEqual(first.errors, [], `${name} should render: ${first.errors.join("; ")}`);
  assert.deepEqual(first, second, `${name} must render identically on repeated runs`);
  assert.ok(first.releasePlease, `${name} should produce releasePlease artifacts`);
  assert.equal(first.files.size, 1);

  const workflow = first.files.get("release-please.yml");
  assert.match(workflow, new RegExp(`googleapis/release-please-action@${RELEASE_ACTION_SHA}`));
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /contents: write/);
  assert.match(workflow, /issues: write/);
  assert.match(workflow, /pull-requests: write/);
  assert.doesNotMatch(workflow, /pull_request_target/);

  return { answers, rendered: first, workflow };
}

const nodeFixture = renderedFixture("release-node.json");
const simpleFixture = renderedFixture("release-simple.json");
const deployFixtureAnswers = readFixture("deploy-dry-run.json");
const deployFixture = renderAll(deployFixtureAnswers);
assert.deepEqual(deployFixture.errors, []);
const deployWorkflow = deployFixture.files.get("deploy-dry-run.yml");
assert.match(
  deployWorkflow,
  /github\.event_name != 'pull_request' && \(github\.event_name != 'workflow_dispatch' \|\| !inputs\.dry_run\)/,
  "Boolean dry_run must be tested directly rather than compared with the string 'true'",
);
const shouldDeploy = (eventName, dryRun) =>
  eventName !== "pull_request" &&
  (eventName !== "workflow_dispatch" || !dryRun);
assert.equal(shouldDeploy("workflow_dispatch", true), false);
assert.equal(shouldDeploy("workflow_dispatch", false), true);
assert.equal(shouldDeploy("push", undefined), true);
assert.equal(shouldDeploy("pull_request", false), false);

const stringDeployStep = structuredClone(deployFixtureAnswers);
stringDeployStep.workflows[0].jobs[0].steps[0].deployStep = "true";
assert.ok(
  renderAll(stringDeployStep).errors.some((error) =>
    error.includes("deployStep: must be a boolean"),
  ),
  "A string deployStep must not bypass the default dry_run guard",
);

const missingDeployStep = structuredClone(deployFixtureAnswers);
delete missingDeployStep.workflows[0].jobs[0].steps[0].deployStep;
assert.ok(
  renderAll(missingDeployStep).errors.some((error) =>
    error.includes("requires at least one deployStep: true"),
  ),
  "kind: deploy must contain at least one real publication step protected by dry_run",
);

const unclassifiedPublishStep = structuredClone(deployFixtureAnswers);
unclassifiedPublishStep.workflows[0].jobs[0].steps.push({
  name: "Unguarded publish",
  run: "npm publish",
});
const unclassifiedPublish = renderAll(unclassifiedPublishStep);
assert.ok(
  unclassifiedPublish.errors.some((error) =>
    error.includes("every step in a kind: deploy workflow must explicitly be true"),
  ),
  "An existing protected step must not classify a new publication step by proxy",
);
assert.equal(
  unclassifiedPublish.files
    .get("deploy-dry-run.yml")
    .match(/!inputs\.dry_run/g)?.length,
  2,
  "An unclassified step must receive a safe publication guard even if a caller ignores validation errors",
);

assert.match(nodeFixture.rendered.releasePlease.configJson, /"release-type": "node"/);
assert.match(simpleFixture.rendered.releasePlease.configJson, /"release-type": "simple"/);
assert.match(
  simpleFixture.rendered.releasePlease.configJson,
  /"version-file": "scripts\/cicd\/fixtures\/version\.txt"/,
);
assert.match(nodeFixture.workflow, /managed-config-sha256: [0-9a-f]{64}/);
assert.match(
  nodeFixture.rendered.releasePlease.configJson,
  /chore\$\{scope\}: release\$\{component\} \$\{version\}/,
  "Release PR titles must use the repository's English commit subject structure",
);

assert.deepEqual(
  validateReleasePleaseManifest(nodeFixture.rendered.releasePlease, { ".": "1.2.3" }),
  [],
  "Manifest versions advanced by a Release PR must be accepted rather than forced back to the bootstrap version",
);
assert.ok(
  validateReleasePleaseManifest(nodeFixture.rendered.releasePlease, { ".": "not-semver" }).length > 0,
  "Invalid SemVer must fail",
);
assert.ok(
  validateReleasePleaseManifest(nodeFixture.rendered.releasePlease, { other: "1.2.3" }).length > 0,
  "Drift between manifest and config package keys must fail",
);

const duplicateWorkflow = structuredClone(nodeFixture.answers);
duplicateWorkflow.workflows.push({
  id: "collision",
  file: "release-please.yml",
  kind: "ci",
  displayName: "Collision",
  on: { pullRequest: true },
  jobs: [
    {
      id: "check",
      steps: [{ name: "Sentinel", run: "echo collision" }],
    },
  ],
});
assert.ok(
  renderAll(duplicateWorkflow).errors.some((error) => error.includes("duplicates another workflow")),
  "A conflicting release workflow filename must fail",
);

const invalidVersion = structuredClone(nodeFixture.answers);
invalidVersion.releasePlease.initialManifest["."] = "01.2.3";
assert.ok(
  renderAll(invalidVersion).errors.some((error) => error.includes("valid SemVer")),
  "A bootstrap version that is not SemVer must fail",
);

const invalidPrereleaseVersion = structuredClone(nodeFixture.answers);
invalidPrereleaseVersion.releasePlease.initialManifest["."] = "1.2.3-01";
assert.ok(
  renderAll(invalidPrereleaseVersion).errors.some((error) =>
    error.includes("valid SemVer"),
  ),
  "Numeric SemVer prerelease identifiers must not have leading zeroes",
);

const missingReleaseType = structuredClone(nodeFixture.answers);
delete missingReleaseType.releasePlease.config["release-type"];
assert.ok(
  renderAll(missingReleaseType).errors.some((error) => error.includes("release-type")),
  "An unconfirmed release type must fail instead of being guessed by the generator",
);

const unknownReleaseType = structuredClone(nodeFixture.answers);
unknownReleaseType.releasePlease.config["release-type"] = "unknown";
assert.ok(
  renderAll(unknownReleaseType).errors.some((error) =>
    error.includes("supports only node or simple"),
  ),
  "A release type without a version-source mapping must fail rather than producing superficially valid configuration",
);

const missingTagDecision = structuredClone(nodeFixture.answers);
delete missingTagDecision.releasePlease.config["include-v-in-tag"];
assert.ok(
  renderAll(missingTagDecision).errors.some((error) => error.includes("tag rules cannot be inferred")),
  "Unconfirmed tag rules must fail",
);

const invalidBranch = structuredClone(nodeFixture.answers);
invalidBranch.releasePlease.targetBranch = "main/";
assert.ok(
  renderAll(invalidBranch).errors.some((error) =>
    error.includes("valid Git branch name"),
  ),
  "A branch name rejected by Git must fail before generation",
);
const reservedBranch = structuredClone(nodeFixture.answers);
reservedBranch.releasePlease.targetBranch = "HEAD";
assert.ok(
  renderAll(reservedBranch).errors.some((error) =>
    error.includes("valid Git branch name"),
  ),
  "The reserved Git name HEAD must not be a target branch",
);

const invalidSkipPullRequest = structuredClone(nodeFixture.answers);
invalidSkipPullRequest.releasePlease.config["skip-github-pull-request"] = false;
assert.ok(
  renderAll(invalidSkipPullRequest).errors.some((error) =>
    error.includes("is not a manifest config field"),
  ),
  "An Action input must not be mixed into manifest config",
);

const invalidSkipRelease = structuredClone(nodeFixture.answers);
invalidSkipRelease.releasePlease.config["skip-github-release"] = "false";
assert.ok(
  renderAll(invalidSkipRelease).errors.some((error) =>
    error.includes("must be a boolean"),
  ),
  "skip-github-release must not masquerade as a boolean through a string",
);

const maskedRootReleaseType = structuredClone(nodeFixture.answers);
maskedRootReleaseType.releasePlease.config["release-type"] = 42;
maskedRootReleaseType.releasePlease.config.packages["."]["release-type"] = "node";
assert.ok(
  renderAll(maskedRootReleaseType).errors.some((error) =>
    error.includes("releasePlease.config.release-type must be a non-empty string"),
  ),
  "A package override must not hide a root release-type schema error",
);

const maskedRootSkipRelease = structuredClone(nodeFixture.answers);
maskedRootSkipRelease.releasePlease.config["skip-github-release"] = "false";
maskedRootSkipRelease.releasePlease.config.packages["."]["skip-github-release"] =
  false;
assert.ok(
  renderAll(maskedRootSkipRelease).errors.some((error) =>
    error.includes("releasePlease.config.skip-github-release must be a boolean"),
  ),
  "A package override must not hide a root skip-github-release schema error",
);

const maskedRootExtraFiles = structuredClone(nodeFixture.answers);
maskedRootExtraFiles.releasePlease.config["extra-files"] = 42;
maskedRootExtraFiles.releasePlease.config.packages["."]["extra-files"] = [];
assert.ok(
  renderAll(maskedRootExtraFiles).errors.some((error) =>
    error.includes("releasePlease.config.extra-files must be an array"),
  ),
  "A package override must not hide a root extra-files schema error",
);

const maskedInvalidRootExtraItem = structuredClone(nodeFixture.answers);
maskedInvalidRootExtraItem.releasePlease.config["extra-files"] = [42];
maskedInvalidRootExtraItem.releasePlease.config.packages["."]["extra-files"] = [];
assert.ok(
  renderAll(maskedInvalidRootExtraItem).errors.some((error) =>
    error.includes("must be a path string or an object with type/path"),
  ),
  "A package override must not hide a nested root extra-files schema error",
);

const maskedInvalidRootVersionFile = structuredClone(simpleFixture.answers);
maskedInvalidRootVersionFile.releasePlease.config["version-file"] =
  "../outside";
assert.ok(
  renderAll(maskedInvalidRootVersionFile).errors.some((error) =>
    error.includes("normalized relative file path within the package directory"),
  ),
  "A package override must not hide an out-of-bounds root version-file path",
);

const unknownConfigField = structuredClone(nodeFixture.answers);
unknownConfigField.releasePlease.config.nonsense = true;
assert.ok(
  renderAll(unknownConfigField).errors.some((error) =>
    error.includes("cannot pass through without validation"),
  ),
  "A config field unknown to the official schema must fail locally",
);

const packageTagOverride = structuredClone(nodeFixture.answers);
packageTagOverride.releasePlease.config.packages["."]["include-v-in-tag"] =
  "false";
assert.ok(
  renderAll(packageTagOverride).errors.some((error) =>
    error.includes("package field is unsupported"),
  ),
  "A package-level field must not bypass global tag boolean constraints",
);

const duplicateVersionSource = structuredClone(nodeFixture.answers);
duplicateVersionSource.releasePlease.versionSources["."].push("package.json");
assert.ok(
  renderAll(duplicateVersionSource).errors.some((error) =>
    error.includes("registered more than once"),
  ),
  "Duplicate version-source registration must fail",
);

const secretCredential = structuredClone(nodeFixture.answers);
secretCredential.releasePlease.credential = {
  mode: "secret",
  secretName: "RELEASE_PLEASE_TOKEN",
};
assert.deepEqual(
  renderAll(secretCredential).secretNames,
  ["RELEASE_PLEASE_TOKEN"],
  "A custom token secret must enter provenance validation",
);

const transactionRoot = mkdtempSync(
  join(tmpdir(), "project-scaffold-cicd-transaction-"),
);
try {
  const firstPath = resolve(transactionRoot, "first.yml");
  const secondPath = resolve(transactionRoot, "second.json");
  writeFileSync(firstPath, "first-old\n", "utf8");
  writeFileSync(secondPath, "second-old\n", "utf8");
  let renameCount = 0;
  assert.throws(
    () =>
      writeTransaction(
        [
          {
            path: firstPath,
            shown: "first.yml",
            content: "first-new\n",
            snapshot: { exists: true, content: "first-old\n" },
          },
          {
            path: secondPath,
            shown: "second.json",
            content: "second-new\n",
            snapshot: { exists: true, content: "second-old\n" },
          },
        ],
        {
          rename(from, to) {
            renameCount += 1;
            if (renameCount === 4) {
              throw new Error("injected rename failure");
            }
            renameSync(from, to);
          },
        },
      ),
    /Transactional artifact write failed/,
  );
  assert.equal(readFileSync(firstPath, "utf8"), "first-old\n");
  assert.equal(readFileSync(secondPath, "utf8"), "second-old\n");
  assert.deepEqual(
    readdirSync(transactionRoot).sort(),
    ["first.yml", "second.json"],
    "A failed transaction must not leave stage or backup files",
  );
} finally {
  rmSync(transactionRoot, { recursive: true, force: true });
}

const safetyRoot = mkdtempSync(join(tmpdir(), "project-scaffold-cicd-safety-"));
try {
  for (const directory of ["scripts/cicd", "scripts/quality/lib", ".github/workflows"]) {
    mkdirSync(resolve(safetyRoot, directory), { recursive: true });
  }
  copyFileSync(
    resolve(ROOT, "scripts/cicd/render.mjs"),
    resolve(safetyRoot, "scripts/cicd/render.mjs"),
  );
  copyFileSync(
    resolve(ROOT, "scripts/quality/check-cicd.mjs"),
    resolve(safetyRoot, "scripts/quality/check-cicd.mjs"),
  );
  copyFileSync(
    resolve(ROOT, "scripts/quality/lib/files.mjs"),
    resolve(safetyRoot, "scripts/quality/lib/files.mjs"),
  );
  const safetyChecker = resolve(safetyRoot, "scripts/quality/check-cicd.mjs");
  const runSafetyCheck = () =>
    spawnSync(process.execPath, [safetyChecker], {
      cwd: safetyRoot,
      encoding: "utf8",
    });
  const workflowPath = resolve(safetyRoot, ".github/workflows/check.yml");
  writeFileSync(
    workflowPath,
    [
      "name: Safe",
      "# Mentioning pull_request_target in a comment must not change semantics",
      "on: [push]",
      "jobs:",
      "  check:",
      "    runs-on: ubuntu-latest",
      "    continue-on-error: false",
      "    steps:",
      "      - run: |",
      "          echo 'continue-on-error: true'",
      "          echo pull_request_target",
      "        shell: bash",
      "",
    ].join("\n"),
    "utf8",
  );
  const safePolicies = runSafetyCheck();
  assert.equal(
    safePolicies.status,
    0,
    `Comments, explicit false values, and ordinary block-scalar text must not trigger global workflow boundaries: ${safePolicies.error?.message ?? safePolicies.stderr ?? safePolicies.stdout}`,
  );

  writeFileSync(
    workflowPath,
    [
      "name: Unsafe literal policies",
      "on: [pull_request_target]",
      "jobs:",
      "  check:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - run: echo unsafe",
      "        shell: bash",
      "        continue-on-error: true # comment",
      "",
    ].join("\n"),
    "utf8",
  );
  const unsafeLiteral = runSafetyCheck();
  const unsafeLiteralOutput = [
    unsafeLiteral.stdout,
    unsafeLiteral.stderr,
    unsafeLiteral.error?.message,
  ].filter(Boolean).join("\n");
  assert.equal(
    unsafeLiteral.status,
    1,
    "Flow-style pull_request_target and commented true values must be blocked by global policy",
  );
  assert.match(
    unsafeLiteralOutput,
    /pull_request_target/,
  );
  assert.match(
    unsafeLiteralOutput,
    /continue-on-error/,
  );

  const escapedLooseSecretLine = [
    '      ENCODED: "',
    "$",
    "{{",
    "secrets",
    "\\u002e",
    'ESCAPED_TOKEN }}"',
  ].join("");
  writeFileSync(
    workflowPath,
    [
      "name: Unsafe encoded policies",
      '"on":',
      '  "pull_request\\u005ftarget": {}',
      "jobs:",
      "  check:",
      "    runs-on: ubuntu-latest",
      "    env:",
      escapedLooseSecretLine,
      "    continue-on-error:",
      "      True",
      "    steps:",
      "      - run: echo unsafe",
      "        shell: bash",
      "",
    ].join("\n"),
    "utf8",
  );
  const unsafeEncoded = runSafetyCheck();
  assert.equal(
    unsafeEncoded.status,
    1,
    "Multiline True and Unicode-escaped triggers must be blocked by global policy",
  );
  assert.match(
    `${unsafeEncoded.stdout}${unsafeEncoded.stderr}`,
    /pull_request_target/,
  );
  assert.match(
    `${unsafeEncoded.stdout}${unsafeEncoded.stderr}`,
    /continue-on-error/,
  );
  assert.match(
    `${unsafeEncoded.stdout}${unsafeEncoded.stderr}`,
    /secret references/,
  );

  writeFileSync(
    workflowPath,
    [
      "name: Unsafe block trigger",
      "on:",
      "  - >-",
      "    pull_request_target",
      "jobs:",
      "  check:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - run: echo unsafe",
      "        shell: bash",
      "",
    ].join("\n"),
    "utf8",
  );
  const unsafeBlockTrigger = runSafetyCheck();
  assert.equal(
    unsafeBlockTrigger.status,
    1,
    "A block scalar in the on section must not hide pull_request_target",
  );
  assert.match(
    `${unsafeBlockTrigger.stdout}${unsafeBlockTrigger.stderr}`,
    /pull_request_target/,
  );

  writeFileSync(
    workflowPath,
    [
      "name: Unsafe explicit trigger key",
      "? on",
      ":",
      "  - >-",
      "    pull_request_target",
      "jobs:",
      "  check:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - run: echo unsafe",
      "        shell: bash",
      "",
    ].join("\n"),
    "utf8",
  );
  const unsafeExplicitTrigger = runSafetyCheck();
  assert.equal(
    unsafeExplicitTrigger.status,
    1,
    "An explicit YAML mapping key must not hide an on trigger",
  );
  assert.match(
    `${unsafeExplicitTrigger.stdout}${unsafeExplicitTrigger.stderr}`,
    /explicit YAML mapping keys are not allowed/,
  );

  writeFileSync(
    workflowPath,
    [
      "name: Unsafe tagged trigger key",
      "!!str on:",
      "  - >-",
      "    pull_request_target",
      "jobs:",
      "  check:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - run: echo unsafe",
      "        shell: bash",
      "",
    ].join("\n"),
    "utf8",
  );
  const unsafeTaggedTrigger = runSafetyCheck();
  assert.equal(
    unsafeTaggedTrigger.status,
    1,
    "An explicit YAML tag must not rewrite the on key and hide a trigger",
  );
  assert.match(
    `${unsafeTaggedTrigger.stdout}${unsafeTaggedTrigger.stderr}`,
    /explicit YAML tag keys are not allowed/,
  );

  writeFileSync(
    workflowPath,
    [
      "name: &dangerous-event >-",
      "  pull_request_target",
      "on: *dangerous-event",
      "jobs:",
      "  check:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - run: echo unsafe",
      "        shell: bash",
      "",
    ].join("\n"),
    "utf8",
  );
  const unsafeAliasTrigger = runSafetyCheck();
  assert.equal(
    unsafeAliasTrigger.status,
    1,
    "The on section must not reference a trigger through an unauditable YAML alias",
  );
  assert.match(
    `${unsafeAliasTrigger.stdout}${unsafeAliasTrigger.stderr}`,
    /YAML aliases and anchors are not allowed/,
  );

  writeFileSync(
    workflowPath,
    [
      "name: &trigger-key on",
      "*trigger-key:",
      "  - >-",
      "    pull_request_target",
      "jobs:",
      "  check:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - run: echo unsafe",
      "        shell: bash",
      "",
    ].join("\n"),
    "utf8",
  );
  const unsafeAliasKey = runSafetyCheck();
  assert.equal(
    unsafeAliasKey.status,
    1,
    "A YAML alias used as the top-level on key must also fail",
  );
  assert.match(
    `${unsafeAliasKey.stdout}${unsafeAliasKey.stderr}`,
    /YAML aliases and anchors are not allowed/,
  );

  if (process.platform !== "win32") {
    rmSync(workflowPath);
    const outsideRoot = mkdtempSync(
      join(tmpdir(), "project-scaffold-workflow-outside-"),
    );
    try {
      const outsideWorkflow = resolve(outsideRoot, "outside.yml");
      writeFileSync(outsideWorkflow, "name: Outside\n", "utf8");
      symlinkSync(outsideWorkflow, workflowPath);
      const linked = runSafetyCheck();
      assert.equal(linked.status, 1);
    } finally {
      rmSync(outsideRoot, { recursive: true, force: true });
    }
  }
} finally {
  rmSync(safetyRoot, { recursive: true, force: true });
}

// Exercise the real write entry point and manifest lifecycle ownership: initialize
// at bootstrap, preserve valid existing state, and reject invalid state before writing any artifact.
const lifecycleRoot = mkdtempSync(join(tmpdir(), "project-scaffold-release-lifecycle-"));
try {
  for (const directory of [
    "docs/contracts",
    "scripts/cicd/fixtures",
    "scripts/quality/lib",
  ]) {
    mkdirSync(resolve(lifecycleRoot, directory), { recursive: true });
  }
  copyFileSync(
    resolve(ROOT, "scripts/cicd/render.mjs"),
    resolve(lifecycleRoot, "scripts/cicd/render.mjs"),
  );
  copyFileSync(
    resolve(ROOT, "scripts/quality/lib/files.mjs"),
    resolve(lifecycleRoot, "scripts/quality/lib/files.mjs"),
  );
  copyFileSync(
    resolve(ROOT, "scripts/cicd/fixtures/version.txt"),
    resolve(lifecycleRoot, "scripts/cicd/fixtures/version.txt"),
  );
  writeFileSync(
    resolve(lifecycleRoot, "docs/contracts/cicd-answers.json"),
    `${JSON.stringify(simpleFixture.answers, null, 2)}\n`,
    "utf8",
  );

  const renderer = resolve(lifecycleRoot, "scripts/cicd/render.mjs");
  const runRenderer = () =>
    spawnSync(process.execPath, [renderer], {
      cwd: lifecycleRoot,
      encoding: "utf8",
    });
  const manifestPath = resolve(lifecycleRoot, ".release-please-manifest.json");
  const configPath = resolve(lifecycleRoot, "release-please-config.json");
  const workflowPath = resolve(
    lifecycleRoot,
    ".github/workflows/release-please.yml",
  );

  const bootstrap = runRenderer();
  assert.equal(
    bootstrap.status,
    0,
    `Bootstrap writes should succeed:\n${bootstrap.stderr || bootstrap.stdout}`,
  );
  assert.deepEqual(JSON.parse(readFileSync(manifestPath, "utf8")), { ".": "0.1.0" });

  const advancedManifest = { ".": "1.2.3" };
  writeFileSync(manifestPath, `${JSON.stringify(advancedManifest, null, 2)}\n`, "utf8");
  writeFileSync(
    resolve(lifecycleRoot, "scripts/cicd/fixtures/version.txt"),
    "1.2.3\n",
    "utf8",
  );
  const rerun = runRenderer();
  assert.equal(
    rerun.status,
    0,
    `A rerun with an existing manifest should succeed:\n${rerun.stderr || rerun.stdout}`,
  );
  assert.deepEqual(
    JSON.parse(readFileSync(manifestPath, "utf8")),
    advancedManifest,
    "Rerunning the generator must not reset a manifest advanced by a Release PR to its bootstrap version",
  );
  assert.equal(
    readFileSync(configPath, "utf8"),
    simpleFixture.rendered.releasePlease.configJson,
    "Config must remain a deterministic rendering of the ledger",
  );

  const managedWorkflow = readFileSync(workflowPath, "utf8");
  writeFileSync(configPath, "sentinel\n", "utf8");
  const unownedConfig = runRenderer();
  assert.equal(unownedConfig.status, 1, "A config with unproven ownership must not be overwritten");
  assert.equal(readFileSync(configPath, "utf8"), "sentinel\n");
  assert.equal(
    readFileSync(workflowPath, "utf8"),
    managedWorkflow,
    "A config ownership preflight failure must occur before workflow modification",
  );
  writeFileSync(
    configPath,
    simpleFixture.rendered.releasePlease.configJson,
    "utf8",
  );

  writeFileSync(manifestPath, '{".":"not-semver"}\n', "utf8");
  const rejected = runRenderer();
  assert.equal(rejected.status, 1, "An invalid manifest must fail the write entry point");
  assert.equal(
    readFileSync(configPath, "utf8"),
    simpleFixture.rendered.releasePlease.configJson,
    "Manifest validation must fail before other artifacts are overwritten",
  );

  writeFileSync(
    manifestPath,
    `${JSON.stringify(advancedManifest, null, 2)}\n`,
    "utf8",
  );
  rmSync(manifestPath);
  const lostManifest = runRenderer();
  assert.equal(lostManifest.status, 1, "Lost runtime state must not be rebuilt from bootstrap values");
  assert.equal(existsSync(manifestPath), false);
  writeFileSync(
    manifestPath,
    `${JSON.stringify(advancedManifest, null, 2)}\n`,
    "utf8",
  );

  const staleWorkflowPath = resolve(
    lifecycleRoot,
    ".github/workflows/stale-release.yml",
  );
  writeFileSync(staleWorkflowPath, managedWorkflow, "utf8");
  const stale = runRenderer();
  assert.equal(stale.status, 1, "A managed workflow removed from the ledger must not remain silently");
  assert.equal(readFileSync(workflowPath, "utf8"), managedWorkflow);
  rmSync(staleWorkflowPath);

  if (process.platform !== "win32") {
    const outsideRoot = mkdtempSync(
      join(tmpdir(), "project-scaffold-manifest-outside-"),
    );
    try {
      const outsideManifest = resolve(outsideRoot, "escaped.json");
      rmSync(manifestPath);
      symlinkSync(outsideManifest, manifestPath);
      const linkedManifest = runRenderer();
      assert.equal(linkedManifest.status, 1, "A manifest symbolic link must fail before writes begin");
      assert.equal(
        existsSync(outsideManifest),
        false,
        "The external target of a dangling symbolic link must not be created",
      );
      rmSync(manifestPath);
      writeFileSync(
        manifestPath,
        `${JSON.stringify(advancedManifest, null, 2)}\n`,
        "utf8",
      );
    } finally {
      rmSync(outsideRoot, { recursive: true, force: true });
    }
  }

  const manualWorkflow = "name: Manual workflow\n";
  writeFileSync(workflowPath, manualWorkflow, "utf8");
  const collision = runRenderer();
  assert.equal(collision.status, 1, "A hand-written workflow with the same name must not be overwritten");
  assert.equal(readFileSync(workflowPath, "utf8"), manualWorkflow);
} finally {
  rmSync(lifecycleRoot, { recursive: true, force: true });
}

const duplicateJob = {
  workflows: [
    {
      id: "duplicate-job",
      file: "duplicate-job.yml",
      kind: "ci",
      on: { pullRequest: true },
      jobs: [
        { id: "check", steps: [{ run: "echo first" }] },
        { id: "check", steps: [{ run: "echo second" }] },
      ],
    },
  ],
};
assert.ok(
  renderAll(duplicateJob).errors.some((error) => error.includes("job id `check` is duplicated")),
  "A duplicate job id must not be hidden by object-key replacement",
);

const ambiguousStep = {
  workflows: [
    {
      id: "ambiguous-step",
      file: "ambiguous-step.yml",
      kind: "ci",
      on: { pullRequest: true },
      jobs: [
        {
          id: "check",
          steps: [
            {
              uses: "actions/checkout@v5",
              run: "echo invalid",
            },
          ],
        },
      ],
    },
  ],
};
assert.ok(
  renderAll(ambiguousStep).errors.some((error) =>
    error.includes("exactly one of uses or run must be declared"),
  ),
  "A step declaring both uses and run must fail before generation",
);

const dynamicContinueOnError = structuredClone(ambiguousStep);
dynamicContinueOnError.workflows[0].jobs[0].steps = [
  {
    run: "echo unsafe",
    "continue-on-error": "${{ github.event_name == 'push' }}",
  },
];
assert.ok(
  renderAll(dynamicContinueOnError).errors.some((error) =>
    error.includes("continue-on-error must be omitted or explicitly false"),
  ),
  "Dynamic continue-on-error can create false-green results and must fail before generation",
);

const duplicateStepId = {
  workflows: [
    {
      id: "duplicate-step",
      file: "duplicate-step.yml",
      kind: "ci",
      on: { pullRequest: true },
      jobs: [
        {
          id: "check",
          steps: [
            { id: "sentinel", run: "echo first" },
            { id: "sentinel", run: "echo second" },
          ],
        },
      ],
    },
  ],
};
assert.ok(
  renderAll(duplicateStepId).errors.some((error) =>
    error.includes("duplicated within the same job"),
  ),
  "A duplicate step id must fail before generation",
);

const nullStep = {
  workflows: [
    {
      id: "null-step",
      file: "null-step.yml",
      kind: "ci",
      on: { pullRequest: true },
      jobs: [{ id: "check", steps: [null] }],
    },
  ],
};
assert.ok(
  renderAll(nullStep).errors.some((error) => error.includes("step must be an object")),
  "A null step must produce a structured error rather than a YAML serializer TypeError",
);

const jobSecret = {
  workflows: [
    {
      id: "job-secret",
      file: "job-secret.yml",
      kind: "ci",
      on: { pullRequest: true },
      jobs: [
        {
          id: "check",
          env: {
            VALUE: ["$", "{{ format('{0}', ", "secrets.", "JOB_TOKEN) }}"].join(
              "",
            ),
          },
          steps: [{ run: ["echo ", "secrets.", "NOT_A_REFERENCE"].join("") }],
        },
      ],
    },
  ],
};
assert.deepEqual(
  renderAll(jobSecret).secretNames,
  ["JOB_TOKEN"],
  "A secret in job-level env must also enter provenance registration",
);
const bracketReferenceCase = structuredClone(jobSecret);
bracketReferenceCase.workflows[0].jobs[0].env.VALUE = [
  "$",
  "{{ ",
  "secrets",
  "['BRACKET_TOKEN'] }}",
].join("");
assert.ok(
  renderAll(bracketReferenceCase).errors.some((error) =>
    error.includes("bracket notation is not allowed"),
  ),
  "Bracket secret notation with no statically auditable provenance must fail",
);

console.log("CI/CD fixture checks passed.");
