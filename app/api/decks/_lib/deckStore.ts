import { and, asc, desc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import {
  conceptTranslations,
  deckMembers,
  deckWords,
  decks,
  users,
  userWordStats,
  wordConcepts,
} from "@/db/schema";
import {
  TOPIC_DECK_PAIRS,
  topicDeckName,
  TOPIC_SEEDS,
} from "./topicSeedData";
import { normalizeLang } from "@/app/_lib/languages";
import {
  buildVocabIdentity,
  normalizeVocabText,
  slugifyConceptKey,
} from "./vocabIdentity";

export type DeckKind = "topic" | "custom";

/**
 * What a user may do with a deck they can see.
 *
 * "owner" created it; "editor" joined through a share link that grants edits;
 * "viewer" joined a read-only link. Topic decks belong to nobody and carry a
 * null role — everyone practises them, nobody edits them.
 */
export type DeckRole = "owner" | "editor" | "viewer";

export interface DeckWordRecord {
  id: string;
  /** The corpus entry behind this word, or null for free text. */
  conceptId: string | null;
  native: string;
  foreign: string;
  orderIndex: number;
}

export interface DeckRecord {
  id: string;
  ownerUserId: string | null;
  kind: DeckKind;
  topicKey: string | null;
  name: string;
  nativeLang: string;
  foreignLang: string;
  wordCount: number;
  /** Words the user has mastered in this deck. 0 when signed out. */
  knownCount: number;
  /**
   * Words met — answered right at least once, mastered or not. Always contains
   * `knownCount`. 0 when signed out.
   */
  clearedCount: number;
  /** What this user may do with the deck; null for topic decks. */
  role: DeckRole | null;
  /** Owner's display name, so a shared deck can say who it came from. */
  ownerName: string | null;
}

export interface DeckWithWords extends DeckRecord {
  words: DeckWordRecord[];
}

export interface WordInput {
  id?: string;
  /**
   * Set only by callers that already know which corpus entry a word came from
   * (the starter deck). Words typed by a user arrive without one and are
   * resolved against the corpus separately.
   */
  conceptId?: string | null;
  native: string;
  foreign: string;
}

interface DeckAccess {
  role: DeckRole | null;
  ownerName: string | null;
}

function toDeckRecord(
  row: typeof decks.$inferSelect,
  wordCount = 0,
  progress: DeckProgressCounts = { known: 0, cleared: 0 },
  access: DeckAccess = { role: null, ownerName: null },
): DeckRecord {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    kind: row.kind as DeckKind,
    topicKey: row.topicKey,
    name: row.name,
    nativeLang: row.nativeLang,
    foreignLang: row.foreignLang,
    wordCount,
    knownCount: progress.known,
    clearedCount: Math.max(progress.known, progress.cleared),
    role: access.role,
    ownerName: access.ownerName,
  };
}

/** The role a membership row carries, falling back to the safer one. */
function toDeckRole(value: string | null): DeckRole {
  return value === "editor" ? "editor" : "viewer";
}

/** The two tiers a list page draws: mastered, and merely met. */
interface DeckProgressCounts {
  known: number;
  /** Answered right at least once; contains `known`. */
  cleared: number;
}

/**
 * Returns a map of deckId -> mastered and met word counts for one user.
 *
 * Batched on purpose: `getDeckProgress` loads every word and stat for a single
 * deck, which is far too heavy to call once per row on a list page.
 *
 * Matched by identity rather than by deck word, so a word mastered in one deck
 * shows as mastered in every deck that also contains it — the same answer the
 * deck's own session gives. The pairing is done here rather than in SQL because
 * it needs the deck's canonical languages, and `decks.foreign_lang` may still
 * hold a legacy name ("german") that only `normalizeLang` can resolve.
 */
