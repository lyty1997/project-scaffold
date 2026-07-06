import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";
import { compilePlantumlToSvg, findAllPlantumlBlocks } from "./lib/plantuml.mjs";
import { projectRoot } from "./lib/files.mjs";

// 用法：
//   node scripts/quality/render-diagrams.mjs            # 生成/刷新模式（写文件）
//   node scripts/quality/render-diagrams.mjs --check     # 校验模式（只读，CI 用锁定版本 jar 跑）
//
// 只处理"```plantuml 代码块 紧跟着 ![](path.svg) 图片引用"这种配对——没有配图片引用的代码块
// 视为尚未决定渲染产物落地路径，跳过，交给 check-diagrams.mjs 保证它至少能编译。
const ROOT = projectRoot();
const CHECK_MODE = process.argv.includes("--check");

const jar = process.env.PUML_JAR;
if (!jar) {
  console.error("未设置 PUML_JAR 环境变量。请 export PUML_JAR=/path/to/plantuml.jar 后重试。");
  process.exit(1);
}

const jobs = findAllPlantumlBlocks(ROOT).filter((job) => job.imagePath);

if (jobs.length === 0) {
  console.log("未发现任何带 ![]() 图片引用的 plantuml 图表，无需渲染。");
  process.exit(0);
}

const stale = [];
const written = [];
const errors = [];

for (const job of jobs) {
  const relMd = relative(ROOT, job.path).replaceAll("\\", "/");
  const relImg = relative(ROOT, job.imagePath).replaceAll("\\", "/");
  const compiled = compilePlantumlToSvg(jar, job.text);

  if (!compiled.ok) {
    errors.push(`${relMd}:${job.line}: PlantUML 编译失败\n${compiled.error}`);
    continue;
  }

  const existing = existsSync(job.imagePath) ? readFileSync(job.imagePath, "utf8") : null;
  if (existing === compiled.svg) {
    continue;
  }

  if (CHECK_MODE) {
    stale.push(`${relImg}（源自 ${relMd}:${job.line}）`);
    continue;
  }

  mkdirSync(dirname(job.imagePath), { recursive: true });
  writeFileSync(job.imagePath, compiled.svg, "utf8");
  written.push(relImg);
}

if (errors.length > 0) {
  console.error(`Diagram rendering failed (${errors.length}/${jobs.length}):`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

if (CHECK_MODE) {
  if (stale.length > 0) {
    console.error(`发现 ${stale.length} 个渲染产物与最新 PlantUML 源码不一致（用锁定版本 jar 重新编译后字节不同）：`);
    for (const item of stale) {
      console.error(`- ${item}`);
    }
    console.error("请用同一个 PUML_JAR 版本本地运行 `npm run gen:diagrams` 后提交更新后的 SVG。");
    process.exit(1);
  }
  console.log(`Diagram freshness check passed (${jobs.length} rendered SVG(s) up to date).`);
  process.exit(0);
}

if (written.length > 0) {
  console.log(`已更新 ${written.length} 个渲染产物：`);
  for (const path of written) {
    console.log(`- ${path}`);
  }
} else {
  console.log(`所有 ${jobs.length} 个渲染产物均已是最新，无需更新。`);
}
