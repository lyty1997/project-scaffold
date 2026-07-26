// GitHub Actions 语义检查入口。
//
// actionlint 是外部官方二进制，不进入零依赖的 npm run quality。本文件只负责：
// 1. 从 ACTIONLINT_BIN 或 PATH 定位可执行文件；
// 2. 不经 shell 拼接地启动它；
// 3. 只透传 workflow YAML 路径并原样返回 actionlint 退出码；拒绝可绕过规则的 CLI 选项。

import { existsSync } from "node:fs";
import { extname, isAbsolute, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { projectRoot } from "./lib/files.mjs";

function actionlintExecutable() {
  const configured = process.env.ACTIONLINT_BIN?.trim();

  if (configured && !isAbsolute(configured)) {
    throw new Error("ACTIONLINT_BIN 必须是绝对路径，避免从意外的工作目录加载同名程序。");
  }
  if (configured && !existsSync(configured)) {
    throw new Error(`ACTIONLINT_BIN 指向的文件不存在：${configured}`);
  }
  return configured || "actionlint";
}

export function runActionlint(paths = [], { stdio = "inherit" } = {}) {
  for (const path of paths) {
    if (path.startsWith("-") || ![".yml", ".yaml"].includes(extname(path))) {
      throw new Error(`只接受 workflow YAML 路径，不接受 actionlint 选项：${path}`);
    }
  }

  return spawnSync(actionlintExecutable(), paths, {
    cwd: projectRoot(),
    stdio,
    encoding: stdio === "pipe" ? "utf8" : undefined,
    shell: false,
  });
}

function main() {
  let result;
  try {
    result = runActionlint(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  if (result.error) {
    if (result.error.code === "ENOENT") {
      console.error(
        "未找到 actionlint。请安装官方二进制，或设置 ACTIONLINT_BIN=/absolute/path/actionlint。",
      );
    } else {
      console.error(`无法启动 actionlint：${result.error.message}`);
    }
    process.exit(1);
  }

  if (result.signal) {
    console.error(`actionlint 被信号 ${result.signal} 终止。`);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
