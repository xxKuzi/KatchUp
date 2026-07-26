"use client";

import { useEffect, useState } from "react";
import { useLanguagePair } from "@/app/_lib/useLanguagePair";
import { useLearningLevel } from "@/app/_lib/useLearningLevel";
import type { CefrLevel } from "@/app/_lib/languages";
import { fetchWordPairs } from "./wordPairs";

export interface FallbackWord {
  id: string;
  native: string;
  foreign: string;
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
export function useFallbackWords(count = 60): FallbackWord[] {
  const { speak, learning } = useLanguagePair();
  const learningLevel = useLearningLevel(learning);
  // The player sees a level number; the word pool still needs a difficulty.
  const level: CefrLevel = learningLevel?.wordDifficulty ?? "A1";

  const [words, setWords] = useState<FallbackWord[]>([]);

  useEffect(() => {
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
        setWords(
          pairs.map((pair) => ({
            id: pair.conceptId,
            native: pair.prompt,
            foreign: pair.answer,
          })),
        );
      })
      .catch(() => {
        // Non-fatal: the game shows its empty state until a retry or a deck.
      });

    return () => controller.abort();
  }, [speak, learning, level, count]);

  return words;
}
