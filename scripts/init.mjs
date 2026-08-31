import { basename, extname, relative, resolve } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { execSync } from "node:child_process";
import { listFiles, projectRoot } from "./quality/lib/files.mjs";

const ROOT = projectRoot();
const SELF = fileURLToPath(import.meta.url);

const TEXT_EXTENSIONS = new Set([".css", ".html", ".js", ".json", ".md", ".mjs", ".txt", ".yaml", ".yml", ".py", ".ps1", ".sh"]);
const EXTENSIONLESS_TEXT_FILES = new Set([".gitignore", ".gitattributes", ".editorconfig", "pre-commit", "CODEOWNERS", "LICENSE"]);

function isTextFile(path) {
  if (path === SELF) return false;
  if (TEXT_EXTENSIONS.has(extname(path))) return true;
  return EXTENSIONLESS_TEXT_FILES.has(basename(path));
}

const PLACEHOLDERS = [
  { key: "PROJECT_NAME", question: "Project/repository identifier", example: "AxialMuseWebsite", required: true },
  { key: "PROJECT_SLUG", question: "kebab-case identifier (used as the package.json name)", derive: (a) => a.PROJECT_NAME.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[\s_]+/g, "-").toLowerCase() },
  { key: "BRAND_NAME", question: "User-facing brand or product name (may differ from the project identifier)", derive: (a) => a.PROJECT_NAME },
  { key: "PROJECT_TAGLINE", question: "One-sentence project positioning", example: "A site for personal projects and technical writing", required: true },
  { key: "GITHUB_OWNER", question: "GitHub account or organization", example: "lyty1997", required: true },
  { key: "GITHUB_REPO", question: "GitHub repository name", derive: (a) => a.PROJECT_NAME },
  { key: "COPYRIGHT_HOLDER", question: "Legal name of the copyright holder (written to LICENSE)", derive: (a) => a.GITHUB_OWNER },
];

const PREVIEW_PLACEHOLDERS = [
  { key: "PREVIEW_HOST", question: "LAN address of the remote preview host", example: "192.168.0.162", required: true },
  { key: "PREVIEW_PORT", question: "Preview port", example: "8088", required: true },
  { key: "REMOTE_USER", question: "Username on the remote preview host", required: true },
  { key: "REMOTE_REPO_PATH", question: "Absolute repository path on the remote host", required: true },
  { key: "SSH_KEY_NAME", question: "Filename for the dedicated passwordless SSH key", derive: (a) => `id_ed25519_${a.PROJECT_SLUG}_preview` },
];

// In an interactive terminal, readline asks each question normally. With piped,
// redirected, or automated stdin, its first question consumes all buffered lines
// synchronously, leaving later questions waiting forever. Read non-TTY input once
// and distribute it line by line to avoid that behavior.
function createPrompter() {
  if (process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return {
      async prompt(text) {
        return (await rl.question(text)).trim();
      },
      close() {
        rl.close();
      },
    };
  }

  const lines = readFileSync(0, "utf8").split(/\r?\n/);
  let cursor = 0;
  return {
    async prompt(text) {
      if (cursor >= lines.length) {
        throw new Error("Not enough non-interactive input lines; provide one answer per question.");
      }
      const line = lines[cursor].trim();
      cursor += 1;
      process.stdout.write(`${text}${line}\n`);
      return line;
    },
    close() {},
  };
}

async function ask(prompter, spec, answers) {
  for (;;) {
    const hint = spec.derive ? ` [default: ${spec.derive(answers)}]` : spec.example ? ` (for example, ${spec.example})` : "";
    const raw = await prompter.prompt(`${spec.question}${hint}: `);
    if (raw) return raw;
    if (spec.derive) return spec.derive(answers);
    if (!spec.required) return "";
    console.log("This value is required. Please try again.");
  }
}

function replaceAllTokens(text, answers) {
  let result = text;
  for (const [key, value] of Object.entries(answers)) {
    result = result.split(`__${key}__`).join(value);
  }
  return result;
}

