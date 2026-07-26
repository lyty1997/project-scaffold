// CI/CD 渲染器的持久化回归夹具。
// 不引入项目测试框架；作为 check:cicd 的一部分验证第二增量的确定性与失败边界。

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

  assert.deepEqual(first.errors, [], `${name} 应可渲染：${first.errors.join("; ")}`);
  assert.deepEqual(first, second, `${name} 重复渲染必须完全一致`);
  assert.ok(first.releasePlease, `${name} 应生成 releasePlease 产物`);
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
  "布尔型 dry_run 必须直接做布尔判断，不能与字符串 'true' 比较",
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
    error.includes("deployStep: 必须是布尔值"),
  ),
  "deployStep 字符串不得绕过默认 dry_run 闸门",
);

const missingDeployStep = structuredClone(deployFixtureAnswers);
delete missingDeployStep.workflows[0].jobs[0].steps[0].deployStep;
assert.ok(
  renderAll(missingDeployStep).errors.some((error) =>
    error.includes("至少要有一个 deployStep: true"),
  ),
  "kind: deploy 必须至少有一个受 dry_run 保护的真实发布步骤",
);

const unclassifiedPublishStep = structuredClone(deployFixtureAnswers);
unclassifiedPublishStep.workflows[0].jobs[0].steps.push({
  name: "Unguarded publish",
  run: "npm publish",
});
const unclassifiedPublish = renderAll(unclassifiedPublishStep);
assert.ok(
  unclassifiedPublish.errors.some((error) =>
    error.includes("每个 step 都必须显式写 true"),
  ),
  "已有受保护步骤不能替未分类的新发布步骤充当 dry_run 哨兵",
);
assert.equal(
  unclassifiedPublish.files
    .get("deploy-dry-run.yml")
    .match(/!inputs\.dry_run/g)?.length,
  2,
  "即使调用方错误忽略校验结果，未分类步骤也要按真实发布做安全默认 guard",
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
  /chore\$\{scope\}: release\$\{component\} \$\{version\} \/ 发布/,
  "Release PR 标题必须保持仓库的中英双语提交结构",
);

assert.deepEqual(
  validateReleasePleaseManifest(nodeFixture.rendered.releasePlease, { ".": "1.2.3" }),
  [],
  "Release PR 更新后的 manifest 版本必须被接受，不能要求等于 bootstrap 版本",
);
assert.ok(
  validateReleasePleaseManifest(nodeFixture.rendered.releasePlease, { ".": "not-semver" }).length > 0,
  "非法 SemVer 必须失败",
);
assert.ok(
  validateReleasePleaseManifest(nodeFixture.rendered.releasePlease, { other: "1.2.3" }).length > 0,
  "manifest 与 config package key 漂移必须失败",
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
  renderAll(duplicateWorkflow).errors.some((error) => error.includes("与另一 workflow 重复")),
  "Release workflow 文件名冲突必须失败",
);

const invalidVersion = structuredClone(nodeFixture.answers);
invalidVersion.releasePlease.initialManifest["."] = "01.2.3";
assert.ok(
  renderAll(invalidVersion).errors.some((error) => error.includes("合法 SemVer")),
  "bootstrap 版本不是 SemVer 时必须失败",
);

const invalidPrereleaseVersion = structuredClone(nodeFixture.answers);
invalidPrereleaseVersion.releasePlease.initialManifest["."] = "1.2.3-01";
assert.ok(
  renderAll(invalidPrereleaseVersion).errors.some((error) =>
    error.includes("合法 SemVer"),
  ),
  "SemVer 数字预发布标识不得带前导零",
);

const missingReleaseType = structuredClone(nodeFixture.answers);
delete missingReleaseType.releasePlease.config["release-type"];
assert.ok(
  renderAll(missingReleaseType).errors.some((error) => error.includes("release-type")),
  "release type 未确认时必须失败，不能由生成器猜",
);

