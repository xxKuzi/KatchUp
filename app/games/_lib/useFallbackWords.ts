"use client";

import { useEffect, useState } from "react";
import { useLanguagePair } from "@/app/_lib/useLanguagePair";
import { useLearningLevelState } from "@/app/_lib/useLearningLevel";
import type { CefrLevel } from "@/app/_lib/languages";
import { fetchWordPairs } from "./wordPairs";

export interface FallbackWord {
  id: string;
  native: string;
  foreign: string;
}

export interface FallbackWords {
  words: FallbackWord[];
  /**
   * True until the words for the current pair and level are on hand. Games
   * build their round out of these, so a round started while this is true is a
   * round with nothing in it — show a skeleton instead.
   */
  isLoading: boolean;
}

/**
 * Vocabulary for the deck games when the player hasn't opened a specific deck.
 *
 * Replaces the hardcoded `getAllWords("german")` fallback these games used to
 * share, which ignored the player's chosen languages entirely and only ever
 * served 30 German words. These games quiz in the recall direction — you see
 * your own language and produce the target — so `native` is the language you
 * speak and `foreign` the one you're learning.
 */
export function useFallbackWords(count = 60): FallbackWords {
  const { speak, learning } = useLanguagePair();
  const { level: learningLevel, status } = useLearningLevelState(learning);
  // The player sees a level number; the word pool still needs a difficulty.
  const level: CefrLevel = learningLevel?.wordDifficulty ?? "A1";
  // Fetching before the level resolves would deal everyone an A1 round and then
  // swap the words out from under them once their real level arrived.
  const levelPending = status === "loading";

  // What the words on hand were fetched for. Loading is that not yet matching
  // what's being asked for, rather than a flag of its own — a flag would have to
  // be raised while rendering, one render before the fetch it describes starts.
  const requestKey = `${speak}|${learning}|${level}|${count}`;
  const [loaded, setLoaded] = useState<{
    key: string;
    words: FallbackWord[];
  } | null>(null);

  useEffect(() => {
    if (levelPending) {
      return;
    }

    const controller = new AbortController();

    fetchWordPairs({
      speak,
      learning,
      direction: "recall",
      level,
      count,
      signal: controller.signal,
    })
      .then((pairs) => {
        setLoaded({
          key: requestKey,
          words: pairs.map((pair) => ({
            id: pair.conceptId,
            native: pair.prompt,
            foreign: pair.answer,
          })),
        });
      })
      .catch(() => {
        // An aborted fetch is a superseded one: the run that replaced it is
        // still loading, and settling here would show its empty round.
        if (controller.signal.aborted) {
          return;
        }
        // Otherwise the games fall through to their empty state.
        setLoaded({ key: requestKey, words: [] });
      });

    return () => controller.abort();
  }, [speak, learning, level, count, levelPending, requestKey]);

  const isReady = !levelPending && loaded?.key === requestKey;
  return {
    words: isReady ? loaded.words : [],
    isLoading: !isReady,
  };
}
