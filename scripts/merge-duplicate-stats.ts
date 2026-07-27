/**
 * Collapses stat rows that describe the same word into one per identity.
 *
 * These exist because progress used to hang off a deck row: practising "wash"
 * in Fruit & Vegetables and again in Daily Life produced two unrelated rows.
 *
 * Merge rules, and why they differ per column:
 *   box, streak, lastSeenAt   -> max. These are *state*; taking anything less
 *                                would silently demote a user below what they
 *                                have already proven.
 *   timesSeen/Correct/Wrong   -> sum. These are *history*; the practice really
 *                                did happen twice.
 *   known                     -> OR. Mastery is never revoked by a bookkeeping
 *                                change.
 *
 * Run only after the read paths key on identity, or the surviving row's
 * deck_word_id will make the sibling deck look unpractised.
 *
 *   npx tsx scripts/merge-duplicate-stats.ts --dry-run
 *   npx tsx scripts/merge-duplicate-stats.ts
 */

import { loadEnv } from "./_lib/conceptGen";

loadEnv();

const DRY_RUN = process.argv.includes("--dry-run");

async function run() {
  const { db } = await import("../lib/db");
  const { userWordStats } = await import("../db/schema");
  const { countKnownWordsForLanguage } = await import(
    "../app/api/decks/_lib/spacedRepetition"
  );
  const { raiseWordFloor } = await import(
    "../app/api/decks/_lib/levelProgress"
  );
  const { eq, inArray } = await import("drizzle-orm");

  const rows = await db.select().from(userWordStats);

  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!row.vocabKey) continue;
    const key = `${row.userId}|${row.nativeLang}|${row.foreignLang}|${row.vocabKey}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const duplicated = [...groups.entries()].filter(([, group]) => group.length > 1);

  if (duplicated.length === 0) {
    console.log("No duplicate identities — nothing to merge.");
    process.exit(0);
  }

  // Levels before the merge, so a user cannot visibly lose a level to a bug fix.
  const affectedUsers = new Map<string, Set<string>>();
  for (const [, group] of duplicated) {
    const langs = affectedUsers.get(group[0].userId) ?? new Set<string>();
    if (group[0].foreignLang) langs.add(group[0].foreignLang);
    affectedUsers.set(group[0].userId, langs);
  }

  const before = new Map<string, number>();
  for (const [userId, langs] of affectedUsers) {
    for (const lang of langs) {
      before.set(
        `${userId}|${lang}`,
        await countKnownWordsForLanguage(userId, lang),
      );
    }
  }

  console.log(
    `${duplicated.length} duplicated identities across ${affectedUsers.size} user(s)`,
  );

  for (const [, group] of duplicated) {
    const sorted = [...group].sort(
      (a, b) =>
        b.updatedAt.getTime() - a.updatedAt.getTime() || a.id.localeCompare(b.id),
    );
    const [survivor, ...losers] = sorted;

    const merged = {
      box: Math.max(...group.map((row) => row.box)),
      streak: Math.max(...group.map((row) => row.streak)),
      timesSeen: group.reduce((sum, row) => sum + row.timesSeen, 0),
      timesCorrect: group.reduce((sum, row) => sum + row.timesCorrect, 0),
      timesWrong: group.reduce((sum, row) => sum + row.timesWrong, 0),
      known: group.some((row) => row.known),
      lastSeenAt: group.reduce<Date | null>((latest, row) => {
        if (!row.lastSeenAt) return latest;
        return !latest || row.lastSeenAt > latest ? row.lastSeenAt : latest;
      }, null),
      // Keep a deck pointer if any copy still has one, so the learned-words list
      // can still name a deck.
      deckWordId:
        survivor.deckWordId ??
        losers.find((row) => row.deckWordId)?.deckWordId ??
        null,
    };

    console.log(
      `  ${survivor.nativeText} / ${survivor.foreignText} (${group.length} rows) -> box ${merged.box}, streak ${merged.streak}, seen ${merged.timesSeen}, known ${merged.known}`,
    );

    if (DRY_RUN) continue;

    await db
      .update(userWordStats)
      .set(merged)
      .where(eq(userWordStats.id, survivor.id));
    await db.delete(userWordStats).where(
      inArray(
        userWordStats.id,
        losers.map((row) => row.id),
      ),
    );
  }

  if (DRY_RUN) {
    console.log("\nDry run — nothing written.");
    process.exit(0);
  }

  // A level going backwards reads as a bug however good the reason, so the
  // pre-merge count becomes a floor.
  for (const [key, count] of before) {
    const [userId, lang] = key.split("|");
    const after = await countKnownWordsForLanguage(userId, lang);
    if (after < count) {
      await raiseWordFloor(userId, lang, count);
      console.log(
        `\nuser ${userId.slice(0, 8)} ${lang}: ${count} -> ${after} known; floor raised to ${count}`,
      );
    }
  }

  console.log("\nMerge complete.");
  process.exit(0);
}

run().catch((error) => {
  console.error("Merge failed:", error);
  process.exit(1);
});
