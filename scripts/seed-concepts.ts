/**
 * Loads data/concepts.json into word_concepts + concept_translations.
 * Idempotent — safe to rerun after regenerating the corpus.
 *
 *   npx tsx scripts/seed-concepts.ts
 */

import fs from "fs";
import path from "path";

// Dependency-free .env loader — must run before lib/db is imported, since that
// module throws at import time when DATABASE_URL is missing.
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2] || "";
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value.trim();
  }
}

loadEnv();

async function run() {
  const { readConceptSeedFile, seedConcepts } = await import("../db/seed/concepts");

  const rows = readConceptSeedFile();
  console.log(`Read ${rows.length} concepts from data/concepts.json`);

  const result = await seedConcepts(rows);
  console.log(`Upserted ${result.conceptsUpserted} concepts.`);
  console.log(`Upserted ${result.translationsUpserted} translations.`);

  if (result.skipped.length) {
    console.warn(`\nSkipped ${result.skipped.length} rows:`);
    for (const reason of result.skipped.slice(0, 20)) {
      console.warn(`  - ${reason}`);
    }
    if (result.skipped.length > 20) {
      console.warn(`  ... and ${result.skipped.length - 20} more`);
    }
  }

  process.exit(0);
}

run().catch((error) => {
  console.error("Seeding failed:", error);
  process.exit(1);
});
