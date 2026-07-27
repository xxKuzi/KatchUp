/**
 * Seeds the deck-scoped clear record from the stats that predate it.
 *
 * The topic ladder used to read `user_word_stats` directly. Now that mastery is
 * shared across decks and games, the ladder needs its own record of what was
 * answered *inside a pack* — without this, every existing player's derived
 * levels would come back empty.
 *
 * Best available evidence: a stat row that has been answered right at least once
 * and still points at a deck word. Stats are unique per word now, so a word
 * practised in two packs can only vouch for the deck it still points at; the
 * stored `completed_levels` rows cover the rest, since the ladder unions the two.
 *
 *   npx tsx scripts/backfill-deck-word-clears.ts --dry-run
 *   npx tsx scripts/backfill-deck-word-clears.ts
 */

import { loadEnv } from "./_lib/conceptGen";

loadEnv();

const DRY_RUN = process.argv.includes("--dry-run");

async function run() {
  const { db } = await import("../lib/db");
  const { userDeckWordClears, userWordStats } = await import("../db/schema");
  const { and, gt, isNotNull, or, eq } = await import("drizzle-orm");

  const rows = await db
    .select({
      userId: userWordStats.userId,
      deckWordId: userWordStats.deckWordId,
      timesCorrect: userWordStats.timesCorrect,
      known: userWordStats.known,
      updatedAt: userWordStats.updatedAt,
    })
    .from(userWordStats)
    .where(
      and(
        isNotNull(userWordStats.deckWordId),
        or(gt(userWordStats.timesCorrect, 0), eq(userWordStats.known, true)),
      ),
    );

  console.log(`Cleared-word stats to seed: ${rows.length}`);

  if (DRY_RUN) {
    console.log("Dry run — nothing written.");
    process.exit(0);
  }

  if (rows.length > 0) {
    await db
      .insert(userDeckWordClears)
      .values(
        rows.map((row) => ({
          userId: row.userId,
          deckWordId: row.deckWordId as string,
          // A word marked known by hand has no correct answers to its name, but
          // it has certainly been met.
          timesCorrect: Math.max(row.timesCorrect, 1),
          updatedAt: row.updatedAt,
        })),
      )
      .onConflictDoNothing();
  }

  console.log(`Seeded ${rows.length} clear records.`);
  process.exit(0);
}

run().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
