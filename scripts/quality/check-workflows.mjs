// GitHub Actions semantic-check entry point.
//
// actionlint is an external official binary and is not part of zero-dependency
// npm run quality. This wrapper locates it from ACTIONLINT_BIN or PATH, invokes
// it without a shell, accepts only workflow YAML paths, rejects bypassing CLI
// options, and returns the actionlint exit code unchanged.

import { existsSync } from "node:fs";
import { extname, isAbsolute, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { projectRoot } from "./lib/files.mjs";

function actionlintExecutable() {
  const configured = process.env.ACTIONLINT_BIN?.trim();

  if (configured && !isAbsolute(configured)) {
    throw new Error("ACTIONLINT_BIN must be an absolute path so a same-named program cannot be loaded from an unexpected working directory.");
  }
  if (configured && !existsSync(configured)) {
    throw new Error(`ACTIONLINT_BIN points to a missing file: ${configured}`);
  }
  return configured || "actionlint";
}

export function runActionlint(paths = [], { stdio = "inherit" } = {}) {
  for (const path of paths) {
    if (path.startsWith("-") || ![".yml", ".yaml"].includes(extname(path))) {
      throw new Error(`Only workflow YAML paths are accepted; actionlint options are rejected: ${path}`);
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
        "actionlint was not found. Install the official binary or set ACTIONLINT_BIN=/absolute/path/actionlint.",
      );
    } else {
      console.error(`Could not start actionlint: ${result.error.message}`);
    }
    process.exit(1);
  }

  if (result.signal) {
    console.error(`actionlint was terminated by signal ${result.signal}.`);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