async function countProgressByDeck(
  userId: string,
  deckIds: string[],
): Promise<Map<string, DeckProgressCounts>> {
  if (deckIds.length === 0) {
    return new Map();
  }

  const [words, stats] = await Promise.all([
    db
      .select({
        deckId: deckWords.deckId,
        conceptId: deckWords.conceptId,
        native: deckWords.native,
        foreign: deckWords.foreign,
        nativeLang: decks.nativeLang,
        foreignLang: decks.foreignLang,
      })
      .from(deckWords)
      .innerJoin(decks, eq(decks.id, deckWords.deckId))
      .where(inArray(deckWords.deckId, deckIds)),
    db
      .select({
        nativeLang: userWordStats.nativeLang,
        foreignLang: userWordStats.foreignLang,
        vocabKey: userWordStats.vocabKey,
        known: userWordStats.known,
        timesCorrect: userWordStats.timesCorrect,
      })
      .from(userWordStats)
      .where(
        and(
          eq(userWordStats.userId, userId),
          // Words still being practised count too, so the list can show the
          // paler "met" tier next to the mastered one.
          or(
            eq(userWordStats.known, true),
            sql`${userWordStats.timesCorrect} > 0`,
          ),
        ),
      ),
  ]);

  const knownKeys = new Set<string>();
  const clearedKeys = new Set<string>();
  for (const stat of stats) {
    if (!stat.vocabKey) {
      continue;
    }
    const key = `${stat.nativeLang}|${stat.foreignLang}|${stat.vocabKey}`;
    clearedKeys.add(key);
    if (stat.known) {
      knownKeys.add(key);
    }
  }

  const counts = new Map<string, DeckProgressCounts>();
  for (const word of words) {
    const nativeLang = normalizeLang(word.nativeLang);
    const foreignLang = normalizeLang(word.foreignLang);
    if (!nativeLang || !foreignLang) {
      continue;
    }

    const identity = buildVocabIdentity({
      conceptId: word.conceptId,
      nativeLang,
      foreignLang,
      nativeText: word.native,
      foreignText: word.foreign,
    });

    const key = `${nativeLang}|${foreignLang}|${identity.vocabKey}`;
    if (!clearedKeys.has(key)) {
      continue;
    }

    const current = counts.get(word.deckId) ?? { known: 0, cleared: 0 };
    counts.set(word.deckId, {
      known: current.known + (knownKeys.has(key) ? 1 : 0),
      cleared: current.cleared + 1,
    });
  }

  return counts;
}

/**
 * Links words a user typed (or the generator invented) to the corpus, and drops
 * repeats.
 *
 * Both halves matter for the same reason: identity. A resolved concept means
 * "apple / Apfel" added by hand shares progress with the same word in a topic
 * pack instead of starting from zero, and dropping repeats stops one deck
 * holding two rows that would fight over a single stat row.
 *
 * One query: the corpus is small and fully cached, so the cost here is the round
 * trip, not the lookup.
 */
export async function prepareWords(
  words: WordInput[],
  nativeLangRaw: string,
  foreignLangRaw: string,
): Promise<{ words: WordInput[]; duplicatesRemoved: number }> {
  const nativeLang = normalizeLang(nativeLangRaw);
  const foreignLang = normalizeLang(foreignLangRaw);

  const trimmed = words
    .map((word) => ({
      ...word,
      native: word.native.trim(),
      foreign: word.foreign.trim(),
    }))
    .filter((word) => word.native.length > 0 && word.foreign.length > 0);

  if (!nativeLang || !foreignLang || trimmed.length === 0) {
    return { words: trimmed, duplicatesRemoved: 0 };
  }

  const texts = [
    ...new Set(
      trimmed.flatMap((word) => [
        normalizeVocabText(word.native),
        normalizeVocabText(word.foreign),
      ]),
    ),
  ];

  const rows = await db
    .select({
      conceptId: conceptTranslations.conceptId,
      lang: conceptTranslations.lang,
      text: conceptTranslations.text,
    })
    .from(conceptTranslations)
    .where(
      and(
        inArray(conceptTranslations.lang, [nativeLang, foreignLang]),
        inArray(sql`lower(${conceptTranslations.text})`, texts),
      ),
    );

  const byLang = new Map<string, Map<string, Set<string>>>();
  for (const row of rows) {
    const lang = byLang.get(row.lang) ?? new Map<string, Set<string>>();
    const key = normalizeVocabText(row.text);
    const ids = lang.get(key) ?? new Set<string>();
    ids.add(row.conceptId);
    lang.set(key, ids);
    byLang.set(row.lang, lang);
  }

  const seen = new Set<string>();
  const prepared: WordInput[] = [];
  let duplicatesRemoved = 0;

  for (const word of trimmed) {
    const nativeIds =
      byLang.get(nativeLang)?.get(normalizeVocabText(word.native)) ??
      new Set<string>();
    const foreignIds =
      byLang.get(foreignLang)?.get(normalizeVocabText(word.foreign)) ??
      new Set<string>();
    const both = [...nativeIds].filter((id) => foreignIds.has(id));

    // Only an unambiguous match is trusted; a wrong link would merge two
    // different words' progress, which nothing can undo later.
    const conceptId = both.length === 1 ? both[0] : (word.conceptId ?? null);

    const identity = buildVocabIdentity({
      conceptId,
      nativeLang,
      foreignLang,
      nativeText: word.native,
      foreignText: word.foreign,
    });

    if (seen.has(identity.vocabKey)) {
      duplicatesRemoved += 1;
      continue;
    }
    seen.add(identity.vocabKey);
    prepared.push({ ...word, conceptId });
  }

  return { words: prepared, duplicatesRemoved };
}

