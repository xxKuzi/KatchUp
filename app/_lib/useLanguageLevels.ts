"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/lib/auth-client";
import type { CefrLevel, Lang } from "./languages";

export interface LanguageStanding {
  learning: Lang;
  level: number;
  band: CefrLevel;
  levelsIntoBand: number;
  masteredCount: number;
  knownWords: number;
  wordFloor: number;
  /** False when nothing has been earned here yet. */
  started: boolean;
  /** Whether the placement test is still owed here — nothing earned, and no
   *  placement on record. The one to read before sending anyone to sit it. */
  canBePlaced: boolean;
}

/**
 * Where the signed-in player stands in every language at once.
 *
 * One request rather than one per language: the switcher shows them side by side,
 * and four separate level lookups to draw one list is four round trips on a
 * driver where the round trip is the whole cost.
 */
export function useLanguageLevels(): {
  languages: LanguageStanding[] | null;
  reload: () => void;
} {
  const { data: session, status } = useSession();
  const [languages, setLanguages] = useState<LanguageStanding[] | null>(null);
  const [token, setToken] = useState(0);

  const reload = useCallback(() => setToken((value) => value + 1), []);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) {
      return;
    }

    let cancelled = false;

    fetch("/api/decks/languages")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!cancelled && body?.languages) {
          setLanguages(body.languages as LanguageStanding[]);
        }
      })
      .catch(() => {
        // The switcher still works without the levels; it just shows no badges.
      });

    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.id, token]);

  return { languages, reload };
}
