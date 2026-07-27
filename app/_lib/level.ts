import { CEFR_LEVELS, type CefrLevel } from "./languages";

/**
 * Learner levels.
 *
 * The level is the number: it's what the navbar shows and what the ladder is
 * climbed in, and each level costs 1.2x more mastered words than the one before
 * it — quick wins early, a real climb later.
 *
 * A CEFR band sits behind every ten of those levels, and is shown when asked
 * for. It is a read-out, not a rung: nothing lets you enter a band directly, so
 * reaching B1 means climbing all ten A2 levels one at a time, each one earned by
 * mastering its words or passing its test.
 */
export const LEVELS_PER_BAND = 10;

/** Ten levels for each of the five bands the vocabulary is tagged with. */
export const MAX_LEVEL = CEFR_LEVELS.length * LEVELS_PER_BAND;

/**
 * Each level costs this much more than the previous one.
 *
 * Tuned to the length of the ladder, not picked for its own sake: at 1.2 the
 * fifty levels compounded to 36,716 mastered words just to enter C1 and 189,565
 * at the ceiling, which put the top two bands beyond anyone who was studying
 * rather than testing. 1.12 lands C1 at a few thousand words and the ceiling
 * near ten — the range a C1 vocabulary is actually measured in — while keeping
 * the early levels cheap enough to feel quick.
 */
export const LEVEL_GROWTH = 1.12;

/** Words needed to get from level 1 to level 2; everything scales off this. */
export const WORDS_FOR_FIRST_LEVEL = 5;

/**
 * Total mastered words needed to *be* each level, indexed by level - 1.
 * LEVEL_THRESHOLDS[0] is 0: everyone starts at level 1.
 */
export const LEVEL_THRESHOLDS: number[] = (() => {
  const thresholds = [0];

  for (let level = 1; level < MAX_LEVEL; level += 1) {
    const cost = Math.round(
      WORDS_FOR_FIRST_LEVEL * LEVEL_GROWTH ** (level - 1),
    );
    thresholds.push(thresholds[level - 1] + cost);
  }

  return thresholds;
})();

/** Share of the level test you must get right to be promoted. */
export const LEVEL_TEST_PASS_RATIO = 0.9;
export const LEVEL_TEST_QUESTION_COUNT = 10;

/**
 * The placement test, sat once when a language is set up.
 *
 * It asks the same questions of everyone and spans every band, because a test
 * built from one band can only ever confirm that band — someone who walks
 * through an A1 round has proved nothing about A2, and the whole point of
 * placing a learner is to find the ceiling rather than the floor. Three
 * questions a band, and a band counts as cleared at two of them: one unlucky
 * guess should not decide where somebody starts, and three is enough to make
 * guessing your way up unlikely.
 */
export const PLACEMENT_QUESTIONS_PER_BAND = 3;
export const PLACEMENT_BAND_PASS = 2;
export const PLACEMENT_QUESTION_COUNT =
  CEFR_LEVELS.length * PLACEMENT_QUESTIONS_PER_BAND;

/**
 * Where a placement test lands someone: the highest band they cleared that also
 * has the band below it cleared.
 *
 * Graded by band rather than on a total, because twelve out of fifteen is a
 * different learner depending on which three were missed — the answer wanted here
 * is "you have this much", not "you scored this much".
 *
 * Two bands in a row rather than an unbroken run from the bottom. An unbroken run
 * reads better but is brittle at three questions a band: one odd word in A2 would
 * send someone who then answered every B1, B2 and C1 question correctly back to
 * A1, which is plainly the wrong reading of that paper. Requiring the band below
 * as corroboration keeps that learner where they belong while still making a
 * fluke expensive — clearing one band by guesswork is unlikely, and clearing two
 * adjacent bands that way is not worth designing around.
 */
export function placementBandFromCorrectByBand(
  correctByBand: Partial<Record<CefrLevel, number>>,
): CefrLevel {
  const cleared = (band: CefrLevel | undefined) =>
    band !== undefined && (correctByBand[band] ?? 0) >= PLACEMENT_BAND_PASS;

  for (let index = CEFR_LEVELS.length - 1; index >= 1; index -= 1) {
    if (cleared(CEFR_LEVELS[index]) && cleared(CEFR_LEVELS[index - 1])) {
      return CEFR_LEVELS[index];
    }
  }

  // Nothing corroborated: everyone starts at the bottom, which is where a
  // beginner belongs and costs a strong learner only the levels they will pass
  // through in an evening.
  return CEFR_LEVELS[0];
}

