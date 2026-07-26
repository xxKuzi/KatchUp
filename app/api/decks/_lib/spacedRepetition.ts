import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { deckWords, decks, userWordStats } from "@/db/schema";
import { LANG_ENGLISH_NAMES, normalizeLang } from "@/app/_lib/languages";
import {
  DeckWithWords,
  DeckWordRecord,
  getDeckForUser,
} from "./deckStore";

// A word is "known" after this many correct answers in a row (or a manual tap).
export const KNOWN_STREAK_THRESHOLD = 3;
// Leitner box ceiling; box rises on correct, drops on wrong. Presentational.
export const MAX_BOX = 5;
export const DEFAULT_PRACTICE_SIZE = 10;
export const DEFAULT_FINISH_SIZE = 20;
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

async function enrichDeck(
  userId: string,
  deck: DeckWithWords,
): Promise<EnrichedWord[]> {
  const wordIds = deck.words.map((word) => word.id);
  if (wordIds.length === 0) {
    return [];
  }

  const stats = await db
    .select()
    .from(userWordStats)
    .where(
      and(
        eq(userWordStats.userId, userId),
        inArray(userWordStats.deckWordId, wordIds),
      ),
    );

  const statByWord = new Map(stats.map((stat) => [stat.deckWordId, stat]));
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
    const failed = enriched.filter(
      (entry) => !entry.stat?.known && seenCount(entry) > 0,
    );
    failed.sort(compareHardest);
    chosen = shuffle(failed.slice(0, size));
  } else {
    const size = options.size ?? DEFAULT_PRACTICE_SIZE;
    const pool = enriched.filter((entry) => !entry.stat?.known);
    pool.sort(comparePracticePriority);
    chosen = shuffle(pool.slice(0, size));
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

/** Keeps a caller from handing out mastery in a single answer. */
function clampSteps(steps: number | undefined): number {
  if (typeof steps !== "number" || !Number.isFinite(steps)) {
    return 1;
  }
  return Math.min(Math.max(Math.floor(steps), 1), KNOWN_STREAK_THRESHOLD - 1);
}

async function applyAttempt(
  userId: string,
  deckWordId: string,
  correct: boolean,
  rawSteps?: number,
): Promise<void> {
  const now = new Date();
  const target = [userWordStats.userId, userWordStats.deckWordId] as const;

  if (correct) {
    // Steps measure how confident one answer was, so they move the streak but
    // not the counts of how many times the word has been seen or answered.
    const steps = clampSteps(rawSteps);

    await db
      .insert(userWordStats)
      .values({
        userId,
        deckWordId,
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

  const validIds = new Set(deck.words.map((word) => word.id));
  const valid = attempts.filter((attempt) => validIds.has(attempt.deckWordId));

  for (const attempt of valid) {
    await applyAttempt(
      userId,
      attempt.deckWordId,
      attempt.correct,
      attempt.steps,
    );
  }

  return { recorded: valid.length };
}

/** Manual "I already know this" / "actually, keep testing me" toggle. */
export async function setWordKnown(
  userId: string,
  deckId: string,
  deckWordId: string,
  known: boolean,
): Promise<{ ok: boolean } | null> {
  const deck = await getDeckForUser(deckId, userId);
  if (!deck || !deck.words.some((word) => word.id === deckWordId)) {
    return null;
  }

  const now = new Date();
  await db
    .insert(userWordStats)
    .values({
      userId,
      deckWordId,
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
      target: [userWordStats.userId, userWordStats.deckWordId],
      set: {
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
 * A deck always teaches its `foreignLang` — "learn English from German" is
 * stored as nativeLang=german/foreignLang=english — so the foreign slot is the
 * right one to match on. It may however still hold a legacy name ("german")
 * while callers now pass a canonical code ("de"), so every accepted spelling
 * of the requested language is matched.
 */
export async function countKnownWordsForLanguage(
  userId: string,
  language: string,
): Promise<number> {
  const canonical = normalizeLang(language);
  const accepted = Array.from(
    new Set(
      [
        language.toLowerCase(),
        canonical,
        canonical ? LANG_ENGLISH_NAMES[canonical].toLowerCase() : null,
      ].filter((value): value is string => Boolean(value)),
    ),
  );

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userWordStats)
    .innerJoin(deckWords, eq(userWordStats.deckWordId, deckWords.id))
    .innerJoin(decks, eq(deckWords.deckId, decks.id))
    .where(
      and(
        eq(userWordStats.userId, userId),
        eq(userWordStats.known, true),
        inArray(sql`lower(${decks.foreignLang})`, accepted),
      ),
    );

  return Number(row?.count ?? 0);
}

/**
 * Returns a randomised set of the user's **known** words across all decks.
 * Used for the Navbar "practice for energy" feature so the user reviews words
 * they've already mastered (and each round is different).
 */
export async function selectKnownWordsForReview(
  userId: string,
  size = DEFAULT_PRACTICE_SIZE,
): Promise<SessionWord[]> {
  // Pull every word the user has marked/reached "known" across all decks.
  const rows = await db
    .select({
      id: deckWords.id,
      native: deckWords.native,
      foreign: deckWords.foreign,
      orderIndex: deckWords.orderIndex,
      box: userWordStats.box,
      streak: userWordStats.streak,
      timesSeen: userWordStats.timesSeen,
      timesCorrect: userWordStats.timesCorrect,
      timesWrong: userWordStats.timesWrong,
      known: userWordStats.known,
      lastSeenAt: userWordStats.lastSeenAt,
    })
    .from(userWordStats)
    .innerJoin(deckWords, eq(userWordStats.deckWordId, deckWords.id))
    .where(and(eq(userWordStats.userId, userId), eq(userWordStats.known, true)));

  if (rows.length === 0) {
    return [];
  }

  const mapped: SessionWord[] = rows.map((row) => ({
    id: row.id,
    native: row.native,
    foreign: row.foreign,
    orderIndex: row.orderIndex,
    stat: {
      box: row.box,
      streak: row.streak,
      timesSeen: row.timesSeen,
      timesCorrect: row.timesCorrect,
      timesWrong: row.timesWrong,
      known: row.known,
      lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null,
    },
  }));

  return shuffle(mapped).slice(0, size);
}