const unknownReleaseType = structuredClone(nodeFixture.answers);
unknownReleaseType.releasePlease.config["release-type"] = "unknown";
assert.ok(
  renderAll(unknownReleaseType).errors.some((error) =>
    error.includes("只支持 node 或 simple"),
  ),
  "未建立版本源映射的 release type 必须失败，不能生成一套表面合法的配置",
);

const missingTagDecision = structuredClone(nodeFixture.answers);
delete missingTagDecision.releasePlease.config["include-v-in-tag"];
assert.ok(
  renderAll(missingTagDecision).errors.some((error) => error.includes("不能猜 tag 规则")),
  "tag 规则未确认时必须失败",
);

const invalidBranch = structuredClone(nodeFixture.answers);
invalidBranch.releasePlease.targetBranch = "main/";
assert.ok(
  renderAll(invalidBranch).errors.some((error) =>
    error.includes("合法的 Git 分支名"),
  ),
  "Git 不接受的分支名必须在生成前失败",
);
const reservedBranch = structuredClone(nodeFixture.answers);
reservedBranch.releasePlease.targetBranch = "HEAD";
assert.ok(
  renderAll(reservedBranch).errors.some((error) =>
    error.includes("合法的 Git 分支名"),
  ),
  "Git 保留名 HEAD 不能作为目标分支",
);

const invalidSkipPullRequest = structuredClone(nodeFixture.answers);
invalidSkipPullRequest.releasePlease.config["skip-github-pull-request"] = false;
assert.ok(
  renderAll(invalidSkipPullRequest).errors.some((error) =>
    error.includes("不是 manifest config 字段"),
  ),
  "Action input 不得混入 manifest config",
);

const invalidSkipRelease = structuredClone(nodeFixture.answers);
invalidSkipRelease.releasePlease.config["skip-github-release"] = "false";
assert.ok(
  renderAll(invalidSkipRelease).errors.some((error) =>
    error.includes("必须是布尔值"),
  ),
  "skip-github-release 不得靠字符串伪装布尔值",
);

const maskedRootReleaseType = structuredClone(nodeFixture.answers);
maskedRootReleaseType.releasePlease.config["release-type"] = 42;
maskedRootReleaseType.releasePlease.config.packages["."]["release-type"] = "node";
assert.ok(
  renderAll(maskedRootReleaseType).errors.some((error) =>
    error.includes("releasePlease.config.release-type 必须是非空字符串"),
  ),
  "package override 不得掩盖根级 release-type 的 schema 类型错误",
);

const maskedRootSkipRelease = structuredClone(nodeFixture.answers);
maskedRootSkipRelease.releasePlease.config["skip-github-release"] = "false";
maskedRootSkipRelease.releasePlease.config.packages["."]["skip-github-release"] =
  false;
assert.ok(
  renderAll(maskedRootSkipRelease).errors.some((error) =>
    error.includes("releasePlease.config.skip-github-release 必须是布尔值"),
  ),
  "package override 不得掩盖根级 skip-github-release 的 schema 类型错误",
);

const maskedRootExtraFiles = structuredClone(nodeFixture.answers);
maskedRootExtraFiles.releasePlease.config["extra-files"] = 42;
maskedRootExtraFiles.releasePlease.config.packages["."]["extra-files"] = [];
assert.ok(
  renderAll(maskedRootExtraFiles).errors.some((error) =>
    error.includes("releasePlease.config.extra-files 必须是数组"),
  ),
  "package override 不得掩盖根级 extra-files 的 schema 类型错误",
);

const maskedInvalidRootExtraItem = structuredClone(nodeFixture.answers);
maskedInvalidRootExtraItem.releasePlease.config["extra-files"] = [42];
maskedInvalidRootExtraItem.releasePlease.config.packages["."]["extra-files"] = [];
assert.ok(
  renderAll(maskedInvalidRootExtraItem).errors.some((error) =>
    error.includes("必须是路径字符串或带 type/path 的对象"),
  ),
  "package override 不得掩盖根级 extra-files 元素的深层 schema 错误",
);

