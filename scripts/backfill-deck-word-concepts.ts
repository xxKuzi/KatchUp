/**
 * Links existing deck words back to the corpus entry they came from.
 *
 * Topic decks were built by resolving concept keys and copying only the two
 * resolved strings, so the link they always conceptually had was never stored.
 * Custom decks may coincide with the corpus by accident, which is just as
 * useful: it means "apple / Apfel" typed by hand shares progress with the same
 * word in a topic pack.
 *
 * A word that matches nothing keeps a null concept_id and gets a text-derived
 * identity instead — that is a correct outcome, not a failure.
 *
 *   npx tsx scripts/backfill-deck-word-concepts.ts --dry-run
 *   npx tsx scripts/backfill-deck-word-concepts.ts
 */

import { loadEnv } from "./_lib/conceptGen";
import type { Lang } from "../app/_lib/languages";

loadEnv();

const DRY_RUN = process.argv.includes("--dry-run");

async function run() {
  const { db } = await import("../lib/db");
  const { conceptTranslations, deckWords, decks, wordConcepts } = await import(
    "../db/schema"
  );
  const { normalizeLang } = await import("../app/_lib/languages");
  const { matchKey, normalizeVocabText } = await import(
    "../app/api/decks/_lib/vocabIdentity"
  );
  const { eq, isNull, inArray } = await import("drizzle-orm");

  const translations = await db
    .select({
      conceptId: conceptTranslations.conceptId,
      lang: conceptTranslations.lang,
      text: conceptTranslations.text,
    })
    .from(conceptTranslations)
    .innerJoin(wordConcepts, eq(wordConcepts.id, conceptTranslations.conceptId));

  const exactIndex = new Map<string, Map<string, Set<string>>>();
  const fuzzyIndex = new Map<string, Map<string, Set<string>>>();

  const push = (
    index: Map<string, Map<string, Set<string>>>,
    lang: string,
    key: string,
    conceptId: string,
  ) => {
    if (!key) return;
    const byLang = index.get(lang) ?? new Map<string, Set<string>>();
    const ids = byLang.get(key) ?? new Set<string>();
    ids.add(conceptId);
    byLang.set(key, ids);
    index.set(lang, byLang);
  };

  for (const row of translations) {
    push(exactIndex, row.lang, normalizeVocabText(row.text), row.conceptId);
    push(
      fuzzyIndex,
      row.lang,
      matchKey(row.text, row.lang as Lang),
      row.conceptId,
    );
  }

  const lookup = (
    index: Map<string, Map<string, Set<string>>>,
    lang: string,
    key: string,
  ): Set<string> => index.get(lang)?.get(key) ?? new Set<string>();

  const intersect = (a: Set<string>, b: Set<string>): Set<string> =>
    new Set([...a].filter((value) => b.has(value)));

  // Only rows that have never been linked, so a re-run is cheap and a
  // deliberately-nulled row is never re-guessed.
  const rows = await db
    .select({
      wordId: deckWords.id,
      native: deckWords.native,
      foreign: deckWords.foreign,
      nativeLang: decks.nativeLang,
      foreignLang: decks.foreignLang,
    })
    .from(deckWords)
    .innerJoin(decks, eq(decks.id, deckWords.deckId))
    .where(isNull(deckWords.conceptId));

  /** conceptId -> word ids, so the write is one statement per concept. */
  const updates = new Map<string, string[]>();
  const counts = { exact: 0, fuzzy: 0, foreignOnly: 0, declined: 0 };

  for (const row of rows) {
    const nativeLang = normalizeLang(row.nativeLang);
    const foreignLang = normalizeLang(row.foreignLang);
    if (!nativeLang || !foreignLang) {
      counts.declined += 1;
      continue;
    }

    const passes: Array<[Set<string>, keyof typeof counts]> = [
      [
        intersect(
          lookup(exactIndex, nativeLang, normalizeVocabText(row.native)),
          lookup(exactIndex, foreignLang, normalizeVocabText(row.foreign)),
        ),
        "exact",
      ],
      [
        intersect(
          lookup(fuzzyIndex, nativeLang, matchKey(row.native, nativeLang)),
          lookup(fuzzyIndex, foreignLang, matchKey(row.foreign, foreignLang)),
        ),
        "fuzzy",
      ],
      [
        lookup(fuzzyIndex, foreignLang, matchKey(row.foreign, foreignLang)),
        "foreignOnly",
      ],
    ];

    let linked = false;
    for (const [candidates, label] of passes) {
      // Ambiguity is a decline, not a coin flip: a wrong concept link silently
      // merges two different words' progress, which no later run can undo.
      if (candidates.size !== 1) {
        if (candidates.size > 1) break;
        continue;
      }
      const conceptId = [...candidates][0];
      updates.set(conceptId, [...(updates.get(conceptId) ?? []), row.wordId]);
      counts[label] += 1;
      linked = true;
      break;
    }

    if (!linked) {
      counts.declined += 1;
    }
  }

  const linkedTotal = counts.exact + counts.fuzzy + counts.foreignOnly;
  console.log(`Unlinked deck words: ${rows.length}`);
  console.log(`  exact both sides : ${counts.exact}`);
  console.log(`  fuzzy both sides : ${counts.fuzzy}`);
  console.log(`  foreign side only: ${counts.foreignOnly}`);
  console.log(`  left as free text: ${counts.declined}`);
  console.log(`  -> ${linkedTotal} rows to link across ${updates.size} concepts`);

  if (DRY_RUN) {
    console.log("\nDry run — nothing written.");
    process.exit(0);
  }

  let written = 0;
  for (const [conceptId, wordIds] of updates) {
    await db
      .update(deckWords)
      .set({ conceptId })
      .where(inArray(deckWords.id, wordIds));
    written += wordIds.length;
  }

  console.log(`\nLinked ${written} deck words.`);
  process.exit(0);
}

run().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