/** Returns a map of deckId -> word count for the given deck ids. */
async function countWordsByDeck(
  deckIds: string[],
): Promise<Map<string, number>> {
  if (deckIds.length === 0) {
    return new Map();
  }
  const rows = await db
    .select({
      deckId: deckWords.deckId,
      count: sql<number>`count(*)::int`,
    })
    .from(deckWords)
    .where(inArray(deckWords.deckId, deckIds))
    .groupBy(deckWords.deckId);

  return new Map(rows.map((row) => [row.deckId, row.count]));
}

/**
 * Creates the canonical topic decks and their words if they do not yet exist.
 *
 * Words come from the shared vocabulary corpus rather than a hand-maintained
 * list, so a topic deck can be built for any pair the corpus covers — including
 * reversed ones like a German speaker learning English.
 *
 * Idempotent: an existing topic deck (matched by topicKey + language pair) is
 * left untouched so re-running never duplicates words or disturbs user stats.
 */
export async function seedTopicDecks(): Promise<{
  createdDecks: number;
  createdWords: number;
  skippedPairs: string[];
}> {
  let createdDecks = 0;
  let createdWords = 0;
  const skippedPairs: string[] = [];

  for (const seed of TOPIC_SEEDS) {
    for (const { nativeLang, foreignLang } of TOPIC_DECK_PAIRS) {
      const existing = await db
        .select({ id: decks.id })
        .from(decks)
        .where(
          and(
            eq(decks.topicKey, seed.topicKey),
            eq(decks.nativeLang, nativeLang),
            eq(decks.foreignLang, foreignLang),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        continue;
      }

      const words = await resolveTopicWords(seed.english, nativeLang, foreignLang);

      // A topic with barely any resolvable words would make a broken deck, so
      // skip it and report rather than seeding a stub.
      if (words.length < seed.english.length / 2) {
        skippedPairs.push(
          `${seed.topicKey} ${nativeLang}->${foreignLang} (${words.length}/${seed.english.length} words)`,
        );
        continue;
      }

      const [deck] = await db
        .insert(decks)
        .values({
          ownerUserId: null,
          kind: "topic",
          topicKey: seed.topicKey,
          name: topicDeckName(seed, foreignLang),
          nativeLang,
          foreignLang,
        })
        .returning({ id: decks.id });

      createdDecks += 1;

      await db.insert(deckWords).values(
        words.map((word, index) => ({
          deckId: deck.id,
          conceptId: word.conceptId,
          native: word.native,
          foreign: word.foreign,
          orderIndex: index,
        })),
      );

      createdWords += words.length;
    }
  }

  return { createdDecks, createdWords, skippedPairs };
}

/**
 * Looks up each English concept in the corpus and returns the pair of texts for
 * the requested languages, preserving the topic's word order. Concepts missing
 * either language are dropped.
 */
async function resolveTopicWords(
  english: string[],
  nativeLang: string,
  foreignLang: string,
): Promise<Array<{ conceptId: string; native: string; foreign: string }>> {
  const keys = english.map((word) => slugifyConceptKey(word));
  if (keys.length === 0) {
    return [];
  }

  const nativeSide = alias(conceptTranslations, "native_side");
  const foreignSide = alias(conceptTranslations, "foreign_side");

  const rows = await db
    .select({
      conceptId: wordConcepts.id,
      conceptKey: wordConcepts.conceptKey,
      native: nativeSide.text,
      foreign: foreignSide.text,
    })
    .from(wordConcepts)
    .innerJoin(
      nativeSide,
      and(
        eq(nativeSide.conceptId, wordConcepts.id),
        eq(nativeSide.lang, nativeLang),
      ),
    )
    .innerJoin(
      foreignSide,
      and(
        eq(foreignSide.conceptId, wordConcepts.id),
        eq(foreignSide.lang, foreignLang),
      ),
    )
    .where(inArray(wordConcepts.conceptKey, keys));

  const byKey = new Map(rows.map((row) => [row.conceptKey, row]));
  return keys
    .map((key) => byKey.get(key))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .map((row) => ({
      conceptId: row.conceptId,
      native: row.native,
      foreign: row.foreign,
    }));
}

/**
 * Adds words missing from existing topic decks, keeping every row that is
 * already there.
 *
 * This is the safe counterpart to `refreshTopicDeckWords`: growing a topic's
 * seed list (10 words -> 30) has to reach decks that were seeded earlier,
 * because `seedTopicDecks` skips any deck that already exists. Appending rather
 * than replacing means users keep the progress they built on the old words.
 *
 * Matched on the concept a word came from, falling back to the text pair for
 * rows seeded before `concept_id` existed and never backfilled. Matching on the
 * concept also survives the corpus correcting a word's spelling, where the text
 * key would see the corrected form as a new word and append a duplicate.
 */
export async function topUpTopicDeckWords(): Promise<{
  toppedUpDecks: number;
  addedWords: number;
}> {
  let toppedUpDecks = 0;
  let addedWords = 0;

  for (const seed of TOPIC_SEEDS) {
    const existing = await db
      .select({
        id: decks.id,
        nativeLang: decks.nativeLang,
        foreignLang: decks.foreignLang,
      })
      .from(decks)
      .where(and(eq(decks.kind, "topic"), eq(decks.topicKey, seed.topicKey)));

    for (const deck of existing) {
      const resolved = await resolveTopicWords(
        seed.english,
        deck.nativeLang,
        deck.foreignLang,
      );

      const current = await loadWords(deck.id);
      const presentConcepts = new Set(
        current
          .map((word) => word.conceptId)
          .filter((id): id is string => Boolean(id)),
      );
      const presentTexts = new Set(
        current
          .filter((word) => !word.conceptId)
          .map((word) => `${word.native}\u0000${word.foreign}`),
      );
      const missing = resolved.filter(
        (word) =>
          !presentConcepts.has(word.conceptId) &&
          !presentTexts.has(`${word.native}\u0000${word.foreign}`),
      );

      if (missing.length === 0) {
        continue;
      }

      // Continue the existing numbering so level windows stay stable: words a
      // user already practiced keep the level they were practiced on.
      const nextIndex =
        current.reduce((max, word) => Math.max(max, word.orderIndex), -1) + 1;

      await db.insert(deckWords).values(
        missing.map((word, index) => ({
          deckId: deck.id,
          conceptId: word.conceptId,
          native: word.native,
          foreign: word.foreign,
          orderIndex: nextIndex + index,
        })),
      );

      toppedUpDecks += 1;
      addedWords += missing.length;
    }
  }

  return { toppedUpDecks, addedWords };
}

/**
 * Replaces the words of existing topic decks with the current corpus text.
 *
 * The first topic decks were seeded from a hand-written list that used ASCII
 * transliterations ("Strasse", "Kaese"); the corpus has correct orthography.
 * Destructive: deleting deck_words cascades to the per-word stats users built
 * on them, so this is opt-in rather than part of the normal seed.
 */
export async function refreshTopicDeckWords(): Promise<{
  refreshedDecks: number;
  replacedWords: number;
}> {
  let refreshedDecks = 0;
  let replacedWords = 0;

  for (const seed of TOPIC_SEEDS) {
    const existing = await db
      .select({
        id: decks.id,
        nativeLang: decks.nativeLang,
        foreignLang: decks.foreignLang,
      })
      .from(decks)
      .where(and(eq(decks.kind, "topic"), eq(decks.topicKey, seed.topicKey)));

    for (const deck of existing) {
      const words = await resolveTopicWords(
        seed.english,
        deck.nativeLang,
        deck.foreignLang,
      );
      if (words.length < seed.english.length / 2) {
        continue;
      }

      await db.delete(deckWords).where(eq(deckWords.deckId, deck.id));
      await db.insert(deckWords).values(
        words.map((word, index) => ({
          deckId: deck.id,
          conceptId: word.conceptId,
          native: word.native,
          foreign: word.foreign,
          orderIndex: index,
        })),
      );

      refreshedDecks += 1;
      replacedWords += words.length;
    }
  }

  return { refreshedDecks, replacedWords };
}

async function loadWords(deckId: string): Promise<DeckWordRecord[]> {
  const rows = await db
    .select({
      id: deckWords.id,
      conceptId: deckWords.conceptId,
      native: deckWords.native,
      foreign: deckWords.foreign,
      orderIndex: deckWords.orderIndex,
    })
    .from(deckWords)
    .where(eq(deckWords.deckId, deckId))
    .orderBy(asc(deckWords.orderIndex), asc(deckWords.createdAt));

  return rows;
}

/**
 * Selects decks together with the caller's access to them.
 *
 * The membership join is what makes a shared deck show up in the friend's own
 * list: they never own the row, so ownership alone would hide it. The join is
 * on the caller's user id only, so at most one membership row can match.
 */
function selectDecksWithAccess(userId: string) {
  const owner = alias(users, "deck_owner");
  return db
    .select({
      deck: decks,
      memberRole: deckMembers.role,
      ownerName: owner.name,
    })
    .from(decks)
    .leftJoin(
      deckMembers,
      and(eq(deckMembers.deckId, decks.id), eq(deckMembers.userId, userId)),
    )
    .leftJoin(owner, eq(owner.id, decks.ownerUserId));
}

type DeckAccessRow = {
  deck: typeof decks.$inferSelect;
  memberRole: string | null;
  ownerName: string | null;
};

function accessOf(row: DeckAccessRow, userId: string): DeckAccess {
  if (row.deck.kind !== "custom") {
    return { role: null, ownerName: null };
  }
  return {
    role:
      row.deck.ownerUserId === userId ? "owner" : toDeckRole(row.memberRole),
    ownerName: row.ownerName,
  };
}

async function decorateDecks(
  rows: DeckAccessRow[],
  userId: string,
): Promise<DeckRecord[]> {
  const deckIds = rows.map((row) => row.deck.id);
  const counts = await countWordsByDeck(deckIds);
  const progress = await countProgressByDeck(userId, deckIds);
  return rows.map((row) =>
    toDeckRecord(
      row.deck,
      counts.get(row.deck.id) ?? 0,
      progress.get(row.deck.id) ?? { known: 0, cleared: 0 },
      accessOf(row, userId),
    ),
  );
}

/**
 * All decks a user may practice: their own custom decks, decks shared with
 * them, plus every topic deck.
 */
export async function listDecksForUser(userId: string): Promise<DeckRecord[]> {
  const rows = await selectDecksWithAccess(userId)
    .where(
      or(
        eq(decks.kind, "topic"),
        eq(decks.ownerUserId, userId),
        isNotNull(deckMembers.id),
      ),
    )
    .orderBy(desc(decks.updatedAt));

  return decorateDecks(rows, userId);
}

/** The user's own custom decks plus the ones friends have shared with them. */
export async function listCustomDecks(userId: string): Promise<DeckRecord[]> {
  const rows = await selectDecksWithAccess(userId)
    .where(
      and(
        eq(decks.kind, "custom"),
        or(eq(decks.ownerUserId, userId), isNotNull(deckMembers.id)),
      ),
    )
    .orderBy(desc(decks.updatedAt));

  return decorateDecks(rows, userId);
}

/** Deck name of the starter deck, in the language the user speaks. */
const STARTER_DECK_NAMES: Record<string, string> = {
  en: "My first deck",
  de: "Mein erstes Deck",
  es: "Mi primer mazo",
  cs: "Můj první balíček",
};

/** How many words the starter deck is filled with. */
const STARTER_DECK_WORD_COUNT = 12;

/**
 * Guarantees a signed-in user owns at least one custom deck for the language
 * pair they are currently studying, creating a starter deck the first time.
 *
 * Without this a fresh account lands on an empty "My decks" page with nothing
 * to practice until they build a deck by hand. The deck is a normal custom
 * deck: renaming, editing, or deleting it is allowed, and it is only recreated
 * if the user has no custom deck left for that pair.
 *
 * Returns the deck it created, or null when one already existed.
 */
export async function ensureDefaultDeck(
  userId: string,
  nativeLang: string,
  foreignLang: string,
): Promise<DeckRecord | null> {
  if (nativeLang === foreignLang) {
    return null;
  }

  const [existing] = await db
    .select({ id: decks.id })
    .from(decks)
    .where(
      and(
        eq(decks.kind, "custom"),
        eq(decks.ownerUserId, userId),
        eq(decks.nativeLang, nativeLang),
        eq(decks.foreignLang, foreignLang),
      ),
    )
    .limit(1);

  if (existing) {
    return null;
  }

  const words = await starterWords(nativeLang, foreignLang);
  const created = await createCustomDeck(userId, {
    name: STARTER_DECK_NAMES[nativeLang] ?? STARTER_DECK_NAMES.en,
    nativeLang,
    foreignLang,
    words,
  });

  return created;
}

/**
 * The easiest words the corpus has for a pair, in a stable order.
 *
 * A1 first so the starter deck is approachable; ordering by concept key rather
 * than at random keeps the deck reproducible and its levels stable. Returns an
 * empty list for pairs the corpus does not cover, which still yields a usable
 * (if empty) deck for the user to fill in the editor.
 */
async function starterWords(
  nativeLang: string,
  foreignLang: string,
): Promise<Array<{ conceptId: string; native: string; foreign: string }>> {
  const nativeSide = alias(conceptTranslations, "starter_native_side");
  const foreignSide = alias(conceptTranslations, "starter_foreign_side");

  const rows = await db
    .select({
      conceptId: wordConcepts.id,
      native: nativeSide.text,
      foreign: foreignSide.text,
    })
    .from(wordConcepts)
    .innerJoin(
      nativeSide,
      and(
        eq(nativeSide.conceptId, wordConcepts.id),
        eq(nativeSide.lang, nativeLang),
      ),
    )
    .innerJoin(
      foreignSide,
      and(
        eq(foreignSide.conceptId, wordConcepts.id),
        eq(foreignSide.lang, foreignLang),
        eq(foreignSide.level, "A1"),
      ),
    )
    .orderBy(asc(wordConcepts.conceptKey))
    .limit(STARTER_DECK_WORD_COUNT);

  return rows;
}

/**
 * Fetches a single deck with its words if the user is allowed to see it
 * (a topic deck, a custom deck they own, or one shared with them). Returns
 * null otherwise.
 */
export async function getDeckForUser(
  deckId: string,
  userId: string,
): Promise<DeckWithWords | null> {
  const [row] = await selectDecksWithAccess(userId)
    .where(
      and(
        eq(decks.id, deckId),
        or(
          eq(decks.kind, "topic"),
          eq(decks.ownerUserId, userId),
          isNotNull(deckMembers.id),
        ),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  const words = await loadWords(row.deck.id);
  return {
    ...toDeckRecord(
      row.deck,
      words.length,
      { known: 0, cleared: 0 },
      accessOf(row, userId),
    ),
    words,
  };
}

/**
 * Looks up a topic deck by its stable key + foreign language, optionally
 * narrowed to a native language. Omitting `nativeLang` returns whichever
 * variant exists, which keeps callers that only know the target working.
 */
export async function getTopicDeck(
  topicKey: string,
  foreignLang: string,
  nativeLang?: string,
): Promise<DeckWithWords | null> {
  const [row] = await db
    .select()
    .from(decks)
    .where(
      and(
        eq(decks.kind, "topic"),
        eq(decks.topicKey, topicKey),
        eq(decks.foreignLang, foreignLang),
        ...(nativeLang ? [eq(decks.nativeLang, nativeLang)] : []),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  const words = await loadWords(row.id);
  return { ...toDeckRecord(row, words.length), words };
}

export interface CreateDeckInput {
  name: string;
  nativeLang: string;
  foreignLang: string;
  words?: WordInput[];
}

export async function createCustomDeck(
  userId: string,
  input: CreateDeckInput,
): Promise<DeckWithWords> {
  const [deck] = await db
    .insert(decks)
    .values({
      ownerUserId: userId,
      kind: "custom",
      topicKey: null,
      name: input.name,
      nativeLang: input.nativeLang,
      foreignLang: input.foreignLang,
    })
    .returning();

  const { words } = await prepareWords(
    input.words ?? [],
    input.nativeLang,
    input.foreignLang,
  );
  if (words.length > 0) {
    await db.insert(deckWords).values(
      words.map((word, index) => ({
        deckId: deck.id,
        conceptId: word.conceptId ?? null,
        native: word.native,
        foreign: word.foreign,
        orderIndex: index,
      })),
    );
  }

  const created = await loadWords(deck.id);
  return { ...toDeckRecord(deck, created.length), words: created };
}

/**
 * The user's role on a custom deck, or null when they have no access to it
 * (or it is a topic deck, which nobody owns).
 */
export async function getDeckRole(
  userId: string,
  deckId: string,
): Promise<DeckRole | null> {
  const [row] = await db
    .select({ ownerUserId: decks.ownerUserId, memberRole: deckMembers.role })
    .from(decks)
    .leftJoin(
      deckMembers,
      and(eq(deckMembers.deckId, decks.id), eq(deckMembers.userId, userId)),
    )
    .where(and(eq(decks.id, deckId), eq(decks.kind, "custom")))
    .limit(1);

  if (!row) {
    return null;
  }
  if (row.ownerUserId === userId) {
    return "owner";
  }
  return row.memberRole === null ? null : toDeckRole(row.memberRole);
}

/** Confirms the deck exists and is a custom deck owned by the user. */
async function assertOwnedDeck(
  userId: string,
  deckId: string,
): Promise<boolean> {
  return (await getDeckRole(userId, deckId)) === "owner";
}

/** Owner or someone who joined through an edit link. */
async function assertEditableDeck(
  userId: string,
  deckId: string,
): Promise<boolean> {
  const role = await getDeckRole(userId, deckId);
  return role === "owner" || role === "editor";
}

export interface UpdateDeckInput {
  name?: string;
  nativeLang?: string;
  foreignLang?: string;
}

export async function updateCustomDeck(
  userId: string,
  deckId: string,
  input: UpdateDeckInput,
): Promise<DeckWithWords | null> {
  const role = await getDeckRole(userId, deckId);
  if (role !== "owner" && role !== "editor") {
    return null;
  }

  // The language pair decides which words the deck can even hold and which
  // progress rows it matches, so only the owner may move it. Editors change
  // the name and the words.
  const isOwner = role === "owner";

  await db
    .update(decks)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(isOwner && input.nativeLang !== undefined
        ? { nativeLang: input.nativeLang }
        : {}),
      ...(isOwner && input.foreignLang !== undefined
        ? { foreignLang: input.foreignLang }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(decks.id, deckId));

  return getDeckForUser(deckId, userId);
}

export async function deleteCustomDeck(
  userId: string,
  deckId: string,
): Promise<boolean> {
  if (!(await assertOwnedDeck(userId, deckId))) {
    return false;
  }

  await db.delete(decks).where(eq(decks.id, deckId));
  return true;
}

/**
 * Syncs a custom deck's word list against what's stored (used by the
 * editor's Save). Words matched by id with unchanged text keep their row
 * (and therefore their `user_word_stats` progress) untouched; words that no
 * longer appear are deleted; new words are inserted. A word whose id matches
 * but whose text changed is treated as removed-then-reinserted, so editing a
 * word starts its practice over — the new text is a different vocabulary item.
 *
 * Deleting the row no longer deletes the stats with it: progress hangs off the
 * word's identity now, and the same word may well be sitting in another deck.
 * The old row's stats simply stop pointing at a deck word.
 */
export async function syncDeckWords(
  userId: string,
  deckId: string,
  words: WordInput[],
): Promise<DeckWithWords | null> {
  const deck = await getDeckForUser(deckId, userId);
  if (!deck || !(await assertEditableDeck(userId, deckId))) {
    return null;
  }

  // Resolves each word against the corpus (so hand-typed words share progress
  // with the packs) and drops repeats before anything is written.
  const { words: prepared } = await prepareWords(
    words,
    deck.nativeLang,
    deck.foreignLang,
  );

  const existing = await db
    .select({
      id: deckWords.id,
      conceptId: deckWords.conceptId,
      native: deckWords.native,
      foreign: deckWords.foreign,
    })
    .from(deckWords)
    .where(eq(deckWords.deckId, deckId));

  const existingById = new Map(existing.map((row) => [row.id, row]));

  const unchangedIds = new Set<string>();
  const orderUpdates: {
    id: string;
    orderIndex: number;
    conceptId?: string | null;
  }[] = [];
  const toInsert: {
    deckId: string;
    conceptId: string | null;
    native: string;
    foreign: string;
    orderIndex: number;
  }[] = [];

  prepared.forEach((word, index) => {
    const native = word.native;
    const foreign = word.foreign;
    const match = word.id ? existingById.get(word.id) : undefined;

    if (match && match.native === native && match.foreign === foreign) {
      unchangedIds.add(match.id);
      orderUpdates.push({
        id: match.id,
        orderIndex: index,
        // A row kept from before the corpus link existed picks it up here, which
        // is what lets it start sharing progress with the packs.
        ...(match.conceptId !== (word.conceptId ?? null)
          ? { conceptId: word.conceptId ?? null }
          : {}),
      });
    } else {
      toInsert.push({
        deckId,
        conceptId: word.conceptId ?? null,
        native,
        foreign,
        orderIndex: index,
      });
    }
  });

  // Rows not carried over unchanged: either edited (replaced below with a
  // fresh row) or actually removed. Either way the old row—and its cascaded
  // stats—goes away.
  const idsToDelete = existing
    .map((row) => row.id)
    .filter((id) => !unchangedIds.has(id));

  if (idsToDelete.length > 0) {
    await db.delete(deckWords).where(inArray(deckWords.id, idsToDelete));
  }

  if (toInsert.length > 0) {
    await db.insert(deckWords).values(toInsert);
  }

  for (const update of orderUpdates) {
    await db
      .update(deckWords)
      .set({
        orderIndex: update.orderIndex,
        ...(update.conceptId !== undefined
          ? { conceptId: update.conceptId }
          : {}),
      })
      .where(eq(deckWords.id, update.id));
  }

  await db
    .update(decks)
    .set({ updatedAt: new Date() })
    .where(eq(decks.id, deckId));

  return getDeckForUser(deckId, userId);
}

/** Marks a custom deck as just practiced (bumps updatedAt). */
export async function touchDeck(
  userId: string,
  deckId: string,
): Promise<void> {
  await db
    .update(decks)
    .set({ updatedAt: new Date() })
    .where(and(eq(decks.id, deckId), eq(decks.ownerUserId, userId)));
}
