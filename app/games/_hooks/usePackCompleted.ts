"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/app/_lib/languageContext";
import {
  TOPIC_LEVEL_COUNT,
  useTopicsSnapshot,
  useTopicsSync,
} from "@/app/topics/_lib/topicsProgress";
import { fetchDeckLevelProgress } from "../_lib/deckSessionClient";

/**
 * Whether the round that just ended was the last one the pack had left.
 *
 * The round itself knows it cleared *this* level (`predictLevelCleared`, no
 * round trip). The other four cannot be taken from the stored ladder alone:
 * levels are recorded there by the pack page, so a player who went 1 → 5 on the
 * "Next level" button without ever landing back on it has none of them written
 * down, and the pack would finish in silence. The server's word counts are the
 * authority — the same ones the pack page's "Done" badges come from — and the
 * stored ladder is folded in on top of them.
 *
 * Deliberately quiet until the account's ladder has been pulled, so a key
 * already collected on another device isn't announced a second time.
 */
export function usePackCompleted(
  topicId: string,
  level: number,
  deckId: string,
  levelCleared: boolean,
): boolean {
  const { language, learningLanguage } = useLanguage();
  const { state } = useTopicsSnapshot(language);
  // Also what tells the sync which language is being learned — without it a
  // push from a game page comes back with the levels the word counts imply
  // stripped out, and the ladder this hook reads goes backwards.
  const { settled } = useTopicsSync(
    language,
    learningLanguage,
    Boolean(topicId),
  );
  const [serverCleared, setServerCleared] = useState<number[] | null>(null);

  useEffect(() => {
    if (!deckId || !topicId || !levelCleared) {
      return;
    }

    let cancelled = false;
    fetchDeckLevelProgress(deckId)
      .then((levels) => {
        if (cancelled) {
          return;
        }
        setServerCleared(
          levels.reduce<number[]>((acc, progress, index) => {
            if (progress.total > 0 && progress.cleared >= progress.total) {
              acc.push(index + 1);
            }
            return acc;
          }, []),
        );
      })
      .catch(() => {
        // Offline or a hiccup: the stored ladder below is the fallback.
      });

    return () => {
      cancelled = true;
    };
  }, [deckId, topicId, levelCleared]);

  if (!topicId || !levelCleared || !settled) {
    return false;
  }

  const progress = state.topicProgress[topicId];
  if (progress?.keyCelebrated) {
    return false;
  }

  // This round's level joins the two lists: the answers that finished it may
  // still be on their way to the server.
  const cleared = new Set([
    ...(progress?.completedLevels ?? []),
    ...(serverCleared ?? []),
    level,
  ]);

  for (let candidate = 1; candidate <= TOPIC_LEVEL_COUNT; candidate += 1) {
    if (!cleared.has(candidate)) {
      return false;
    }
  }

  return true;
}
