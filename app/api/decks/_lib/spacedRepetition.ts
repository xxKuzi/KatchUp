import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  conceptTranslations,
  deckWords,
  userDeckWordClears,
  userWordStats,
} from "@/db/schema";
import { normalizeLang, type Lang } from "@/app/_lib/languages";
import { getTranslationsForConcepts } from "@/app/api/words/_lib/wordPool";
import {
  DeckWithWords,
  DeckWordRecord,
  getDeckForUser,
} from "./deckStore";
import { buildVocabIdentity, type VocabIdentity } from "./vocabIdentity";
import {
  buildSummary,
  chooseSessionWords,
  clampSteps,
  DEFAULT_PRACTICE_SIZE,
  KNOWN_STREAK_THRESHOLD,
  levelWindow,
  MAX_BOX,
  shuffle,
  TOPIC_LEVEL_COUNT,
  type DeckProgressSummary,
  type SessionMode,
  type WordStatSummary,
} from "@/app/_lib/sessionSelection";

// Which words a round serves, and what one answer does to a word's history,
// live in app/_lib/sessionSelection.ts — the browser has to make the same
// choices for a deck downloaded for offline use. Everything below is the part
// that genuinely needs the database.
export {
  DEFAULT_FINISH_SIZE,
  DEFAULT_PRACTICE_SIZE,
  KNOWN_STREAK_THRESHOLD,
  LEGENDARY_REVIEW_SIZE,
  MAX_BOX,
  REVIEW_REFRESH_SIZE,
  TOPIC_LEVEL_COUNT,
} from "@/app/_lib/sessionSelection";
export type {
  DeckProgressSummary,
  SessionMode,
  WordStatSummary,
} from "@/app/_lib/sessionSelection";

type StatRow = typeof userWordStats.$inferSelect;

export interface SessionWord extends DeckWordRecord {
  stat: WordStatSummary | null;
}

export interface SessionResult {
  deckId: string;
  deckName: string;
  mode: SessionMode;
  /** Topic level this session was scoped to, or null for the whole deck. */
  level: number | null;
  words: SessionWord[];
  /** Progress over the session's scope — the level window when one is given. */
  summary: DeckProgressSummary;
  nativeLang: string;
  foreignLang: string;
}

/**
 * Everything a deck needs to be practised without a network: the whole word
 * list in seed order, each word's history, and the language pair.
 *
 * Unlike a session this holds back nothing — the browser picks its own rounds
 * out of it, using the same `chooseSessionWords` the server would have.
 */
export interface DeckSnapshot {
  deckId: string;
  deckName: string;
  nativeLang: string;
  foreignLang: string;
  words: SessionWord[];
  summary: DeckProgressSummary;
  generatedAt: string;
}

/**
 * A deck word with its history already flattened into the shared wire shape, so
 * `sessionSelection` can sort it the same way the browser does.
 */
interface EnrichedWord {
  word: DeckWordRecord;
  stat: WordStatSummary | null;
}

function summarizeStat(stat: StatRow | null): WordStatSummary | null {
  if (!stat) {
    return null;
  }
  return {
    box: stat.box,
    streak: stat.streak,
    timesSeen: stat.timesSeen,
    timesCorrect: stat.timesCorrect,
    timesWrong: stat.timesWrong,
    known: stat.known,
    lastSeenAt: stat.lastSeenAt ? stat.lastSeenAt.toISOString() : null,
  };
}

function presentWord(entry: EnrichedWord): SessionWord {
  return {
    id: entry.word.id,
    conceptId: entry.word.conceptId,
    native: entry.word.native,
    foreign: entry.word.foreign,
    article: entry.word.article,
    orderIndex: entry.word.orderIndex,
    stat: entry.stat,
  };
}

/**
 * Which of several stat rows for one identity to believe.
 *
 * Until the duplicates are merged, the same word practised in two decks still
 * has two rows. Mastery wins first — a word the user has proven they know must
 * not be dragged back by a copy they barely touched — then the higher box, then
 * whichever was practised most recently.
 */
function preferStat(a: StatRow, b: StatRow): StatRow {
  if (a.known !== b.known) {
    return a.known ? a : b;
  }
  if (a.box !== b.box) {
    return a.box > b.box ? a : b;
  }
  return a.updatedAt >= b.updatedAt ? a : b;
}

