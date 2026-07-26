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
  { key: "PROJECT_NAME", question: "项目/仓库标识名", example: "AxialMuseWebsite", required: true },
  { key: "PROJECT_SLUG", question: "kebab-case 技术标识（用于 package.json name）", derive: (a) => a.PROJECT_NAME.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[\s_]+/g, "-").toLowerCase() },
  { key: "BRAND_NAME", question: "面向用户的品牌/产品展示名（可以和项目标识名不同）", derive: (a) => a.PROJECT_NAME },
  { key: "PROJECT_TAGLINE", question: "一句话项目定位", example: "个人项目与技术分享网站", required: true },
  { key: "GITHUB_OWNER", question: "GitHub 账号", example: "lyty1997", required: true },
  { key: "GITHUB_REPO", question: "GitHub 仓库名", derive: (a) => a.PROJECT_NAME },
  { key: "COPYRIGHT_HOLDER", question: "版权归属者（个人或组织的法定名称，写入 LICENSE）", derive: (a) => a.GITHUB_OWNER },
];

const PREVIEW_PLACEHOLDERS = [
  { key: "PREVIEW_HOST", question: "远端托管机局域网地址", example: "192.168.0.162", required: true },
  { key: "PREVIEW_PORT", question: "预览端口", example: "8088", required: true },
  { key: "REMOTE_USER", question: "远端托管机用户名", required: true },
  { key: "REMOTE_REPO_PATH", question: "远端仓库绝对路径", required: true },
  { key: "SSH_KEY_NAME", question: "免密登录专用密钥文件名", derive: (a) => `id_ed25519_${a.PROJECT_SLUG}_preview` },
];

// 交互式终端下用 readline 逐条问答；stdin 不是 TTY（管道/重定向/自动化）时，
// readline 会在第一条 question() 期间把缓冲区里所有行一次性同步处理完，
// 后面的 question() 调用再也等不到任何"line"事件，直接卡死。
// 这里改成非 TTY 时提前一次性读完整个 stdin、按行分发，规避这个限制。
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
        throw new Error("非交互输入行数不够，请检查提供的回答数量是否和问题数一致。");
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
    const hint = spec.derive ? ` [默认: ${spec.derive(answers)}]` : spec.example ? `（例如 ${spec.example}）` : "";
    const raw = await prompter.prompt(`${spec.question}${hint}: `);
    if (raw) return raw;
    if (spec.derive) return spec.derive(answers);
    if (!spec.required) return "";
    console.log("这一项不能为空，请重新输入。");
  }
}

function replaceAllTokens(text, answers) {
  let result = text;
  for (const [key, value] of Object.entries(answers)) {
    result = result.split(`__${key}__`).join(value);
  }
  return result;
}

// 返回 keys 中仍然出现在仓库文本文件里的占位符键（用于判断哪些还没被替换）。
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

// 重跑时从已初始化的 package.json 里回读 slug，供派生 SSH_KEY_NAME 用，避免要求用户重输基础信息。
function readExistingSlug() {
  try {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
    if (typeof pkg.name === "string" && !/__[A-Z_]+__/.test(pkg.name)) return pkg.name;
  } catch {
    // 读不到就返回空，交给下面按需补问。
  }
  return "";
}

// 选择暂不搭 CI/CD 时，把这件事挂进待决策文档，避免它只停留在一次终端输出里。
// 幂等：已经记过就不重复追加。
const CICD_TODO = "- CI/CD 搭建：脚手架已备好探测与生成能力（`npm run cicd:probe`），尚未选定部署目标与发布方式。";

function recordCicdTodo() {
  const path = resolve(ROOT, "docs/architecture/open-decisions.md");
  if (!existsSync(path)) return;

  const text = readFileSync(path, "utf8");
  if (text.includes("CI/CD 搭建：")) return;

  const heading = "## 工程基建\n\n";
  const at = text.indexOf(heading);
  if (at === -1) {
    console.log("未在 open-decisions.md 找到「工程基建」小节，请自行记录 CI/CD 待办。");
    return;
  }

  const insertAt = at + heading.length;
  writeFileSync(path, `${text.slice(0, insertAt)}${CICD_TODO}\n${text.slice(insertAt)}`, "utf8");
  console.log("已把 CI/CD 待办记入 docs/architecture/open-decisions.md 的「工程基建」小节。");
}