// Return placeholder keys that still appear in repository text files.
function remainingTokenKeys(keys) {
  const present = new Set();
  for (const path of listFiles(ROOT, isTextFile)) {
    const text = readFileSync(path, "utf8");
    for (const key of keys) {
      if (!present.has(key) && text.includes(`__${key}__`)) present.add(key);
    }
  }
  return keys.filter((key) => present.has(key));
}

// On a rerun, recover the initialized slug for deriving SSH_KEY_NAME without
// asking for all base project information again.
function readExistingSlug() {
  try {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
    if (typeof pkg.name === "string" && !/__[A-Z_]+__/.test(pkg.name)) return pkg.name;
  } catch {
    // Return an empty value and let the caller ask only when it is needed.
  }
  return "";
}

// When CI/CD is deferred, record the decision in both maintained languages. The
// operation is idempotent and validates both documents before writing either one.
const CICD_TODO_DOCUMENTS = [
  {
    relativePath: "docs/architecture/open-decisions.md",
    marker: "CI/CD setup:",
    heading: "## Engineering infrastructure\n\n",
    todo: "- CI/CD setup: the scaffold can already probe and generate configuration (`npm run cicd:probe`), but the deployment target and release approach have not been selected.",
  },
  {
    relativePath: "docs/architecture/open-decisions-zh.md",
    marker: "CI/CD 搭建：", // localization-allow-cjk
    heading: "## 工程基建\n\n", // localization-allow-cjk
    todo: "- CI/CD 搭建：脚手架已备好探测与生成能力（`npm run cicd:probe`），尚未选定部署目标与发布方式。", // localization-allow-cjk
  },
];

function recordCicdTodo() {
  const updates = [];
  for (const spec of CICD_TODO_DOCUMENTS) {
    const path = resolve(ROOT, spec.relativePath);
    if (!existsSync(path)) {
      throw new Error(`Cannot record the CI/CD decision: missing ${spec.relativePath}`);
    }
    const text = readFileSync(path, "utf8");
    if (text.includes(spec.marker)) continue;
    const at = text.indexOf(spec.heading);
    if (at === -1) {
      throw new Error(`Cannot record the CI/CD decision: expected heading not found in ${spec.relativePath}`);
    }
    const insertAt = at + spec.heading.length;
    updates.push({
      path,
      relativePath: spec.relativePath,
      text: `${text.slice(0, insertAt)}${spec.todo}\n${text.slice(insertAt)}`,
    });
  }
  for (const update of updates) {
    writeFileSync(update.path, update.text, "utf8");
    console.log(`Recorded the deferred CI/CD decision in ${update.relativePath}.`);
  }
}