async function enrichDeck(
  userId: string,
  deck: DeckWithWords,
): Promise<EnrichedWord[]> {
  const wordIds = deck.words.map((word) => word.id);
  if (wordIds.length === 0) {
    return [];
  }

  // Identity lookup, so a word mastered in another deck arrives already known
  // rather than being drilled again from box zero.
  const identities = new Map<string, VocabIdentity | null>(
    deck.words.map((word) => [word.id, deckWordIdentity(deck, word)]),
  );
  const vocabKeys = [...identities.values()]
    .filter((identity): identity is VocabIdentity => Boolean(identity))
    .map((identity) => identity.vocabKey);

  const [sample] = [...identities.values()].filter(Boolean) as VocabIdentity[];

  // Decks whose languages are unrecognisable have no identity to look up; they
  // fall back to the deck-word key they have always used.
  const stats = sample
    ? await db
        .select()
        .from(userWordStats)
        .where(
          and(
            eq(userWordStats.userId, userId),
            eq(userWordStats.nativeLang, sample.nativeLang),
            eq(userWordStats.foreignLang, sample.foreignLang),
            inArray(userWordStats.vocabKey, vocabKeys),
          ),
        )
    : await db
        .select()
        .from(userWordStats)
        .where(
          and(
            eq(userWordStats.userId, userId),
            inArray(userWordStats.deckWordId, wordIds),
          ),
        );

  const statByKey = new Map<string, StatRow>();
  for (const stat of stats) {
    const key = stat.vocabKey ?? "";
    const existing = statByKey.get(key);
    statByKey.set(key, existing ? preferStat(existing, stat) : stat);
  }

  const statByWord = new Map(
    deck.words.map((word) => {
      const identity = identities.get(word.id);
      const stat = identity
        ? (statByKey.get(identity.vocabKey) ?? null)
        : (stats.find((row) => row.deckWordId === word.id) ?? null);
      return [word.id, stat] as const;
    }),
  );
  return deck.words.map((word) => ({
    word,
    stat: summarizeStat(statByWord.get(word.id) ?? null),
  }));
}

export interface SelectOptions {
  mode?: SessionMode;
  size?: number;
  /** Topic level 1..TOPIC_LEVEL_COUNT; omit to draw from the whole deck. */
  level?: number;
}

/**
 * Picks the words for a practice session. The choosing itself is
 * `chooseSessionWords`, shared with the offline path; this reads the deck and
 * the stats it needs. Passing a `level` narrows both the pool and the summary to
 * that level's slice. Returns null if the deck is not accessible to the user.
 */
export async function selectSessionWords(
  userId: string,
  deckId: string,
  options: SelectOptions = {},
): Promise<SessionResult | null> {
  const deck = await getDeckForUser(deckId, userId);
  if (!deck) {
    return null;
  }

  const enriched = levelWindow(await enrichDeck(userId, deck), options.level);
  const summary = buildSummary(enriched);
  const mode: SessionMode = options.mode === "finish" ? "finish" : "practice";
  const chosen = chooseSessionWords(enriched, { mode, size: options.size });

  return {
    deckId: deck.id,
    deckName: deck.name,
    mode,
    level: options.level ?? null,
    words: chosen.map(presentWord),
    summary,
    nativeLang: deck.nativeLang,
    foreignLang: deck.foreignLang,
  };
}

/**
 * The whole deck, with stats, for downloading to a device. Returns null if the
 * deck is not accessible to the user.
 */
export async function getDeckSnapshot(
  userId: string,
  deckId: string,
): Promise<DeckSnapshot | null> {
  const deck = await getDeckForUser(deckId, userId);
  if (!deck) {
    return null;
  }

  const enriched = await enrichDeck(userId, deck);

  return {
    deckId: deck.id,
    deckName: deck.name,
    nativeLang: deck.nativeLang,
    foreignLang: deck.foreignLang,
    // Seed order, because the level windows are cut out of exactly this order.
    words: [...enriched]
      .sort((a, b) => a.word.orderIndex - b.word.orderIndex)
      .map(presentWord),
    summary: buildSummary(enriched),
    generatedAt: new Date().toISOString(),
  };
}

export interface AttemptInput {
  deckWordId: string;
  correct: boolean;
  /**
   * How much of the streak toward `known` one correct answer is worth. Defaults
   * to 1. Swiping a flip card right is a stronger claim than picking one of
   * three options, so it counts double and two swipes reach mastery — it used to
   * declare the word known outright, on evidence nothing had tested.
   */
  steps?: number;
}

