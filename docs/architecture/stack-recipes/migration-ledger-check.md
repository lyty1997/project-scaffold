# Migration Ledger Consistency Check Reference Script

English | [Chinese](migration-ledger-check-zh.md)

Optional. Use this only when your project meets both of the following conditions:

1. It uses a database migration tool such as Alembic, Django migrations, or Drizzle, and migration filenames begin with a sequence number or timestamp.
2. A design document maintains a migration-order ledger that manually records what each migration does and where it belongs in the sequence.

In that situation, the sequence numbers recorded in the document can easily drift away from the actual migration files: the ledger may contain an incorrect number, or a new migration may never be recorded. Manual review rarely catches this reliably. This reference script treats **actual migration filenames as the sole source of truth** and checks mechanically that the ledger includes every migration identifier that exists.

This check is **not** part of `scripts/quality/check-contracts.mjs`, and it should not simply be inserted there. `check-contracts.mjs` manages contract terms such as brand names, enums, and forbidden legacy names. Migration consistency is an entirely different concern; combining them makes both checks harder to change. When adopting this recipe, copy it into a separate script and connect it to your own `npm run quality` chain as needed.

## Reference implementation

```js
#!/usr/bin/env node
// scripts/quality/check-migration-ledger.mjs
// Usage: node scripts/quality/check-migration-ledger.mjs
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Adapt these three values to the actual project.
const MIGRATIONS_DIR = resolve(process.cwd(), "backend/migrations/versions");
const ID_PATTERN = /^(\d{4})_([a-z0-9_]+)\.py$/; // Matches names such as 0071_add_orders_table.py.
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
  console.error("Migration consistency check failed. These migration IDs are missing from the ledger:");
  for (const id of missing) {
    console.error(`- ${id} (${LEDGER_DOC})`);
  }
  process.exit(1);
}

console.log(`Migration consistency check passed for ${ids.length} migration IDs.`);
```

Fixtures have verified both paths: when the ledger omits one migration, the script exits with code 1 and reports the missing identifier; once the ledger is complete, it exits with code 0.

## Known limitations and optional extensions

- It checks only whether an identifier appears, not whether the **order** recorded in the ledger matches the filesystem. If ordering drift matters to your team, parse and compare the ordered ledger structure as an additional step.
- It checks only from filesystem to document. It does not detect a migration identifier that remains in the document after its file has disappeared, for example because the migration was deleted accidentally. Add a reverse diff if needed.
- `ID_PATTERN`, `MIGRATIONS_DIR`, and `LEDGER_DOC` are hard-coded at the top of the script. Adapt them to your project's real paths; do not retain the scaffold's placeholder paths.
