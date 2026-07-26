"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { type Lang } from "./languages";
import { LevelProgress, levelProgressFromMasteredCount } from "./level";

/**
 * Broadcast after the level test promotes someone, so every badge on screen
 * (navbar, profile) re-reads the level without a page reload.
 */
const LEVEL_CHANGED_EVENT = "katchup:level-changed";

export function notifyLevelChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(LEVEL_CHANGED_EVENT));
  }
}

/**
 * Why the level might not be a number yet. "loading" and "signedOut" look the
 * same to a component that only gets `null`, which made a signed-in user read
 * "sign in to see it" for as long as the fetch took — so callers get the
 * reason, not just the absence.
 */
export type LearningLevelStatus = "loading" | "signedOut" | "ready" | "error";

export interface LearningLevelState {
  level: LevelProgress | null;
  status: LearningLevelStatus;
}

/**
 * Fetches the signed-in user's mastered-word count for the language they're
 * learning and turns it into a numeric level (1-40), alongside a status
 * that says why there's no level when there isn't one.
 */
export function useLearningLevelState(
  learningLanguage: Lang,
): LearningLevelState {
  const { data: session, status: sessionStatus } = useSession();
  const [state, setState] = useState<LearningLevelState>({
    level: null,
    status: "loading",
  });
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  useEffect(() => {
    window.addEventListener(LEVEL_CHANGED_EVENT, reload);
    return () => window.removeEventListener(LEVEL_CHANGED_EVENT, reload);
  }, [reload]);

  useEffect(() => {
    if (sessionStatus === "loading") {
      return;
    }

    if (sessionStatus !== "authenticated" || !session?.user?.id) {
      setState({ level: null, status: "signedOut" });
      return;
    }

    let cancelled = false;

    fetch(`/api/decks/level?language=${encodeURIComponent(learningLanguage)}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Level request failed (${res.status})`);
        }
        return (await res.json()) as { masteredCount?: number };
      })
      .then((data) => {
        if (cancelled) {
          return;
        }
        setState({
          level: levelProgressFromMasteredCount(data.masteredCount ?? 0),
          status: "ready",
        });
      })
      .catch(() => {
        if (!cancelled) {
          setState({ level: null, status: "error" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [learningLanguage, sessionStatus, session?.user?.id, reloadToken]);

  return state;
}

/** Level only, for the games that just want a difficulty to fetch words at. */
export function useLearningLevel(learningLanguage: Lang): LevelProgress | null {
  return useLearningLevelState(learningLanguage).level;
}
