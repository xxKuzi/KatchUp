/**
 * Rewrites stored language values to canonical ISO codes.
 *
 * Before the unified word model, language columns held a mix of spellings
 * ("german", "deutsch", "english"). The app now reads and writes "de"/"en"/
 * "es"/"cs" everywhere, so existing rows are migrated once here — otherwise
 * leaderboards and topic decks written before the change stay invisible.
 *
 *   npx tsx scripts/normalize-languages.ts [--dry-run]
 */

import fs from "fs";
import path from "path";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
    if (!match) continue;
    let value = match[2] || "";
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value.trim();
  }
}
loadEnv();

const DRY_RUN = process.argv.includes("--dry-run");

// table -> columns holding a language value
const TARGETS: Array<{ table: string; columns: string[] }> = [
  { table: "decks", columns: ["native_lang", "foreign_lang"] },
  { table: "async_scores", columns: ["language"] },
  { table: "matches", columns: ["language", "native_lang"] },
  { table: "user_word_progress", columns: ["language"] },
];

async function run() {
  const { db } = await import("../lib/db");
  const { sql } = await import("drizzle-orm");
  const { LANGS, normalizeLang } = await import("../app/_lib/languages");

  for (const { table, columns } of TARGETS) {
    for (const column of columns) {
      const rows = await db.execute(
        sql`SELECT DISTINCT ${sql.raw(column)} AS value
            FROM ${sql.raw(table)}
            WHERE ${sql.raw(column)} IS NOT NULL`,
      );

      for (const row of rows.rows as Array<{ value: string }>) {
        const current = row.value;
        if (!current || (LANGS as readonly string[]).includes(current)) {
          continue;
        }

        const canonical = normalizeLang(current);
        if (!canonical) {
          console.warn(
            `  ! ${table}.${column}: cannot map "${current}" — left as-is`,
          );
          continue;
        }

        if (DRY_RUN) {
          console.log(`  would map ${table}.${column}: "${current}" -> "${canonical}"`);
          continue;
        }

        const result = await db.execute(
          sql`UPDATE ${sql.raw(table)}
              SET ${sql.raw(column)} = ${canonical}
              WHERE ${sql.raw(column)} = ${current}`,
        );
        console.log(
          `  ${table}.${column}: "${current}" -> "${canonical}" (${result.rowCount ?? 0} rows)`,
        );
      }
    }
  }

  console.log(DRY_RUN ? "\nDry run complete." : "\nNormalisation complete.");
  process.exit(0);
}

run().catch((error) => {
  console.error("Normalisation failed:", error);
  process.exit(1);
});
