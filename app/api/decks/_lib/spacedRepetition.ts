import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { deckWords, decks, userWordStats } from "@/db/schema";
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
}

export interface SessionResult {
  deckId: string;
  deckName: string;
  mode: SessionMode;
  words: SessionWord[];
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
  for (const entry of entries) {
    if (entry.stat?.known) {
      known += 1;
    } else if (seenCount(entry) > 0) {
      learning += 1;
    } else {
      unseen += 1;
    }
  }
  return { total: entries.length, known, learning, unseen };
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
}

/**
 * Picks the words for a practice session. Practice mode drops known words and
 * weights the rest toward unseen / most-failed / least-recently-seen. Finish
 * mode returns the hardest previously-failed words for an end-of-deck review.
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

  const enriched = await enrichDeck(userId, deck);
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
    words: chosen.map(presentWord),
    summary,
  };
}

export interface AttemptInput {
  deckWordId: string;
  correct: boolean;
}

async function applyAttempt(
  userId: string,
  deckWordId: string,
  correct: boolean,
): Promise<void> {
  const now = new Date();
  const target = [userWordStats.userId, userWordStats.deckWordId] as const;

  if (correct) {
    await db
      .insert(userWordStats)
      .values({
        userId,
        deckWordId,
        box: 1,
        streak: 1,
        timesSeen: 1,
        timesCorrect: 1,
        timesWrong: 0,
        known: 1 >= KNOWN_STREAK_THRESHOLD,
        lastSeenAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [...target],
        set: {
          streak: sql`${userWordStats.streak} + 1`,
          box: sql`LEAST(${userWordStats.box} + 1, ${MAX_BOX})`,
          timesSeen: sql`${userWordStats.timesSeen} + 1`,
          timesCorrect: sql`${userWordStats.timesCorrect} + 1`,
          known: sql`((${userWordStats.streak} + 1) >= ${KNOWN_STREAK_THRESHOLD}) OR ${userWordStats.known}`,
          lastSeenAt: now,
          updatedAt: now,
        },
      });
    return;
  }

  // Wrong answer: reset streak, drop a box, and un-know the word so it resurfaces.
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
        streak: 0,
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
    await applyAttempt(userId, attempt.deckWordId, attempt.correct);
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

/** Lightweight progress counts for a deck, for list/finish-gating UI. */
export async function getDeckProgress(
  userId: string,
  deckId: string,
): Promise<DeckProgressSummary | null> {
  const deck = await getDeckForUser(deckId, userId);
  if (!deck) {
    return null;
  }
  return buildSummary(await enrichDeck(userId, deck));
}
