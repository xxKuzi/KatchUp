"use client";

import { useEffect, useState } from "react";
import { useLanguagePair } from "@/app/_lib/useLanguagePair";
import { useLearningLevelState } from "@/app/_lib/useLearningLevel";
import { readSelfReportedLevel } from "@/app/_lib/selfReportedLevel";
import { normalizeLang, type CefrLevel } from "@/app/_lib/languages";
import { fetchWordPairs } from "./wordPairs";

export interface FallbackWord {
  id: string;
  native: string;
  foreign: string;
  /**
   * Article of `foreign`. These games all fetch in the recall direction, so the
   * learned language is always the answer side.
   */
  article: string | null;
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
export function useFallbackWords(
  count = 60,
  options?: { speak?: string; learning?: string },
): FallbackWords {
  const stored = useLanguagePair();
  const speak = normalizeLang(options?.speak) ?? stored.speak;
  const learning = normalizeLang(options?.learning) ?? stored.learning;
  const { level: learningLevel, status } = useLearningLevelState(learning);
  // Signed out there are no mastered words to derive a level from, so the words
  // come at whatever difficulty the visitor said they were starting from. That
  // used to fall through to A1 for everyone, which meant someone who told us
  // they were nearly fluent got a round of first words anyway — and a claim
  // nothing ever checked, since the round held nothing that could disprove it.
  //
  // Read once when the hook mounts rather than on every render: grading the
  // round writes a corrected level back, and a round that re-read it would
  // rebuild itself out of new words at the moment it finished, taking its own
  // results screen with it. The level a round was dealt at belongs to that
  // round. Null on the server, where there is no storage to read.
  const [selfReport] = useState<{ level: CefrLevel | null } | null>(() =>
    typeof window === "undefined" ? null : { level: readSelfReportedLevel() },
  );

  // The player sees a level number; the word pool still needs a difficulty.
  const level: CefrLevel =
    learningLevel?.wordDifficulty ?? selfReport?.level ?? "A1";
  // Fetching before the level resolves would deal everyone an A1 round and then
  // swap the words out from under them once their real level arrived — which is
  // just as true of the claimed level as of the earned one.
  const levelPending =
    status === "loading" || (status === "signedOut" && selfReport === null);

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
            article: pair.answerArticle,
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