async function main() {
  const prompter = createPrompter();

  const hasRemainingPlaceholders = listFiles(ROOT, isTextFile).some((path) => /__[A-Z_]+__/.test(readFileSync(path, "utf8")));
  if (!hasRemainingPlaceholders) {
    const proceed = await prompter.prompt("No unresolved placeholders were found, so this repository may already be initialized. Continue anyway? (y/N): ");
    if (proceed.toLowerCase() !== "y") {
      console.log("Cancelled.");
      prompter.close();
      return;
    }
  }

  const answers = {};
  // Ask for base information only while its placeholders remain. A rerun, such
  // as adding preview configuration later, skips these questions and recovers
  // only the slug needed for derived values.
  const baseRemaining = remainingTokenKeys(PLACEHOLDERS.map((spec) => spec.key));
  if (baseRemaining.length > 0) {
    console.log("== Project information ==");
    for (const spec of PLACEHOLDERS) {
      answers[spec.key] = await ask(prompter, spec, answers);
    }
  } else {
    console.log("== Project information: already initialized; skipping base questions ==");
    const slug = readExistingSlug();
    if (slug) answers.PROJECT_SLUG = slug;
  }

  console.log("\n== Cross-machine preview workflow (optional: local renderer + remote host) ==");
  const wantsPreview = (await prompter.prompt("Enable this workflow? (y/N): ")).toLowerCase() === "y";
  if (wantsPreview) {
    if (!answers.PROJECT_SLUG) {
      answers.PROJECT_SLUG = await ask(
        prompter,
        { key: "PROJECT_SLUG", question: "kebab-case identifier (used to name the dedicated preview SSH key)", required: true },
        answers
      );
    }
    for (const spec of PREVIEW_PLACEHOLDERS) {
      answers[spec.key] = await ask(prompter, spec, answers);
    }
  }

  console.log("\n== CI/CD (optional now; may be decided later) ==");
  console.log("The scaffold CI runs repository quality gates only; it does not build, deploy, release, or roll back the project.");
  console.log("Project-specific CI/CD is generated from probed facts rather than a preset template, so it can be deferred until source code exists.");
  const wantsCicd = (await prompter.prompt("Set up CI/CD now? (y/N): ")).toLowerCase() === "y";

  prompter.close();

  // Derive the copyright year instead of asking for it.
  answers.COPYRIGHT_YEAR = String(new Date().getFullYear());

  console.log("\nReplacing placeholders...");
  let touched = 0;
  for (const path of listFiles(ROOT, isTextFile)) {
    const original = readFileSync(path, "utf8");
    const updated = replaceAllTokens(original, answers);
    if (updated !== original) {
      writeFileSync(path, updated, "utf8");
      touched += 1;
    }
  }
  console.log(`Updated ${touched} file(s).`);

  if (wantsPreview) {
    const envPath = resolve(ROOT, "scripts/dev/dev-workflow.env");
    const envContent = [
      `PREVIEW_HOST=${answers.PREVIEW_HOST}`,
      `PREVIEW_PORT=${answers.PREVIEW_PORT}`,
      `REMOTE_USER=${answers.REMOTE_USER}`,
      `REMOTE_REPO_PATH=${answers.REMOTE_REPO_PATH}`,
      "PREVIEW_SERVE_DIR=public",
      `SSH_KEY_NAME=${answers.SSH_KEY_NAME}`,
      "",
    ].join("\n");
    writeFileSync(envPath, envContent, "utf8");
    console.log(`Generated ${relative(ROOT, envPath)} (an ignored local file that will not be committed).`);
  } else {
    console.log(
      "The cross-machine preview workflow was not configured. If it is not needed, remove " +
        "docs/architecture/dev-workflow.md, docs/architecture/dev-workflow-zh.md, " +
        "scripts/dev/preview.sh, scripts/dev/restart-remote.ps1, and scripts/dev/dev-workflow.env.example. " +
        "To enable it later, rerun node scripts/init.mjs; initialized base questions will be skipped."
    );
  }

  if (!wantsCicd) {
    recordCicdTodo();
  }

  // Number next steps from the array so adding an item cannot desynchronize labels.
  const nextSteps = ["git config core.hooksPath .githooks   # enable local commit quality gates"];
  if (wantsPreview) {
    nextSteps.push(`Install the SSH public key in ~/.ssh/authorized_keys on ${answers.PREVIEW_HOST}; see "Remote restart" in docs/architecture/dev-workflow.md`);
  }
  nextSteps.push(
    wantsCicd
      ? "npm run cicd:probe   # inspect facts, then use the setup-cicd skill to generate and validate the result"
      : "When ready for CI/CD, run npm run cicd:probe or use the setup-cicd skill (the deferral is recorded in both open-decisions documents)"
  );
  nextSteps.push("After verifying the initialized project, delete SCAFFOLD.md and SCAFFOLD-zh.md.");

  console.log("\n== Next steps ==");
  for (const [index, step] of nextSteps.entries()) {
    console.log(`${index + 1}. ${step}`);
  }
  console.log("\nRunning npm run quality for a self-check...");
  try {
    execSync("npm run quality", { cwd: ROOT, stdio: "inherit" });
  } catch {
    console.log("The quality gate failed. Fix the reported errors before committing.");
  }
}

main();