/**
 * The identity of a word as it sits in a deck.
 *
 * Returns null when the deck's languages are not recognisable — those rows keep
 * working on the deck-word key alone rather than being given a wrong identity.
 */
function deckWordIdentity(
  deck: DeckWithWords,
  word: DeckWordRecord,
): VocabIdentity | null {
  const nativeLang = normalizeLang(deck.nativeLang);
  const foreignLang = normalizeLang(deck.foreignLang);
  if (!nativeLang || !foreignLang) {
    return null;
  }

  return buildVocabIdentity({
    conceptId: word.conceptId,
    nativeLang,
    foreignLang,
    nativeText: word.native,
    foreignText: word.foreign,
  });
}

/** One answer in a game played outside any deck. */
export interface ConceptAttemptInput {
  conceptId: string;
  correct: boolean;
  steps?: number;
}

/**
 * Which vocabulary item an attempt is about, and which deck row it came from.
 *
 * The identity is what the stats are really keyed on; `deckWordId` rides along
 * as provenance so the learned-words list can still name a deck.
 */
export interface AttemptTarget {
  deckWordId: string | null;
  identity: VocabIdentity | null;
}

/** The identity columns, written on both insert and conflict. */
function identityColumns(identity: VocabIdentity | null) {
  if (!identity) {
    return {};
  }
  return {
    conceptId: identity.conceptId,
    nativeLang: identity.nativeLang,
    foreignLang: identity.foreignLang,
    nativeKey: identity.nativeKey,
    foreignKey: identity.foreignKey,
    vocabKey: identity.vocabKey,
    nativeText: identity.nativeText,
    foreignText: identity.foreignText,
  };
}

async function applyAttempt(
  userId: string,
  { deckWordId, identity }: AttemptTarget,
  correct: boolean,
  rawSteps?: number,
): Promise<void> {
  // Nothing to key the row on. Only reachable for a deck in a language outside
  // the four the app supports, which no UI path can create.
  if (!identity) {
    return;
  }

  const now = new Date();
  // The identity, not the deck word: answering "wash" in one pack must land on
  // the same row as answering it in another.
  const target = [
    userWordStats.userId,
    userWordStats.nativeLang,
    userWordStats.foreignLang,
    userWordStats.vocabKey,
  ] as const;
  const identityValues = identityColumns(identity);

  if (correct) {
    // Steps measure how confident one answer was, so they move the streak but
    // not the counts of how many times the word has been seen or answered.
    const steps = clampSteps(rawSteps);

    await db
      .insert(userWordStats)
      .values({
        userId,
        deckWordId,
        ...identityValues,
        box: 1,
        streak: steps,
        timesSeen: 1,
        timesCorrect: 1,
        timesWrong: 0,
        // Never on a first answer: `clampSteps` keeps one attempt below the
        // threshold, so mastery always takes at least two.
        known: false,
        lastSeenAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [...target],
        set: {
          ...identityValues,
          streak: sql`${userWordStats.streak} + ${steps}`,
          box: sql`LEAST(${userWordStats.box} + 1, ${MAX_BOX})`,
          timesSeen: sql`${userWordStats.timesSeen} + 1`,
          timesCorrect: sql`${userWordStats.timesCorrect} + 1`,
          known: sql`((${userWordStats.streak} + ${steps}) >= ${KNOWN_STREAK_THRESHOLD}) OR ${userWordStats.known}`,
          lastSeenAt: now,
          updatedAt: now,
        },
      });
    return;
  }

  // Wrong answer: step the streak back one, drop a box, and un-know the word so
  // it resurfaces. The streak used to reset to zero, which threw away two clean
  // rounds for one slip and left words stuck at 0 however often they came up.
  await db
    .insert(userWordStats)
    .values({
      userId,
      deckWordId,
      ...identityValues,
      box: 0,
      streak: 0,
      timesSeen: 1,
      timesCorrect: 0,
      timesWrong: 1,
      known: false,
      lastSeenAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [...target],
      set: {
        ...identityValues,
        streak: sql`GREATEST(${userWordStats.streak} - 1, 0)`,
        box: sql`GREATEST(${userWordStats.box} - 1, 0)`,
        timesSeen: sql`${userWordStats.timesSeen} + 1`,
        timesWrong: sql`${userWordStats.timesWrong} + 1`,
        known: false,
        lastSeenAt: now,
        updatedAt: now,
      },
    });
}

