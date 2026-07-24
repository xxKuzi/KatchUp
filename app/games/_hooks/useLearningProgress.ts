"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/lib/auth-client";
import {
  computeCurrentLecture,
  createInitialProgress,
  getActiveWords,
  getLearningStats,
  markWordAsCorrect,
} from "../_lib/learning/progression";
import { LearningProgress, SupportedLanguage } from "../_lib/learning/types";

const STORAGE_KEY_PREFIX = "katchup-learning-progress-v1";
const SYNC_ENDPOINT = "/api/learning-progress";
const MAX_PENDING_BEFORE_FLUSH = 15;

interface PendingUpdate {
  isUnlocked: boolean;
  isMastered: boolean;
}

interface RemoteProgress {
  unlockedWordIds: string[];
  masteredWordIds: string[];
}

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

function readLocalProgress(language: SupportedLanguage): LearningProgress {
  const storedRaw = window.localStorage.getItem(getStorageKey(language));
  if (!storedRaw) {
    return createInitialProgress(language);
  }

  return (
    parseStoredProgress(storedRaw, language) ??
    createInitialProgress(language)
  );
}

// Combines guest progress made on this device with progress already saved
// under the account, so neither side of a late login is ever lost.
function mergeProgress(
  local: LearningProgress,
  remote: RemoteProgress,
  language: SupportedLanguage,
): LearningProgress {
  const unlockedWordIds = Array.from(
    new Set([...local.unlockedWordIds, ...remote.unlockedWordIds]),
  );
  const masteredWordIds = Array.from(
    new Set([...local.masteredWordIds, ...remote.masteredWordIds]),
  );

  const merged: LearningProgress = {
    language,
    unlockedWordIds,
    masteredWordIds,
    currentLecture: 1,
  };

  return { ...merged, currentLecture: computeCurrentLecture(merged) };
}

// Words the merge picked up from local storage that the server doesn't know
// about yet (guest progress, or progress made on another idle tab).
function diffForCatchUp(
  remote: RemoteProgress,
  merged: LearningProgress,
): Map<string, PendingUpdate> {
  const remoteUnlocked = new Set(remote.unlockedWordIds);
  const remoteMastered = new Set(remote.masteredWordIds);
  const mastered = new Set(merged.masteredWordIds);

  const updates = new Map<string, PendingUpdate>();
  for (const wordId of merged.unlockedWordIds) {
    const isMastered = mastered.has(wordId);
    const isNewToRemote = !remoteUnlocked.has(wordId);
    const masteryChanged = isMastered && !remoteMastered.has(wordId);

    if (isNewToRemote || masteryChanged) {
      updates.set(wordId, { isUnlocked: true, isMastered });
    }
  }

  return updates;
}

export function useLearningProgress(language: SupportedLanguage) {
  const { data: session, status } = useSession();
  const userId = session?.user?.id ?? null;

  const [progress, setProgress] = useState<LearningProgress>(() =>
    createInitialProgress(language),
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [loadedLanguage, setLoadedLanguage] =
    useState<SupportedLanguage | null>(null);

  // Word updates made during play, batched here and flushed in one request
  // instead of hitting the database on every answer.
  const pendingRef = useRef<Map<string, PendingUpdate>>(new Map());

  const flush = useCallback(
    (
      targetLanguage: SupportedLanguage,
      targetUserId: string | null,
      keepalive = false,
    ) => {
      if (!targetUserId || pendingRef.current.size === 0) {
        return;
      }

      const updates = Array.from(pendingRef.current.entries()).map(
        ([wordId, update]) => ({ wordId, ...update }),
      );
      pendingRef.current.clear();

      void fetch(SYNC_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive,
        body: JSON.stringify({ language: targetLanguage, updates }),
      }).catch(() => {
        // Best-effort sync — localStorage already holds the source of truth
        // for this session, so a dropped request just retries at next flush.
      });
    },
    [],
  );

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    let cancelled = false;
    setIsHydrated(false);
    setLoadedLanguage(null);

    const localProgress = readLocalProgress(language);

    if (!userId) {
      setProgress(localProgress);
      setLoadedLanguage(language);
      setIsHydrated(true);
      return;
    }

    const loadFromServer = async () => {
      try {
        const response = await fetch(`${SYNC_ENDPOINT}?language=${language}`);
        if (!response.ok) {
          throw new Error("Failed to load learning progress");
        }

        const remote = (await response.json()) as RemoteProgress;
        if (cancelled) {
          return;
        }

        const merged = mergeProgress(localProgress, remote, language);
        const catchUp = diffForCatchUp(remote, merged);
        if (catchUp.size > 0) {
          catchUp.forEach((update, wordId) =>
            pendingRef.current.set(wordId, update),
          );
          flush(language, userId);
        }

        setProgress(merged);
      } catch {
        if (!cancelled) {
          setProgress(localProgress);
        }
      } finally {
        if (!cancelled) {
          setLoadedLanguage(language);
          setIsHydrated(true);
        }
      }
    };

    void loadFromServer();

    const handlePageHide = () => flush(language, userId, true);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      cancelled = true;
      window.removeEventListener("pagehide", handlePageHide);
      flush(language, userId, true);
    };
  }, [language, status, userId, flush]);

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
    const next = markWordAsCorrect(progress, wordId);
    if (next === progress) {
      return;
    }

    setProgress(next);

    if (!userId) {
      return;
    }

    pendingRef.current.set(wordId, { isUnlocked: true, isMastered: true });

    const newlyUnlocked = next.unlockedWordIds.filter(
      (id) => !progress.unlockedWordIds.includes(id),
    );
    for (const id of newlyUnlocked) {
      pendingRef.current.set(id, { isUnlocked: true, isMastered: false });
    }

    if (pendingRef.current.size >= MAX_PENDING_BEFORE_FLUSH) {
      flush(language, userId);
    }
  };

  // Exposed so a game screen can force a write at a natural boundary, e.g.
  // when a lecture or round finishes, without waiting for the batch to fill.
  const syncNow = useCallback(() => {
    flush(language, userId);
  }, [flush, language, userId]);

  const reset = () => {
    setProgress(createInitialProgress(language));
  };

  return {
    progress,
    activeWords,
    stats,
    isHydrated,
    markCorrect,
    syncNow,
    reset,
  };
}