async function main() {
  const prompter = createPrompter();

  const hasRemainingPlaceholders = listFiles(ROOT, isTextFile).some((path) => /__[A-Z_]+__/.test(readFileSync(path, "utf8")));
  if (!hasRemainingPlaceholders) {
    const proceed = await prompter.prompt("没有检测到任何未替换的占位符，这个仓库可能已经初始化过了。仍要继续吗？(y/N): ");
    if (proceed.toLowerCase() !== "y") {
      console.log("已取消。");
      prompter.close();
      return;
    }
  }

  const answers = {};
  // 只在基础占位符还没被替换时才问基础信息；已初始化后重跑（例如补配预览工作流）会跳过这一段，
  // 只回读 slug 供派生用——兑现末尾"重跑只补填预览部分"的承诺。
  const baseRemaining = remainingTokenKeys(PLACEHOLDERS.map((spec) => spec.key));
  if (baseRemaining.length > 0) {
    console.log("== 项目基本信息 ==");
    for (const spec of PLACEHOLDERS) {
      answers[spec.key] = await ask(prompter, spec, answers);
    }
  } else {
    console.log("== 项目基本信息：检测到已初始化，跳过基础问答 ==");
    const slug = readExistingSlug();
    if (slug) answers.PROJECT_SLUG = slug;
  }

  console.log("\n== 跨机协同预览工作流（可选，本地渲染端 + 远端托管端）==");
  const wantsPreview = (await prompter.prompt("是否需要这套工作流？(y/N): ")).toLowerCase() === "y";
  if (wantsPreview) {
    if (!answers.PROJECT_SLUG) {
      answers.PROJECT_SLUG = await ask(
        prompter,
        { key: "PROJECT_SLUG", question: "kebab-case 技术标识（用于命名预览专用 SSH 密钥）", required: true },
        answers
      );
    }
    for (const spec of PREVIEW_PLACEHOLDERS) {
      answers[spec.key] = await ask(prompter, spec, answers);
    }
  }

  console.log("\n== CI/CD（可选，现在决定或以后再说）==");
  console.log("脚手架自带的 CI 只跑内容质量门禁，不含构建、部署、发版、回滚。");
  console.log("CI/CD 由探测器按项目实际形态现场生成，不预置模板，所以现在没有源码也可以先跳过。");
  const wantsCicd = (await prompter.prompt("现在就搭 CI/CD？(y/N): ")).toLowerCase() === "y";

  prompter.close();

  // 版权年份由脚本自动填写，不作为问答项。
  answers.COPYRIGHT_YEAR = String(new Date().getFullYear());

  console.log("\n正在替换占位符...");
  let touched = 0;
  for (const path of listFiles(ROOT, isTextFile)) {
    const original = readFileSync(path, "utf8");
    const updated = replaceAllTokens(original, answers);
    if (updated !== original) {
      writeFileSync(path, updated, "utf8");
      touched += 1;
    }
  }
  console.log(`已更新 ${touched} 个文件。`);

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
    console.log(`已生成 ${relative(ROOT, envPath)}（本地文件，已被 .gitignore 忽略，不会被提交）。`);
  } else {
    console.log(
      "未配置跨机协同预览工作流。用不到的话可以删除 docs/architecture/dev-workflow.md、" +
        "scripts/dev/preview.sh、scripts/dev/restart-remote.ps1、scripts/dev/dev-workflow.env.example；" +
        "以后要用的话重新运行一次 node scripts/init.mjs：基础信息已替换过会自动跳过，只需补填这部分。"
    );
  }

  if (!wantsCicd) {
    recordCicdTodo();
  }

  // 后续步骤用数组自动编号，避免新增条目时手工维护序号出错。
  const nextSteps = ["git config core.hooksPath .githooks   # 启用本地 pre-commit 质量门禁"];
  if (wantsPreview) {
    nextSteps.push(`在 ${answers.PREVIEW_HOST} 上把 SSH 公钥装进 ~/.ssh/authorized_keys，参考 docs/architecture/dev-workflow.md 的"远程重启"一节`);
  }
  nextSteps.push(
    wantsCicd
      ? "npm run cicd:probe   # 看探测结果，再用 setup-cicd skill 走完生成与实测闭环"
      : "以后要搭 CI/CD 时跑 npm run cicd:probe，或直接用 setup-cicd skill（已记入 docs/architecture/open-decisions.md）"
  );

  console.log("\n== 后续步骤 ==");
  for (const [index, step] of nextSteps.entries()) {
    console.log(`${index + 1}. ${step}`);
  }
  console.log("\n运行 npm run quality 做一次自检...");
  try {
    execSync("npm run quality", { cwd: ROOT, stdio: "inherit" });
  } catch {
    console.log("质量门禁未通过，请根据上面的输出修复后再提交。");
  }
}

main();
