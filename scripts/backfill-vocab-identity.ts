/**
 * Fills the identity columns on stat rows that predate them.
 *
 * Every existing row was created from a deck word, so its identity is derived
 * by walking back through that deck word to the deck's language pair and the
 * concept the word was linked to in `backfill-deck-word-concepts`.
 *
 * Idempotent: only rows with no `vocab_key` are touched, so a partial run can
 * simply be repeated.
 *
 *   npx tsx scripts/backfill-vocab-identity.ts --dry-run
 *   npx tsx scripts/backfill-vocab-identity.ts
 */

import { loadEnv } from "./_lib/conceptGen";

loadEnv();

const DRY_RUN = process.argv.includes("--dry-run");

async function run() {
  const { db } = await import("../lib/db");
  const { deckWords, decks, userWordStats } = await import("../db/schema");
  const { normalizeLang } = await import("../app/_lib/languages");
  const { buildVocabIdentity } = await import(
    "../app/api/decks/_lib/vocabIdentity"
  );
  const { eq, isNull } = await import("drizzle-orm");

  const rows = await db
    .select({
      statId: userWordStats.id,
      userId: userWordStats.userId,
      conceptId: deckWords.conceptId,
      native: deckWords.native,
      foreign: deckWords.foreign,
      nativeLang: decks.nativeLang,
      foreignLang: decks.foreignLang,
    })
    .from(userWordStats)
    .innerJoin(deckWords, eq(deckWords.id, userWordStats.deckWordId))
    .innerJoin(decks, eq(decks.id, deckWords.deckId))
    .where(isNull(userWordStats.vocabKey));

  let skipped = 0;
  const updates: Array<{
    statId: string;
    userId: string;
    values: Record<string, string | null>;
  }> = [];

  for (const row of rows) {
    const nativeLang = normalizeLang(row.nativeLang);
    const foreignLang = normalizeLang(row.foreignLang);
    if (!nativeLang || !foreignLang) {
      skipped += 1;
      continue;
    }

    const identity = buildVocabIdentity({
      conceptId: row.conceptId,
      nativeLang,
      foreignLang,
      nativeText: row.native,
      foreignText: row.foreign,
    });

    updates.push({
      statId: row.statId,
      userId: row.userId,
      values: {
        conceptId: identity.conceptId,
        nativeLang: identity.nativeLang,
        foreignLang: identity.foreignLang,
        nativeKey: identity.nativeKey,
        foreignKey: identity.foreignKey,
        vocabKey: identity.vocabKey,
        nativeText: identity.nativeText,
        foreignText: identity.foreignText,
      },
    });
  }

  const conceptBacked = updates.filter((u) => u.values.conceptId).length;
  console.log(`Stat rows needing identity: ${rows.length}`);
  console.log(`  concept-backed : ${conceptBacked}`);
  console.log(`  free text      : ${updates.length - conceptBacked}`);
  console.log(`  skipped (bad language on deck): ${skipped}`);

  // How many rows will collide once the identity index becomes unique — the
  // work Stage 3's merge has to do.
  const seen = new Map<string, number>();
  for (const update of updates) {
    const key = `${update.userId}|${update.values.nativeLang}|${update.values.foreignLang}|${update.values.vocabKey}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const collisions = [...seen.values()].reduce(
    (sum, count) => sum + count - 1,
    0,
  );
  console.log(`  duplicate identities within this batch: ${collisions}`);

  if (DRY_RUN) {
    console.log("\nDry run — nothing written.");
    process.exit(0);
  }

  for (const update of updates) {
    await db
      .update(userWordStats)
      .set(update.values)
      .where(eq(userWordStats.id, update.statId));
  }

  console.log(`\nUpdated ${updates.length} stat rows.`);
  process.exit(0);
}

run().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
