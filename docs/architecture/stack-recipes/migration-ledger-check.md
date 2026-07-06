# 迁移一致性门禁参考脚本

可选。仅当你的项目同时满足以下两个条件才需要：

1. 引入了数据库迁移工具（Alembic / Django migrations / Drizzle 等），迁移文件按编号/时间戳命名。
2. 用某份设计文档维护一份"迁移顺序台账"（人工登记每个迁移做了什么、顺序是什么）。

这种情况下容易出现"文档记录的编号"和"实际迁移文件"漂移——台账里某个编号写错、或者新迁移忘记登记，靠人工审计很难发现。这份参考脚本把**实际迁移文件名当作唯一真相源**，机器扫描台账文档是否同步收录了每一个真实存在的迁移编号。

**这不是** `scripts/quality/check-contracts.mjs` 的一部分，也不建议直接塞进去——`check-contracts.mjs` 管的是契约词表（品牌名、枚举、禁用旧名），迁移一致性是完全不同的检查对象，混在一起只会让两者都变难改。落地时复制成独立脚本，按需接入你自己的 `npm run quality` 链路。

## 参考实现

```js
#!/usr/bin/env node
// scripts/quality/check-migration-ledger.mjs
// 用法：node scripts/quality/check-migration-ledger.mjs
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// 按你的项目实际情况调整这三项。
const MIGRATIONS_DIR = resolve(process.cwd(), "backend/migrations/versions");
const ID_PATTERN = /^(\d{4})_([a-z0-9_]+)\.py$/; // 匹配形如 0071_add_orders_table.py
const LEDGER_DOC = resolve(process.cwd(), "docs/architecture/migration-ledger.md");

function listMigrationIds(dir, pattern) {
  return readdirSync(dir)
    .map((name) => name.match(pattern))
    .filter(Boolean)
    .map((match) => match[1]);
}

const ids = listMigrationIds(MIGRATIONS_DIR, ID_PATTERN);
const ledgerText = readFileSync(LEDGER_DOC, "utf8");

const missing = ids.filter((id) => !new RegExp(`\\b${id}\\b`).test(ledgerText));

if (missing.length > 0) {
  console.error("迁移一致性检查失败，以下迁移编号未出现在台账文档里：");
  for (const id of missing) {
    console.error(`- ${id}（${LEDGER_DOC}）`);
  }
  process.exit(1);
}

console.log(`迁移一致性检查通过，共校验 ${ids.length} 个迁移编号。`);
```

已用 fixture 验证过两种路径：台账缺一条迁移记录时退出码 1 并报出具体缺失编号；台账补全后退出码 0。

## 已知局限（按需自行扩展）

- 只校验"编号是否出现"，不校验台账里记录的**顺序**是否和文件系统一致；如果你的团队更在意顺序漂移，需要额外解析台账里的顺序结构再比较。
- 只做单向校验（文件系统 → 文档），没有反向校验"文档里是否存在文件系统里已不存在的迁移编号"（例如迁移被误删）；如果需要，加一次反向 diff 即可。
- `ID_PATTERN`、`MIGRATIONS_DIR`、`LEDGER_DOC` 都硬编码在脚本顶部，落地时按你项目实际路径改，不要保留脚手架里的占位路径。
