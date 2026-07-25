"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { type Lang } from "./languages";
import { CefrProgress, cefrProgressFromMasteredCount } from "./cefrLevel";

/**
 * Fetches the signed-in user's mastered-word count for the language they're
 * learning and turns it into a CEFR-style level (A1-C2). Returns null while
 * loading or when signed out.
 */
export function useLearningLevel(learningLanguage: Lang): CefrProgress | null {
  const { data: session, status } = useSession();
  const [progress, setProgress] = useState<CefrProgress | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) {
      setProgress(null);
      return;
    }

    let cancelled = false;

    fetch(`/api/decks/level?language=${encodeURIComponent(learningLanguage)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { masteredCount?: number } | null) => {
        if (cancelled || !data) {
          return;
        }
        setProgress(cefrProgressFromMasteredCount(data.masteredCount ?? 0));
      })
      .catch(() => {
        if (!cancelled) {
          setProgress(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [learningLanguage, status, session?.user?.id]);

  return progress;
}