async function applyAttemptsBatch(
  userId: string,
  targets: {
    deckWordId: string | null;
    identity: AttemptTarget["identity"];
    correct: boolean;
    steps?: number;
  }[],
): Promise<void> {
  const validTargets = targets.filter(
    (t) => t.identity !== null && t.identity !== undefined,
  );
  if (validTargets.length === 0) return;

  const now = new Date();
  const rows = validTargets.map((t) => {
    const identityValues = identityColumns(t.identity);
    const steps = t.correct ? clampSteps(t.steps) : 0;
    return {
      userId,
      deckWordId: t.deckWordId,
      ...identityValues,
      box: t.correct ? 1 : 0,
      streak: t.correct ? steps : 0,
      timesSeen: 1,
      timesCorrect: t.correct ? 1 : 0,
      timesWrong: t.correct ? 0 : 1,
      known: false,
      lastSeenAt: now,
      updatedAt: now,
    };
  });

  await db
    .insert(userWordStats)
    .values(rows)
    .onConflictDoUpdate({
      target: [
        userWordStats.userId,
        userWordStats.nativeLang,
        userWordStats.foreignLang,
        userWordStats.vocabKey,
      ],
      set: {
        streak: sql`CASE 
          WHEN excluded.box > 0 THEN ${userWordStats.streak} + excluded.streak 
          ELSE GREATEST(${userWordStats.streak} - 1, 0) 
        END`,
        box: sql`CASE 
          WHEN excluded.box > 0 THEN LEAST(${userWordStats.box} + 1, ${MAX_BOX}) 
          ELSE GREATEST(${userWordStats.box} - 1, 0) 
        END`,
        timesSeen: sql`${userWordStats.timesSeen} + 1`,
        timesCorrect: sql`${userWordStats.timesCorrect} + excluded.times_correct`,
        timesWrong: sql`${userWordStats.timesWrong} + excluded.times_wrong`,
        known: sql`CASE 
          WHEN excluded.box > 0 THEN ((${userWordStats.streak} + excluded.streak) >= ${KNOWN_STREAK_THRESHOLD}) OR ${userWordStats.known} 
          ELSE false 
        END`,
        lastSeenAt: sql`excluded.last_seen_at`,
        updatedAt: sql`excluded.updated_at`,
      },
    });
}

/**
 * Records the results of a session. Only attempts for words that actually
 * belong to a deck the user can access are applied. Returns null if the deck
 * is not accessible.
 */
