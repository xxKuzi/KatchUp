// Every 10 mastered words bumps the learner one CEFR sub-level:
// 0-9 -> A1, 10-19 -> A2, 20-29 -> B1, 30-39 -> B2, 40-49 -> C1, 50+ -> C2.
export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

export const WORDS_PER_CEFR_LEVEL = 10;

export interface CefrProgress {
  label: CefrLevel;
  masteredCount: number;
  // Words mastered within the current CEFR tier (0-9).
  wordsIntoLevel: number;
  // Words left to reach the next tier; null once C2 is reached.
  wordsToNextLevel: number | null;
}

export function cefrProgressFromMasteredCount(
  masteredCount: number,
): CefrProgress {
  const safeCount = Math.max(0, Math.floor(masteredCount));
  const tierIndex = Math.min(
    Math.floor(safeCount / WORDS_PER_CEFR_LEVEL),
    CEFR_LEVELS.length - 1,
  );
  const isMaxTier = tierIndex === CEFR_LEVELS.length - 1;
  const wordsIntoLevel = safeCount - tierIndex * WORDS_PER_CEFR_LEVEL;

  return {
    label: CEFR_LEVELS[tierIndex],
    masteredCount: safeCount,
    wordsIntoLevel,
    wordsToNextLevel: isMaxTier
      ? null
      : WORDS_PER_CEFR_LEVEL - wordsIntoLevel,
  };
}
