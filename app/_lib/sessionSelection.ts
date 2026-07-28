/**
 * How a practice round is chosen — the one copy, shared by both sides.
 *
 * The server picked the words for every round until decks could be taken
 * offline. Now the browser has to pick them too, and two implementations of
 * "which ten words next" would drift into two different apps: a deck practised
 * on a plane would surface different words than the same deck practised at a
 * desk, and the progress bars would disagree about the same answers.
 *
 * So everything here is pure and environment-free: no database, no `window`, no
 * imports that pull either in. `app/api/decks/_lib/spacedRepetition.ts` feeds it
 * rows read from Postgres; `app/_lib/offline/*` feeds it rows read from
 * IndexedDB. Both get the same answer.
 */

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

/**
 * A word's practice history, in the shape both sides can produce.
 *
 * `lastSeenAt` is an ISO string rather than a `Date` because this is also the
 * wire shape and the IndexedDB shape; the server maps its timestamp column into
 * it before selecting.
 */
export interface WordStatSummary {
  box: number;
  streak: number;
  timesSeen: number;
  timesCorrect: number;
  timesWrong: number;
  known: boolean;
  lastSeenAt: string | null;
}

/** Anything with a practice history attached — the only thing selection reads. */
export interface StatBearing {
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

function seenCount(entry: StatBearing): number {
  return entry.stat?.timesSeen ?? 0;
}

function lastSeenMs(entry: StatBearing): number {
  const value = entry.stat?.lastSeenAt;
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

// Higher = show sooner. Never-seen win, then most-failed, then least-recently
// seen, then lowest streak (furthest from becoming known).
export function comparePracticePriority(a: StatBearing, b: StatBearing): number {
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

  const seenA = lastSeenMs(a);
  const seenB = lastSeenMs(b);
  if (seenA !== seenB) {
    return seenA - seenB;
  }

  return (a.stat?.streak ?? 0) - (b.stat?.streak ?? 0);
}

// Finish round: worst accuracy first, then most wrong answers.
export function compareHardest(a: StatBearing, b: StatBearing): number {
  const accuracy = (entry: StatBearing): number => {
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

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildSummary(entries: StatBearing[]): DeckProgressSummary {
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
 * The slice of a deck a topic level owns.
 *
 * The five levels of a topic used to share one pool, so mastering it emptied
 * every level at once. Each level now practices one consecutive window of the
 * deck in seed order, which is also why `topUpTopicDeckWords` appends rather
 * than renumbering: a word must not drift between levels.
 */
export function levelWindow<T>(entries: T[], level: number | undefined): T[] {
  if (!level || entries.length === 0) {
    return entries;
  }

  const clamped = Math.min(Math.max(Math.floor(level), 1), TOPIC_LEVEL_COUNT);
  const size = Math.ceil(entries.length / TOPIC_LEVEL_COUNT);
  const window = entries.slice((clamped - 1) * size, clamped * size);

  // A deck with fewer words than levels leaves later windows empty; serving the
  // whole deck beats serving an empty round.
  return window.length > 0 ? window : entries;
}

export interface ChooseOptions {
  mode?: SessionMode;
  size?: number;
}

/**
 * Picks the words for a round out of an already level-scoped pool.
 *
 * Practice mode drops known words and weights the rest toward unseen /
 * most-failed / least-recently-seen. Finish mode returns the hardest previously-
 * failed words for an end-of-deck review.
 */
export function chooseSessionWords<T extends StatBearing>(
  entries: T[],
  options: ChooseOptions = {},
): T[] {
  const mode: SessionMode = options.mode === "finish" ? "finish" : "practice";

  if (mode === "finish") {
    const size = options.size ?? DEFAULT_FINISH_SIZE;
    // Hardest first, then whatever else is still unlearned. A review round used
    // to draw only from words already answered wrong, so a pack could be short
    // of learned words and still report nothing to review.
    const pending = [...entries.filter((entry) => !entry.stat?.known)].sort(
      compareHardest,
    );

    if (pending.length === 0) {
      return shuffle(entries).slice(0, REVIEW_REFRESH_SIZE);
    }

    // Topped up from the learned words so the round is a full one — the point
    // of the legendary round is the whole pack, not only its sore spots.
    const filler = shuffle(entries.filter((entry) => entry.stat?.known));
    return shuffle([...pending, ...filler].slice(0, size));
  }

  const size = options.size ?? DEFAULT_PRACTICE_SIZE;
  const pool = entries.filter((entry) => !entry.stat?.known);
  pool.sort(comparePracticePriority);

  // Words already mastered elsewhere still get served once the unlearned ones
  // run out. Mastery is shared across decks now, so a pack can arrive fully
  // known before it has ever been opened — and an empty round would leave its
  // level permanently unclearable.
  if (pool.length < size) {
    const filler = shuffle(entries.filter((entry) => entry.stat?.known));
    return shuffle([...pool, ...filler].slice(0, size));
  }

  return shuffle(pool.slice(0, size));
}

/** Keeps a caller from handing out mastery in a single answer. */
export function clampSteps(steps: number | undefined): number {
  if (typeof steps !== "number" || !Number.isFinite(steps)) {
    return 1;
  }
  return Math.min(Math.max(Math.floor(steps), 1), KNOWN_STREAK_THRESHOLD - 1);
}

/**
 * One answer applied to a word's history.
 *
 * A pure restatement of the two upserts in `spacedRepetition.applyAttempt`, and
 * it has to stay one: it is what an offline round uses to move its local copy of
 * the stats, so the progress shown on a plane matches what the server computes
 * when the outbox drains. The server stays the authority — the next download
 * overwrites whatever this produced.
 */
export function applyAttemptToStat(
  stat: WordStatSummary | null,
  correct: boolean,
  rawSteps?: number,
  now: Date = new Date(),
): WordStatSummary {
  const lastSeenAt = now.toISOString();

  const base: WordStatSummary = stat ?? {
    box: 0,
    streak: 0,
    timesSeen: 0,
    timesCorrect: 0,
    timesWrong: 0,
    known: false,
    lastSeenAt: null,
  };

  if (correct) {
    // Steps measure how confident one answer was, so they move the streak but
    // not the counts of how many times the word has been seen or answered.
    const steps = clampSteps(rawSteps);
    const streak = base.streak + steps;

    return {
      box: Math.min(base.box + 1, MAX_BOX),
      streak,
      timesSeen: base.timesSeen + 1,
      timesCorrect: base.timesCorrect + 1,
      timesWrong: base.timesWrong,
      // Never on a first answer: `clampSteps` keeps one attempt below the
      // threshold, so mastery always takes at least two.
      known: stat ? streak >= KNOWN_STREAK_THRESHOLD || base.known : false,
      lastSeenAt,
    };
  }

  // Wrong answer: step the streak back one, drop a box, and un-know the word so
  // it resurfaces. The streak used to reset to zero, which threw away two clean
  // rounds for one slip.
  return {
    box: Math.max(base.box - 1, 0),
    streak: Math.max(base.streak - 1, 0),
    timesSeen: base.timesSeen + 1,
    timesCorrect: base.timesCorrect,
    timesWrong: base.timesWrong + 1,
    known: false,
    lastSeenAt,
  };
}

/** The stat a manual "I already know this" (or its undo) leaves behind. */
export function applyKnownToStat(
  stat: WordStatSummary | null,
  known: boolean,
  now: Date = new Date(),
): WordStatSummary {
  const base: WordStatSummary = stat ?? {
    box: 0,
    streak: 0,
    timesSeen: 0,
    timesCorrect: 0,
    timesWrong: 0,
    known: false,
    lastSeenAt: null,
  };

  return {
    ...base,
    // Only a word with no history at all gets its box set here; the server's
    // conflict branch leaves an existing box alone, and the two must agree.
    box: stat ? base.box : known ? MAX_BOX : 0,
    streak: known ? Math.max(base.streak, KNOWN_STREAK_THRESHOLD) : 0,
    known,
    lastSeenAt: now.toISOString(),
  };
}
