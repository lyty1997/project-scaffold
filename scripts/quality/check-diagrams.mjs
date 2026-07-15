import { relative } from "node:path";
import { compilePlantumlToSvg, findAllPlantumlBlocks } from "./lib/plantuml.mjs";
import { projectRoot } from "./lib/files.mjs";

// 独立于 npm run quality 之外：quality 门禁承诺"零第三方依赖、纯 Node 内置能力"，
// 而本检查依赖外部 Java + plantuml.jar，只作为单独脚本本地跑，CI 里由专属 job 负责装好依赖后执行。
//
// 只校验“能编译”，不比较 SVG 字节。PlantUML 布局受 JVM 字体度量影响，跨机器不能稳定复现。
// 展示用 SVG 由 gen:diagrams 在本地按需刷新，不设置字节一致性门禁。
const ROOT = projectRoot();
const jobs = findAllPlantumlBlocks(ROOT);

if (jobs.length === 0) {
  console.log("未发现任何 ```plantuml 图表，跳过编译校验。");
  process.exit(0);
}

const jar = process.env.PUML_JAR;
if (!jar) {
  console.error(`发现 ${jobs.length} 个 PlantUML 图表，但未设置 PUML_JAR 环境变量。`);
  console.error("请安装 Java 并下载 plantuml.jar，然后 export PUML_JAR=/path/to/plantuml.jar 后重试。");
  process.exit(1);
}

const errors = [];
for (const job of jobs) {
  const relPath = relative(ROOT, job.path).replaceAll("\\", "/");
  const compiled = compilePlantumlToSvg(jar, job.text);
  if (!compiled.ok) {
    errors.push(`${relPath}:${job.line}: PlantUML 编译失败\n${compiled.error}`);
  }
}

if (errors.length > 0) {
  console.error(`Diagram checks failed (${errors.length}/${jobs.length}):`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Diagram checks passed (${jobs.length} plantuml block(s) compiled).`);
