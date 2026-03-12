import {
  LearningProgress,
  LearningStats,
  LectureWord,
  SupportedLanguage,
} from "./types";
import { getAllWords, TOTAL_LECTURES } from "./wordDatabase";

function getWordById(
  words: LectureWord[],
  wordId: string,
): LectureWord | undefined {
  return words.find((word) => word.id === wordId);
}

function asUnique(items: string[]): string[] {
  return Array.from(new Set(items));
}

export function createInitialProgress(
  language: SupportedLanguage,
): LearningProgress {
  const initialWordIds = getAllWords(language)
    .filter((word) => word.lecture === 1)
    .map((word) => word.id);

  return {
    language,
    unlockedWordIds: initialWordIds,
    masteredWordIds: [],
    currentLecture: 1,
  };
}

export function getActiveWords(progress: LearningProgress): LectureWord[] {
  const words = getAllWords(progress.language);
  const unlocked = new Set(progress.unlockedWordIds);
  const mastered = new Set(progress.masteredWordIds);

  return words.filter(
    (word) => unlocked.has(word.id) && !mastered.has(word.id),
  );
}

function computeCurrentLecture(progress: LearningProgress): number {
  const activeWords = getActiveWords(progress);
  if (activeWords.length === 0) {
    return TOTAL_LECTURES;
  }

  return Math.min(...activeWords.map((word) => word.lecture));
}

function unlockOneWordFromHigherLecture(
  progress: LearningProgress,
  sourceWordId: string,
): string[] {
  const words = getAllWords(progress.language);
  const sourceWord = getWordById(words, sourceWordId);
  if (!sourceWord) {
    return progress.unlockedWordIds;
  }

  const targetLecture = sourceWord.lecture + 1;
  if (targetLecture > TOTAL_LECTURES) {
    return progress.unlockedWordIds;
  }

  const unlocked = new Set(progress.unlockedWordIds);
  const mastered = new Set(progress.masteredWordIds);
  const nextWord = words.find(
    (word) =>
      word.lecture === targetLecture &&
      !unlocked.has(word.id) &&
      !mastered.has(word.id),
  );

  if (!nextWord) {
    return progress.unlockedWordIds;
  }

  return [...progress.unlockedWordIds, nextWord.id];
}

export function markWordAsCorrect(
  progress: LearningProgress,
  wordId: string,
): LearningProgress {
  if (!progress.unlockedWordIds.includes(wordId)) {
    return progress;
  }

  if (progress.masteredWordIds.includes(wordId)) {
    return progress;
  }

  const withMastered: LearningProgress = {
    ...progress,
    masteredWordIds: asUnique([...progress.masteredWordIds, wordId]),
  };

  const withUnlockedFromHigherLecture: LearningProgress = {
    ...withMastered,
    unlockedWordIds: asUnique(
      unlockOneWordFromHigherLecture(withMastered, wordId),
    ),
  };

  return {
    ...withUnlockedFromHigherLecture,
    currentLecture: computeCurrentLecture(withUnlockedFromHigherLecture),
  };
}

export function getLearningStats(progress: LearningProgress): LearningStats {
  const activeWords = getActiveWords(progress);
  const totalWords = getAllWords(progress.language).length;

  return {
    activeCount: activeWords.length,
    masteredCount: progress.masteredWordIds.length,
    unlockedCount: progress.unlockedWordIds.length,
    totalCount: totalWords,
  };
}
