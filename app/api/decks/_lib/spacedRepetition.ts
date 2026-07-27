import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { userDeckWordClears, userWordStats } from "@/db/schema";
import { normalizeLang, type Lang } from "@/app/_lib/languages";
import { getTranslationsForConcepts } from "@/app/api/words/_lib/wordPool";
import {
  DeckWithWords,
  DeckWordRecord,
  getDeckForUser,
} from "./deckStore";
import { buildVocabIdentity, type VocabIdentity } from "./vocabIdentity";

// A word is "known" after this many correct answers in a row (or a manual tap).
export const KNOWN_STREAK_THRESHOLD = 3;
// Leitner box ceiling; box rises on correct, drops on wrong. Presentational.
export const MAX_BOX = 5;
export const DEFAULT_PRACTICE_SIZE = 10;
export const DEFAULT_FINISH_SIZE = 20;
/**
 * The legendary round: every word still unlearned, hardest first, topped up from
 * the rest of the pack to a full thirty. Clearing it is what turns a finished
 * topic legendary.
 */
export const LEGENDARY_REVIEW_SIZE = 30;
/**
 * What a review round serves once nothing is left unlearned. The round used to
 * come back empty there, which made the review button look broken on exactly the
 * decks that had been played the most.
 */
export const REVIEW_REFRESH_SIZE = 15;
// Levels a topic is split into. Mirrors the 5 levels the topics UI renders.
export const TOPIC_LEVEL_COUNT = 5;

export type SessionMode = "practice" | "finish";

type StatRow = typeof userWordStats.$inferSelect;

export interface WordStatSummary {
  box: number;
  streak: number;
  timesSeen: number;
  timesCorrect: number;
  timesWrong: number;
  known: boolean;
  lastSeenAt: string | null;
}

export interface SessionWord extends DeckWordRecord {
  stat: WordStatSummary | null;
}

export interface DeckProgressSummary {
  total: number;
  known: number;
  learning: number; // seen at least once, not yet known
  unseen: number;
  /**
   * Answered right at least once — "you have met this word", the bar a topic
   * level clears on. `known` is the stricter tier above it and counts here too:
   * needing three clean rounds to finish a level meant a correct answer moved
   * nothing on screen.
   */
  cleared: number;
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
}

interface EnrichedWord {
  word: DeckWordRecord;
  stat: StatRow | null;
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
    orderIndex: entry.word.orderIndex,
    stat: summarizeStat(entry.stat),
  };
}

function seenCount(entry: EnrichedWord): number {
  return entry.stat?.timesSeen ?? 0;
}

// Higher = show sooner. Never-seen win, then most-failed, then least-recently
// seen, then lowest streak (furthest from becoming known).
function comparePracticePriority(a: EnrichedWord, b: EnrichedWord): number {
  const aNew = seenCount(a) === 0;
  const bNew = seenCount(b) === 0;
  if (aNew !== bNew) {
    return aNew ? -1 : 1;
  }

  const difficultyA = (a.stat?.timesWrong ?? 0) - (a.stat?.timesCorrect ?? 0);
  const difficultyB = (b.stat?.timesWrong ?? 0) - (b.stat?.timesCorrect ?? 0);
  if (difficultyA !== difficultyB) {
    return difficultyB - difficultyA;
  }

  const seenA = a.stat?.lastSeenAt ? a.stat.lastSeenAt.getTime() : 0;
  const seenB = b.stat?.lastSeenAt ? b.stat.lastSeenAt.getTime() : 0;
  if (seenA !== seenB) {
    return seenA - seenB;
  }

  return (a.stat?.streak ?? 0) - (b.stat?.streak ?? 0);
}

// Finish round: worst accuracy first, then most wrong answers.
function compareHardest(a: EnrichedWord, b: EnrichedWord): number {
  const accuracy = (entry: EnrichedWord): number => {
    const stat = entry.stat;
    if (!stat || stat.timesSeen === 0) {
      return 1;
    }
    return stat.timesCorrect / stat.timesSeen;
  };

  const diff = accuracy(a) - accuracy(b);
  if (diff !== 0) {
    return diff;
  }
  return (b.stat?.timesWrong ?? 0) - (a.stat?.timesWrong ?? 0);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildSummary(entries: EnrichedWord[]): DeckProgressSummary {
  let known = 0;
  let learning = 0;
  let unseen = 0;
  let cleared = 0;
  for (const entry of entries) {
    if (entry.stat?.known) {
      known += 1;
    } else if (seenCount(entry) > 0) {
      learning += 1;
    } else {
      unseen += 1;
    }

    if (entry.stat?.known || (entry.stat?.timesCorrect ?? 0) > 0) {
      cleared += 1;
    }
  }
  return { total: entries.length, known, learning, unseen, cleared };
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
    stat: statByWord.get(word.id) ?? null,
  }));
}