export interface LevelProgress {
  /** 1 to MAX_LEVEL. */
  level: number;
  masteredCount: number;
  /** Words needed to have reached this level. */
  levelStart: number;
  /** Words needed for the next level; null at the top. */
  nextLevelAt: number | null;
  /** Words mastered since entering this level. */
  wordsIntoLevel: number;
  /** Words still needed for the next level; null at the top. */
  wordsToNextLevel: number | null;
  /** How much of this level is done, 0-1. */
  fraction: number;
  isMaxLevel: boolean;
  /** Difficulty of the vocabulary a learner at this level is drilled on. Same
   *  value as `band.band` — kept under its own name for the callers that only
   *  ever wanted a difficulty to fetch words at. */
  wordDifficulty: CefrLevel;
  /** The CEFR band behind this level, for the badge to read out on request. */
  band: LevelBand;
}

export function clampLevel(level: number): number {
  if (!Number.isFinite(level)) {
    return 1;
  }
  return Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));
}

/** Mastered-word count you land on when promoted into `level`. */
export function levelStartWords(level: number): number {
  return LEVEL_THRESHOLDS[clampLevel(level) - 1];
}

export function levelFromMasteredCount(masteredCount: number): number {
  const safeCount = Math.max(0, Math.floor(masteredCount));

  for (let level = MAX_LEVEL; level >= 1; level -= 1) {
    if (safeCount >= LEVEL_THRESHOLDS[level - 1]) {
      return level;
    }
  }

  return 1;
}

/**
 * The band a level belongs to: ten levels each, in the order the vocabulary is
 * tagged in. Doubles as the difficulty to draw that level's words from, which is
 * what keeps the badge honest — the band it reads out is the band being played.
 */
export function wordDifficultyForLevel(level: number): CefrLevel {
  const bandIndex = Math.floor((clampLevel(level) - 1) / LEVELS_PER_BAND);
  return CEFR_LEVELS[Math.min(CEFR_LEVELS.length - 1, bandIndex)];
}

/** Where a band's ten levels start. */
export function bandStartLevel(band: CefrLevel): number {
  return CEFR_LEVELS.indexOf(band) * LEVELS_PER_BAND + 1;
}

export interface LevelBand {
  band: CefrLevel;
  /** First and last level of the band, inclusive. */
  startLevel: number;
  endLevel: number;
  /** Which of the band's ten levels this is, 1 to LEVELS_PER_BAND. */
  levelsIntoBand: number;
  /** The band above, and the level that enters it; null in the top band. */
  nextBand: CefrLevel | null;
  nextBandAtLevel: number | null;
  /** Levels still to climb before the next band; null in the top band. */
  levelsToNextBand: number | null;
}

/** Everything the badge needs to say which band a level sits in, and how far
 *  through it the learner is. */
export function levelBand(level: number): LevelBand {
  const safeLevel = clampLevel(level);
  const band = wordDifficultyForLevel(safeLevel);
  const bandIndex = CEFR_LEVELS.indexOf(band);
  const startLevel = bandIndex * LEVELS_PER_BAND + 1;
  const nextBand = CEFR_LEVELS[bandIndex + 1] ?? null;
  const nextBandAtLevel =
    nextBand === null ? null : startLevel + LEVELS_PER_BAND;

  return {
    band,
    startLevel,
    endLevel: startLevel + LEVELS_PER_BAND - 1,
    levelsIntoBand: safeLevel - startLevel + 1,
    nextBand,
    nextBandAtLevel,
    levelsToNextBand:
      nextBandAtLevel === null ? null : nextBandAtLevel - safeLevel,
  };
}

export function levelProgressFromMasteredCount(
  masteredCount: number,
): LevelProgress {
  const safeCount = Math.max(0, Math.floor(masteredCount));
  const level = levelFromMasteredCount(safeCount);
  const isMaxLevel = level === MAX_LEVEL;

  const levelStart = LEVEL_THRESHOLDS[level - 1];
  const nextLevelAt = isMaxLevel ? null : LEVEL_THRESHOLDS[level];
  const wordsIntoLevel = safeCount - levelStart;
  const span = nextLevelAt === null ? 0 : nextLevelAt - levelStart;

  return {
    level,
    masteredCount: safeCount,
    levelStart,
    nextLevelAt,
    wordsIntoLevel,
    wordsToNextLevel: nextLevelAt === null ? null : nextLevelAt - safeCount,
    fraction: span === 0 ? 1 : Math.min(1, wordsIntoLevel / span),
    isMaxLevel,
    wordDifficulty: wordDifficultyForLevel(level),
    band: levelBand(level),
  };
}