export async function recordAttempts(
  userId: string,
  deckId: string,
  attempts: AttemptInput[],
): Promise<{ recorded: number } | null> {
  const deck = await getDeckForUser(deckId, userId);
  if (!deck) {
    return null;
  }

  const wordsById = new Map(deck.words.map((word) => [word.id, word]));
  const valid = attempts.filter((attempt) => wordsById.has(attempt.deckWordId));

  const batchTargets = valid.map((attempt) => ({
    deckWordId: attempt.deckWordId,
    identity: deckWordIdentity(deck, wordsById.get(attempt.deckWordId)!),
    correct: attempt.correct,
    steps: attempt.steps,
  }));

  await applyAttemptsBatch(userId, batchTargets);

  // Deck-scoped record of what was answered *here*, which is what the topic
  // ladder reads. Only deck rounds reach this, so free play can share a word's
  // mastery without ever clearing a pack level or minting a key.
  const correct = valid.filter((attempt) => attempt.correct);
  if (correct.length > 0) {
    const now = new Date();
    await db
      .insert(userDeckWordClears)
      .values(
        correct.map((attempt) => ({
          userId,
          deckWordId: attempt.deckWordId,
          timesCorrect: 1,
          updatedAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: [userDeckWordClears.userId, userDeckWordClears.deckWordId],
        set: {
          timesCorrect: sql`${userDeckWordClears.timesCorrect} + 1`,
          updatedAt: now,
        },
      });
  }

  return { recorded: valid.length };
}

/**
 * Records attempts made outside any deck — the games reached from the hub,
 * which until now taught the app nothing.
 *
 * Takes concept ids only, never free text: the texts are read from the corpus
 * here rather than trusted from the request, so nobody can mint arbitrary
 * "known" rows and inflate their level. Words with no deck get no
 * `deck_word_id`, which is exactly what that column being nullable is for.
 *
 * Deliberately does not touch `user_deck_word_clears`: free play shares a word's
 * mastery, but topic levels and their keys stay earned inside the pack.
 */
export async function recordConceptAttempts(
  userId: string,
  nativeLang: Lang,
  foreignLang: Lang,
  attempts: ConceptAttemptInput[],
): Promise<{ recorded: number }> {
  if (nativeLang === foreignLang || attempts.length === 0) {
    return { recorded: 0 };
  }

  const conceptIds = [...new Set(attempts.map((attempt) => attempt.conceptId))];
  const [nativeTexts, foreignTexts] = await Promise.all([
    getTranslationsForConcepts(conceptIds, nativeLang),
    getTranslationsForConcepts(conceptIds, foreignLang),
  ]);

  const batchTargets = attempts
    .map((attempt) => {
      const nativeText = nativeTexts.get(attempt.conceptId);
      const foreignText = foreignTexts.get(attempt.conceptId);
      if (!nativeText || !foreignText) {
        return null;
      }
      return {
        deckWordId: null,
        identity: buildVocabIdentity({
          conceptId: attempt.conceptId,
          nativeLang,
          foreignLang,
          nativeText,
          foreignText,
        }),
        correct: attempt.correct,
        steps: attempt.steps,
      };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);

  await applyAttemptsBatch(userId, batchTargets);

  return { recorded: batchTargets.length };
}

/** Manual "I already know this" / "actually, keep testing me" toggle. */
export async function setWordKnown(
  userId: string,
  deckId: string,
  deckWordId: string,
  known: boolean,
): Promise<{ ok: boolean } | null> {
  const deck = await getDeckForUser(deckId, userId);
  const word = deck?.words.find((entry) => entry.id === deckWordId);
  if (!deck || !word) {
    return null;
  }

  const identity = deckWordIdentity(deck, word);
  if (!identity) {
    return { ok: true };
  }

  const now = new Date();
  const identityValues = identityColumns(identity);
  await db
    .insert(userWordStats)
    .values({
      userId,
      deckWordId,
      ...identityValues,
      box: known ? MAX_BOX : 0,
      streak: known ? KNOWN_STREAK_THRESHOLD : 0,
      timesSeen: 0,
      timesCorrect: 0,
      timesWrong: 0,
      known,
      lastSeenAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        userWordStats.userId,
        userWordStats.nativeLang,
        userWordStats.foreignLang,
        userWordStats.vocabKey,
      ],
      set: {
        ...identityValues,
        known,
        streak: known
          ? sql`GREATEST(${userWordStats.streak}, ${KNOWN_STREAK_THRESHOLD})`
          : sql`0`,
        updatedAt: now,
      },
    });

  return { ok: true };
}

/**
 * Lightweight progress counts for a deck, for list/finish-gating UI. Pass a
 * `level` to count only that level's slice, matching what a level's session
 * actually practices.
 */
export async function getDeckProgress(
  userId: string,
  deckId: string,
  level?: number,
): Promise<DeckProgressSummary | null> {
  const deck = await getDeckForUser(deckId, userId);
  if (!deck) {
    return null;
  }
  return buildSummary(levelWindow(await enrichDeck(userId, deck), level));
}

/**
 * Progress for every topic level of a deck, from a single deck read.
 *
 * The topic page needs all five at once to tell a mastered level from a merely
 * played one; asking `getDeckProgress` five times would re-read the same deck
 * and stats five times over.
 */
export async function getDeckLevelProgress(
  userId: string,
  deckId: string,
): Promise<DeckProgressSummary[] | null> {
  const deck = await getDeckForUser(deckId, userId);
  if (!deck) {
    return null;
  }

  const enriched = await enrichDeck(userId, deck);

  return Array.from({ length: TOPIC_LEVEL_COUNT }, (_, index) =>
    buildSummary(levelWindow(enriched, index + 1)),
  );
}

/**
 * Counts the user's known words for a language they're learning. Drives the
 * navbar's CEFR-style level badge.
 *
 * Counts *vocabulary*, not stat rows: the same word mastered in two decks used
 * to count twice, inflating the level. Distinct on the concept where there is
 * one and on the normalised foreign text otherwise, which also folds together a
 * word learned under two different native languages — the difficulty being
 * measured belongs to the language being learned.
 *
 * The language is read off the stat row rather than the deck, so it is already
 * canonical ("de", never "german") and words with no deck still count.
 */
export async function countKnownWordsForLanguage(
  userId: string,
  language: string,
): Promise<number> {
  const canonical = normalizeLang(language) ?? language.toLowerCase();

  const [row] = await db
    .select({
      count: sql<number>`count(distinct coalesce(${userWordStats.conceptId}::text, ${userWordStats.foreignKey}))::int`,
    })
    .from(userWordStats)
    .where(
      and(
        eq(userWordStats.userId, userId),
        eq(userWordStats.known, true),
        eq(userWordStats.foreignLang, canonical),
      ),
    );

  return Number(row?.count ?? 0);
}

/**
 * Whether this user has ever answered anything in a language.
 *
 * Not the same question as "has mastered any words in it": one attempt leaves a
 * row behind whether it was right or wrong. That is what makes it the right
 * guard for the placement test, which is offered once and must not be
 * re-sittable — a ten-question multiple choice retried until it passes is not a
 * test of anything.
 */
export async function hasAnyWordStatsForLanguage(
  userId: string,
  language: string,
): Promise<boolean> {
  const canonical = normalizeLang(language) ?? language.toLowerCase();

  const [row] = await db
    .select({ exists: sql<number>`1` })
    .from(userWordStats)
    .where(
      and(
        eq(userWordStats.userId, userId),
        eq(userWordStats.foreignLang, canonical),
      ),
    )
    .limit(1);

  return Boolean(row);
}

/**
 * Returns a randomised set of the user's **known** words.
 * Used for the Navbar "practice for energy" feature so the user reviews words
 * they've already mastered (and each round is different).
 *
 * Reads the texts off the stat row rather than joining a deck word, so a word
 * survives the deck it was learned in being edited or deleted. Rows are keyed by
 * identity, so a word mastered in two decks appears once rather than twice.
 */
export async function selectKnownWordsForReview(
  userId: string,
  size = DEFAULT_PRACTICE_SIZE,
): Promise<SessionWord[]> {
  const rows = await db
    .select({
      id: userWordStats.id,
      deckWordId: userWordStats.deckWordId,
      conceptId: userWordStats.conceptId,
      vocabKey: userWordStats.vocabKey,
      native: userWordStats.nativeText,
      foreign: userWordStats.foreignText,
      // A stat row stores the two texts and nothing else, so the article has to
      // come back from somewhere. The deck word is preferred where the stat
      // still points at one — it is the only place a user's own choice on a
      // free-text word is recorded — and the corpus is the fallback that covers
      // rows whose deck word has since been deleted.
      deckArticle: deckWords.article,
      conceptArticle: conceptTranslations.article,
      box: userWordStats.box,
      streak: userWordStats.streak,
      timesSeen: userWordStats.timesSeen,
      timesCorrect: userWordStats.timesCorrect,
      timesWrong: userWordStats.timesWrong,
      known: userWordStats.known,
      lastSeenAt: userWordStats.lastSeenAt,
    })
    .from(userWordStats)
    .leftJoin(deckWords, eq(deckWords.id, userWordStats.deckWordId))
    // Scoped by language as well as by concept: a concept carries a translation
    // per language, and an unscoped join would hand a German round the Spanish
    // article — or three rows where one was wanted.
    .leftJoin(
      conceptTranslations,
      and(
        eq(conceptTranslations.conceptId, userWordStats.conceptId),
        eq(conceptTranslations.lang, userWordStats.foreignLang),
      ),
    )
    .where(and(eq(userWordStats.userId, userId), eq(userWordStats.known, true)));

  const seen = new Set<string>();
  const mapped: SessionWord[] = [];

  for (const row of rows) {
    // Rows written before the identity columns existed have no texts to show.
    if (!row.native || !row.foreign) {
      continue;
    }
    const key = row.vocabKey ?? row.id;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    mapped.push({
      // Still the deck word where there is one: the round posts results back on
      // this id, and only a deck word can take them today.
      id: row.deckWordId ?? row.id,
      conceptId: row.conceptId,
      native: row.native,
      foreign: row.foreign,
      article: row.deckArticle ?? row.conceptArticle ?? null,
      orderIndex: 0,
      stat: {
        box: row.box,
        streak: row.streak,
        timesSeen: row.timesSeen,
        timesCorrect: row.timesCorrect,
        timesWrong: row.timesWrong,
        known: row.known,
        lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null,
      },
    });
  }

  return shuffle(mapped).slice(0, size);
}