export interface SelectOptions {
  mode?: SessionMode;
  size?: number;
  /** Topic level 1..TOPIC_LEVEL_COUNT; omit to draw from the whole deck. */
  level?: number;
}

/**
 * The slice of a deck a topic level owns.
 *
 * The five levels of a topic used to share one pool, so mastering it emptied
 * every level at once. Each level now practices one consecutive window of the
 * deck in seed order, which is also why `topUpTopicDeckWords` appends rather
 * than renumbering: a word must not drift between levels.
 */
function levelWindow<T>(entries: T[], level: number | undefined): T[] {
  if (!level || entries.length === 0) {
    return entries;
  }

  const clamped = Math.min(
    Math.max(Math.floor(level), 1),
    TOPIC_LEVEL_COUNT,
  );
  const size = Math.ceil(entries.length / TOPIC_LEVEL_COUNT);
  const window = entries.slice((clamped - 1) * size, clamped * size);

  // A deck with fewer words than levels leaves later windows empty; serving the
  // whole deck beats serving an empty round.
  return window.length > 0 ? window : entries;
}

/**
 * Picks the words for a practice session. Practice mode drops known words and
 * weights the rest toward unseen / most-failed / least-recently-seen. Finish
 * mode returns the hardest previously-failed words for an end-of-deck review.
 * Passing a `level` narrows both the pool and the summary to that level's slice.
 * Returns null if the deck is not accessible to the user.
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

  let chosen: EnrichedWord[];
  if (mode === "finish") {
    const size = options.size ?? DEFAULT_FINISH_SIZE;
    // Hardest first, then whatever else is still unlearned. A review round used
    // to draw only from words already answered wrong, so a pack could be short
    // of learned words and still report nothing to review.
    const pending = [...enriched.filter((entry) => !entry.stat?.known)].sort(
      compareHardest,
    );

    if (pending.length === 0) {
      chosen = shuffle(enriched).slice(0, REVIEW_REFRESH_SIZE);
    } else {
      // Topped up from the learned words so the round is a full one — the point
      // of the legendary round is the whole pack, not only its sore spots.
      const filler = shuffle(enriched.filter((entry) => entry.stat?.known));
      chosen = shuffle([...pending, ...filler].slice(0, size));
    }
  } else {
    const size = options.size ?? DEFAULT_PRACTICE_SIZE;
    const pool = enriched.filter((entry) => !entry.stat?.known);
    pool.sort(comparePracticePriority);

    // Words already mastered elsewhere still get served once the unlearned ones
    // run out. Mastery is shared across decks now, so a pack can arrive fully
    // known before it has ever been opened — and an empty round would leave its
    // level permanently unclearable.
    if (pool.length < size) {
      const filler = shuffle(enriched.filter((entry) => entry.stat?.known));
      chosen = shuffle([...pool, ...filler].slice(0, size));
    } else {
      chosen = shuffle(pool.slice(0, size));
    }
  }

  return {
    deckId: deck.id,
    deckName: deck.name,
    mode,
    level: options.level ?? null,
    words: chosen.map(presentWord),
    summary,
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

/** Keeps a caller from handing out mastery in a single answer. */
function clampSteps(steps: number | undefined): number {
  if (typeof steps !== "number" || !Number.isFinite(steps)) {
    return 1;
  }
  return Math.min(Math.max(Math.floor(steps), 1), KNOWN_STREAK_THRESHOLD - 1);
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

  for (const attempt of valid) {
    await applyAttempt(
      userId,
      {
        deckWordId: attempt.deckWordId,
        identity: deckWordIdentity(deck, wordsById.get(attempt.deckWordId)!),
      },
      attempt.correct,
      attempt.steps,
    );
  }

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

  let recorded = 0;
  for (const attempt of attempts) {
    const nativeText = nativeTexts.get(attempt.conceptId);
    const foreignText = foreignTexts.get(attempt.conceptId);
    // A concept the corpus cannot express in both languages is not a word this
    // pair can teach, so there is nothing to record.
    if (!nativeText || !foreignText) {
      continue;
    }

    await applyAttempt(
      userId,
      {
        deckWordId: null,
        identity: buildVocabIdentity({
          conceptId: attempt.conceptId,
          nativeLang,
          foreignLang,
          nativeText,
          foreignText,
        }),
      },
      attempt.correct,
      attempt.steps,
    );
    recorded += 1;
  }

  return { recorded };
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
      box: userWordStats.box,
      streak: userWordStats.streak,
      timesSeen: userWordStats.timesSeen,
      timesCorrect: userWordStats.timesCorrect,
      timesWrong: userWordStats.timesWrong,
      known: userWordStats.known,
      lastSeenAt: userWordStats.lastSeenAt,
    })
    .from(userWordStats)
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