const maskedInvalidRootVersionFile = structuredClone(simpleFixture.answers);
maskedInvalidRootVersionFile.releasePlease.config["version-file"] =
  "../outside";
assert.ok(
  renderAll(maskedInvalidRootVersionFile).errors.some((error) =>
    error.includes("package 目录内的规范化相对文件路径"),
  ),
  "package override 不得掩盖根级 version-file 的越界路径",
);

const unknownConfigField = structuredClone(nodeFixture.answers);
unknownConfigField.releasePlease.config.nonsense = true;
assert.ok(
  renderAll(unknownConfigField).errors.some((error) =>
    error.includes("不能未经校验原样透传"),
  ),
  "官方 schema 不认识的 config 字段必须在本地失败",
);

const packageTagOverride = structuredClone(nodeFixture.answers);
packageTagOverride.releasePlease.config.packages["."]["include-v-in-tag"] =
  "false";
assert.ok(
  renderAll(packageTagOverride).errors.some((error) =>
    error.includes("未支持该 package 字段"),
  ),
  "package 级字段不得绕过全局 tag 布尔约束",
);

const duplicateVersionSource = structuredClone(nodeFixture.answers);
duplicateVersionSource.releasePlease.versionSources["."].push("package.json");
assert.ok(
  renderAll(duplicateVersionSource).errors.some((error) =>
    error.includes("重复登记"),
  ),
  "版本源重复登记必须失败",
);

