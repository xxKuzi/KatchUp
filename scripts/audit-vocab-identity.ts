/**
 * Read-only report on how well deck words can be linked back to the corpus, and
 * on the duplicates that link would collapse.
 *
 * Nothing is written. Run this before the concept_id migration to see whether
 * the match strategies are good enough to be worth trusting.
 *
 *   npx tsx scripts/audit-vocab-identity.ts
 *   npx tsx scripts/audit-vocab-identity.ts --misses   # list unmatched words
 */

import { loadEnv } from "./_lib/conceptGen";
import type { Lang } from "../app/_lib/languages";

loadEnv();

const SHOW_MISSES = process.argv.includes("--misses");

async function run() {
  const { db } = await import("../lib/db");
  const { conceptTranslations, deckWords, decks, userWordStats, wordConcepts } =
    await import("../db/schema");
  const { normalizeLang } = await import("../app/_lib/languages");
  const { buildVocabKey, matchKey, normalizeVocabText } = await import(
    "../app/api/decks/_lib/vocabIdentity"
  );
  const { eq } = await import("drizzle-orm");

  // The corpus is ~4k rows and fully cached; pulling it once beats a query per
  // word by three orders of magnitude on the HTTP driver.
  const translations = await db
    .select({
      conceptId: conceptTranslations.conceptId,
      conceptKey: wordConcepts.conceptKey,
      lang: conceptTranslations.lang,
      text: conceptTranslations.text,
    })
    .from(conceptTranslations)
    .innerJoin(wordConcepts, eq(wordConcepts.id, conceptTranslations.conceptId));

  /** lang -> normalised text -> concept ids (plural: collisions are the point) */
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

  const deckRows = await db
    .select({
      deckId: decks.id,
      deckName: decks.name,
      kind: decks.kind,
      nativeLang: decks.nativeLang,
      foreignLang: decks.foreignLang,
      wordId: deckWords.id,
      native: deckWords.native,
      foreign: deckWords.foreign,
    })
    .from(decks)
    .innerJoin(deckWords, eq(deckWords.deckId, decks.id));

  type Outcome =
    | "exact-both"
    | "fuzzy-both"
    | "fuzzy-foreign"
    | "ambiguous"
    | "no-match"
    | "bad-lang";

  const tally = new Map<string, Map<Outcome, number>>();
  const misses: string[] = [];
  /** identity -> deck word ids, to size the duplicate problem */
  const identities = new Map<string, string[]>();

  for (const row of deckRows) {
    const nativeLang = normalizeLang(row.nativeLang);
    const foreignLang = normalizeLang(row.foreignLang);

    const bump = (outcome: Outcome) => {
      const byKind = tally.get(row.kind) ?? new Map<Outcome, number>();
      byKind.set(outcome, (byKind.get(outcome) ?? 0) + 1);
      tally.set(row.kind, byKind);
    };

    if (!nativeLang || !foreignLang) {
      bump("bad-lang");
      continue;
    }

    let conceptId: string | null = null;
    let outcome: Outcome = "no-match";

    // Pass 1 — both sides exact. Topic decks were resolved from the corpus, so
    // this is where nearly all of them should land.
    const exact = intersect(
      lookup(exactIndex, nativeLang, normalizeVocabText(row.native)),
      lookup(exactIndex, foreignLang, normalizeVocabText(row.foreign)),
    );

    // Pass 2 — both sides fuzzy: articles and transliterations forgiven.
    const fuzzy = intersect(
      lookup(fuzzyIndex, nativeLang, matchKey(row.native, nativeLang)),
      lookup(fuzzyIndex, foreignLang, matchKey(row.foreign, foreignLang)),
    );

    // Pass 3 — foreign side only, for custom decks whose native wording differs
    // from the corpus ("automobile" for "car"). Never the native side alone:
    // that says nothing about whether the foreign word is this concept.
    const foreignOnly = lookup(
      fuzzyIndex,
      foreignLang,
      matchKey(row.foreign, foreignLang),
    );

    for (const [candidates, label] of [
      [exact, "exact-both"],
      [fuzzy, "fuzzy-both"],
      [foreignOnly, "fuzzy-foreign"],
    ] as const) {
      if (candidates.size === 1) {
        conceptId = [...candidates][0];
        outcome = label;
        break;
      }
      if (candidates.size > 1) {
        // Ambiguous is a decline, not a guess: a free-text identity is a
        // correct outcome, a wrong concept link is not.
        outcome = "ambiguous";
        break;
      }
    }

    bump(outcome);

    if (!conceptId && SHOW_MISSES) {
      misses.push(
        `  [${row.kind}] ${row.deckName} (${nativeLang}->${foreignLang}): ${row.native} / ${row.foreign} — ${outcome}`,
      );
    }

    const vocabKey = buildVocabKey({
      conceptId,
      nativeKey: normalizeVocabText(row.native),
      foreignKey: normalizeVocabText(row.foreign),
    });
    const identity = `${nativeLang}|${foreignLang}|${vocabKey}`;
    identities.set(identity, [...(identities.get(identity) ?? []), row.wordId]);
  }

  console.log(`Corpus: ${translations.length} translations`);
  console.log(`Deck words: ${deckRows.length}\n`);

  console.log("Concept match rate by deck kind:");
  for (const [kind, byOutcome] of tally) {
    const total = [...byOutcome.values()].reduce((sum, n) => sum + n, 0);
    const matched =
      (byOutcome.get("exact-both") ?? 0) +
      (byOutcome.get("fuzzy-both") ?? 0) +
      (byOutcome.get("fuzzy-foreign") ?? 0);
    const pct = ((matched / total) * 100).toFixed(1);
    console.log(`  ${kind}: ${matched}/${total} matched (${pct}%)`);
    for (const [outcome, count] of [...byOutcome].sort((a, b) => b[1] - a[1])) {
      console.log(`      ${outcome.padEnd(14)} ${count}`);
    }
  }

  const duplicated = [...identities.entries()].filter(
    ([, ids]) => ids.length > 1,
  );
  const collapsedRows = duplicated.reduce(
    (sum, [, ids]) => sum + ids.length - 1,
    0,
  );

  console.log(`\nIdentities: ${identities.size} distinct`);
  console.log(
    `  ${duplicated.length} appear in more than one deck word (${collapsedRows} rows collapse)`,
  );

  // How much of that duplication a real user has actually practised — the rows
  // the merge would have to reconcile rather than silently drop.
  const stats = await db
    .select({
      userId: userWordStats.userId,
      deckWordId: userWordStats.deckWordId,
      known: userWordStats.known,
    })
    .from(userWordStats);

  const wordToIdentity = new Map<string, string>();
  for (const [identity, ids] of identities) {
    for (const id of ids) wordToIdentity.set(id, identity);
  }

  const perUser = new Map<string, Map<string, number>>();
  for (const stat of stats) {
    const identity = stat.deckWordId
      ? wordToIdentity.get(stat.deckWordId)
      : undefined;
    if (!identity) continue;
    const byIdentity = perUser.get(stat.userId) ?? new Map<string, number>();
    byIdentity.set(identity, (byIdentity.get(identity) ?? 0) + 1);
    perUser.set(stat.userId, byIdentity);
  }

  let statRowsMerged = 0;
  let usersAffected = 0;
  for (const byIdentity of perUser.values()) {
    const extra = [...byIdentity.values()].reduce(
      (sum, count) => sum + count - 1,
      0,
    );
    if (extra > 0) usersAffected += 1;
    statRowsMerged += extra;
  }

  console.log(`\nStat rows: ${stats.length}`);
  console.log(
    `  ${statRowsMerged} would merge away, affecting ${usersAffected} user(s)`,
  );

  if (SHOW_MISSES && misses.length) {
    console.log(`\nUnmatched (${misses.length}):`);
    for (const line of misses) console.log(line);
  }

  process.exit(0);
}

run().catch((error) => {
  console.error("Audit failed:", error);
  process.exit(1);
});
