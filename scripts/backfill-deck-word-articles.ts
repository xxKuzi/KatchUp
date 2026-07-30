/**
 * Copies each deck word's article down from the corpus entry it came from.
 *
 * `seedTopicDecks` skips decks that already exist, so the topic packs everyone
 * practises were written before articles existed and hold null. Refreshing them
 * would fix that, but it deletes and re-inserts every row — which cascades to
 * the per-word stats users built on them. This only ever writes the one new
 * column, on rows that have none, so no stat row is touched.
 *
 * Custom decks pick their articles up on their next save through
 * `prepareWords`; this reaches them too, without waiting for one.
 *
 *   npx tsx scripts/backfill-deck-word-articles.ts
 *   npx tsx scripts/backfill-deck-word-articles.ts --dry-run
 *
 * Idempotent: the `article is null` guard means a second run is a no-op, and a
 * word a user has deliberately given their own article is never overwritten.
 */

import { loadEnv } from "./_lib/conceptGen";

loadEnv();

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const { sql } = await import("drizzle-orm");
  const { db } = await import("@/lib/db");

  // Matched on the deck's own foreign language rather than on the concept
  // alone: a concept carries a translation per language, and the German article
  // must not land on the Spanish side of a deck.
  const predicate = sql`
    deck_words.concept_id is not null
    and deck_words.article is null
    and ct.concept_id = deck_words.concept_id
    and ct.article is not null
    and ct.lang = lower(d.foreign_lang)
  `;

  const unwrap = <T>(result: unknown): T[] =>
    Array.isArray(result)
      ? (result as T[])
      : ((result as { rows?: T[] }).rows ?? []);

  if (dryRun) {
    const rows = unwrap<{ n: number }>(
      await db.execute(sql`
        select count(*)::int as n
        from deck_words
        join decks d on d.id = deck_words.deck_id
        join concept_translations ct on ct.concept_id = deck_words.concept_id
        where ${predicate}
      `),
    );
    console.log(`${rows[0]?.n ?? 0} deck words would get an article.`);
    return;
  }

  const rows = unwrap<{ id: string }>(
    await db.execute(sql`
      update deck_words
      set article = ct.article
      from concept_translations ct, decks d
      where d.id = deck_words.deck_id and ${predicate}
      returning deck_words.id
    `),
  );

  console.log(`${rows.length} deck words given an article.`);
}

main().then(() => process.exit(0));
