import type { CefrLevel } from "./languages";

/**
 * Learner levels.
 *
 * A flat "10 words per band" ladder made no sense — 20 mastered words is not
 * B1 by any measure. Levels are plain numbers instead, 1 to 40, and each one
 * costs 1.2x more words than the one before it: quick wins early, a real climb
 * later. CEFR codes are gone from the product; they survive only as difficulty
 * tags on the vocabulary itself (see `wordDifficultyForLevel`).
 */
export const MAX_LEVEL = 40;

/** Each level costs this much more than the previous one. */
export const LEVEL_GROWTH = 1.2;

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
  /**
   * Difficulty of the vocabulary a learner at this level should be drilled on.
   * Internal only — never shown, since the whole point is that players see a
   * number rather than a CEFR code.
   */
  wordDifficulty: CefrLevel;
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
 * The vocabulary is still tagged A1-C1, so a level has to map onto one to know
 * which words to serve. The bands are front-loaded rather than spread evenly
 * over all 40 levels, because the corpus runs out long before level 40 does.
 */
export function wordDifficultyForLevel(level: number): CefrLevel {
  const safeLevel = clampLevel(level);

  if (safeLevel <= 4) return "A1";
  if (safeLevel <= 8) return "A2";
  if (safeLevel <= 12) return "B1";
  if (safeLevel <= 16) return "B2";
  return "C1";
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
  };
}
