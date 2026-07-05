import { basename, extname, relative, resolve } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { execSync } from "node:child_process";
import { listFiles, projectRoot } from "./quality/lib/files.mjs";

const ROOT = projectRoot();
const SELF = fileURLToPath(import.meta.url);

const TEXT_EXTENSIONS = new Set([".css", ".html", ".js", ".json", ".md", ".mjs", ".txt", ".yaml", ".yml", ".py", ".ps1", ".sh"]);
const EXTENSIONLESS_TEXT_FILES = new Set([".gitignore", ".editorconfig", "pre-commit", "CODEOWNERS"]);

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

  console.log("== 项目基本信息 ==");
  const answers = {};
  for (const spec of PLACEHOLDERS) {
    answers[spec.key] = await ask(prompter, spec, answers);
  }

  console.log("\n== 跨机协同预览工作流（可选，本地渲染端 + 远端托管端）==");
  const wantsPreview = (await prompter.prompt("是否需要这套工作流？(y/N): ")).toLowerCase() === "y";
  if (wantsPreview) {
    for (const spec of PREVIEW_PLACEHOLDERS) {
      answers[spec.key] = await ask(prompter, spec, answers);
    }
  }

  prompter.close();

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
        "以后要用的话重新运行一次 node scripts/init.mjs 即可只补填这部分。"
    );
  }

  console.log("\n== 后续步骤 ==");
  console.log("1. git config core.hooksPath .githooks   # 启用本地 pre-commit 质量门禁");
  if (wantsPreview) {
    console.log(`2. 在 ${answers.PREVIEW_HOST} 上把 SSH 公钥装进 ~/.ssh/authorized_keys，参考 docs/architecture/dev-workflow.md 的"远程重启"一节`);
  }
  console.log("\n运行 npm run quality 做一次自检...");
  try {
    execSync("npm run quality", { cwd: ROOT, stdio: "inherit" });
  } catch {
    console.log("质量门禁未通过，请根据上面的输出修复后再提交。");
  }
}

main();
