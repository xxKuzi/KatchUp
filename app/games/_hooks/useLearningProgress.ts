"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createInitialProgress,
  getActiveWords,
  getLearningStats,
  markWordAsCorrect,
} from "../_lib/learning/progression";
import { LearningProgress, SupportedLanguage } from "../_lib/learning/types";

const STORAGE_KEY_PREFIX = "katchup-learning-progress-v1";

function getStorageKey(language: SupportedLanguage): string {
  return `${STORAGE_KEY_PREFIX}-${language}`;
}

function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return value === "german" || value === "spanish";
}

function parseStoredProgress(
  raw: string,
  language: SupportedLanguage,
): LearningProgress | null {
  try {
    const parsed = JSON.parse(raw) as Partial<LearningProgress>;
    if (!isSupportedLanguage(parsed.language)) {
      return null;
    }

    if (parsed.language !== language) {
      return null;
    }

    if (
      !Array.isArray(parsed.unlockedWordIds) ||
      !Array.isArray(parsed.masteredWordIds) ||
      typeof parsed.currentLecture !== "number"
    ) {
      return null;
    }

    return {
      language: parsed.language,
      unlockedWordIds: parsed.unlockedWordIds,
      masteredWordIds: parsed.masteredWordIds,
      currentLecture: parsed.currentLecture,
    };
  } catch {
    return null;
  }
}

export function useLearningProgress(language: SupportedLanguage) {
  const [progress, setProgress] = useState<LearningProgress>(() =>
    createInitialProgress(language),
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [loadedLanguage, setLoadedLanguage] =
    useState<SupportedLanguage | null>(null);

  useEffect(() => {
    setIsHydrated(false);
    setLoadedLanguage(null);

    const storedRaw = window.localStorage.getItem(getStorageKey(language));
    if (!storedRaw) {
      setProgress(createInitialProgress(language));
      setLoadedLanguage(language);
      setIsHydrated(true);
      return;
    }

    const parsedProgress = parseStoredProgress(storedRaw, language);
    setProgress(parsedProgress ?? createInitialProgress(language));
    setLoadedLanguage(language);
    setIsHydrated(true);
  }, [language]);

  useEffect(() => {
    if (!isHydrated || loadedLanguage !== language) {
      return;
    }

    window.localStorage.setItem(
      getStorageKey(language),
      JSON.stringify(progress),
    );
  }, [language, loadedLanguage, progress, isHydrated]);

  const activeWords = useMemo(() => getActiveWords(progress), [progress]);
  const stats = useMemo(() => getLearningStats(progress), [progress]);

  const markCorrect = (wordId: string) => {
    setProgress((previous) => markWordAsCorrect(previous, wordId));
  };

  const reset = () => {
    setProgress(createInitialProgress(language));
  };

  return {
    progress,
    activeWords,
    stats,
    isHydrated,
    markCorrect,
    reset,
  };
}