const secretCredential = structuredClone(nodeFixture.answers);
secretCredential.releasePlease.credential = {
  mode: "secret",
  secretName: "RELEASE_PLEASE_TOKEN",
};
assert.deepEqual(
  renderAll(secretCredential).secretNames,
  ["RELEASE_PLEASE_TOKEN"],
  "自定义 token secret 必须进入来源登记校验链",
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
    /事务写入失败/,
  );
  assert.equal(readFileSync(firstPath, "utf8"), "first-old\n");
  assert.equal(readFileSync(secondPath, "utf8"), "second-old\n");
  assert.deepEqual(
    readdirSync(transactionRoot).sort(),
    ["first.yml", "second.json"],
    "事务失败后不得留下 stage/backup 文件",
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
      "# pull_request_target 只在注释中提及，不应改变语义",
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
    `注释、显式 false 与 block scalar 普通文本不得触发全局 workflow 红线：${safePolicies.error?.message ?? safePolicies.stderr ?? safePolicies.stdout}`,
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
  assert.equal(
    unsafeLiteral.status,
    1,
    "flow-style pull_request_target 与带注释 true 必须被全局红线拦截",
  );
  assert.match(
    `${unsafeLiteral.stdout}${unsafeLiteral.stderr}`,
    /pull_request_target/,
  );
  assert.match(
    `${unsafeLiteral.stdout}${unsafeLiteral.stderr}`,
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
    "跨行 True 与 Unicode 转义 trigger 必须被全局红线拦截",
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
    /secrets 引用/,
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
    "on 区域的 block scalar 不得隐藏 pull_request_target",
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
    "YAML 显式 mapping key 不得隐藏 on trigger",
  );
  assert.match(
    `${unsafeExplicitTrigger.stdout}${unsafeExplicitTrigger.stderr}`,
    /不允许 YAML 显式 mapping key/,
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
    "YAML 显式 tag 不得改写 on key 后隐藏 trigger",
  );
  assert.match(
    `${unsafeTaggedTrigger.stdout}${unsafeTaggedTrigger.stderr}`,
    /不允许 YAML 显式 tag key/,
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
    "on 区域不得通过 YAML alias 引用无法静态审计的 trigger",
  );
  assert.match(
    `${unsafeAliasTrigger.stdout}${unsafeAliasTrigger.stderr}`,
    /不允许 YAML alias/,
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
    "YAML alias 作为顶层 on key 时也必须失败",
  );
  assert.match(
    `${unsafeAliasKey.stdout}${unsafeAliasKey.stderr}`,
    /不允许 YAML alias/,
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

// 真实执行写盘入口，固定 manifest 的生命周期所有权：
// bootstrap 时初始化；已有合法状态必须保留；非法状态必须在任何产物写入前失败。
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
    `bootstrap 写盘应成功：\n${bootstrap.stderr || bootstrap.stdout}`,
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
    `已有 manifest 时重跑应成功：\n${rerun.stderr || rerun.stdout}`,
  );
  assert.deepEqual(
    JSON.parse(readFileSync(manifestPath, "utf8")),
    advancedManifest,
    "重跑生成器不得把 Release PR 已推进的 manifest 重置到 bootstrap 版本",
  );
  assert.equal(
    readFileSync(configPath, "utf8"),
    simpleFixture.rendered.releasePlease.configJson,
    "config 仍应按台账确定性生成",
  );

  const managedWorkflow = readFileSync(workflowPath, "utf8");
  writeFileSync(configPath, "sentinel\n", "utf8");
  const unownedConfig = runRenderer();
  assert.equal(unownedConfig.status, 1, "无法证明归属的 config 必须拒绝覆盖");
  assert.equal(readFileSync(configPath, "utf8"), "sentinel\n");
  assert.equal(
    readFileSync(workflowPath, "utf8"),
    managedWorkflow,
    "config 所有权预检失败时不得先改 workflow",
  );
  writeFileSync(
    configPath,
    simpleFixture.rendered.releasePlease.configJson,
    "utf8",
  );

  writeFileSync(manifestPath, '{".":"not-semver"}\n', "utf8");
  const rejected = runRenderer();
  assert.equal(rejected.status, 1, "非法 manifest 必须使写盘入口失败");
  assert.equal(
    readFileSync(configPath, "utf8"),
    simpleFixture.rendered.releasePlease.configJson,
    "manifest 校验失败时不得先覆盖其他产物",
  );

  writeFileSync(
    manifestPath,
    `${JSON.stringify(advancedManifest, null, 2)}\n`,
    "utf8",
  );
  rmSync(manifestPath);
  const lostManifest = runRenderer();
  assert.equal(lostManifest.status, 1, "运行状态丢失时不得用 bootstrap 值重建 manifest");
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
  assert.equal(stale.status, 1, "台账移除后的 managed workflow 不得静默残留");
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
      assert.equal(linkedManifest.status, 1, "manifest 符号链接必须在写盘前失败");
      assert.equal(
        existsSync(outsideManifest),
        false,
        "dangling symlink 的仓库外目标不得被创建",
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
  assert.equal(collision.status, 1, "同名手写 workflow 必须拒绝覆盖");
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
  renderAll(duplicateJob).errors.some((error) => error.includes("job id `check` 重复")),
  "重复 job id 不能被对象覆盖后静默通过",
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
    error.includes("必须且只能声明 uses 或 run"),
  ),
  "同时声明 uses 与 run 的 step 必须在生成前失败",
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
    error.includes("continue-on-error 只能省略或显式为 false"),
  ),
  "动态 continue-on-error 可能产生假绿，必须在生成前失败",
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
    error.includes("同一 job 内重复"),
  ),
  "重复 step id 必须在生成前失败",
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
  renderAll(nullStep).errors.some((error) => error.includes("step 必须是对象")),
  "空 step 应产生结构化错误，不能让 YAML 序列化器抛 TypeError",
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
  "job-level env 的 secret 也必须进入来源登记",
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
    error.includes("不允许 bracket 写法"),
  ),
  "无法静态登记来源的 bracket secret 写法必须失败",
);

console.log("CI/CD fixture checks passed.");
