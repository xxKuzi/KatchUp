"use client";

import { useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "@/app/_lib/languageContext";
import {
  completeTopicLevel,
  loadTopicsState,
  saveTopicsState,
  submitLegendaryRound,
} from "@/app/topics/_lib/topicsProgress";

/** Levels a topic is split into; mirrors TOPIC_LEVEL_COUNT on the server. */
export const TOPIC_LEVEL_COUNT = 5;

export interface TopicLevelContext {
  /** Topic the round belongs to, or "" when a game was opened outside a topic. */
  topicId: string;
  /** Level 1..5, clamped. Only meaningful when `topicId` is set. */
  level: number;
  /** Level to scope the deck session to — undefined outside a topic. */
  deckLevel: number | undefined;
  /** Link back to where the round was started from. */
  backHref: string;
  /** Records the level as done. Safe to call repeatedly; only the first sticks. */
  markComplete: () => void;
  /** True when this round was launched as the pack's legendary review. */
  isLegendaryRound: boolean;
  /**
   * Hands a finished review round to the server to be graded. Resolves to
   * whether it took the crown — the browser reports the verdicts, the server
   * decides. Only does anything on a legendary round.
   */
  submitLegendaryResults: (
    results: { deckWordId: string; correct: boolean }[],
  ) => Promise<boolean>;
}

/**
 * Reads the topic/level a game round was launched with and records completion.
 *
 * Topic levels used to be recorded only on the non-deck path, so once the topic
 * page started linking games with a real deck id the five levels could never be
 * marked done. Both deck and non-deck rounds go through here now.
 */
export function useTopicLevel(deckId: string): TopicLevelContext {
  const searchParams = useSearchParams();
  const { language, learningLanguage } = useLanguage();
  const saved = useRef<string | null>(null);

  const topicId = searchParams.get("topicId") ?? "";
  const parsed = Number.parseInt(searchParams.get("level") ?? "", 10);
  const level = Number.isFinite(parsed)
    ? Math.min(Math.max(parsed, 1), TOPIC_LEVEL_COUNT)
    : 1;

  const markComplete = useCallback(() => {
    if (!topicId) {
      return;
    }
    const key = `${topicId}:${level}`;
    if (saved.current === key) {
      return;
    }
    saved.current = key;

    const state = loadTopicsState(language);
    const { nextState } = completeTopicLevel(state, topicId, level);
    saveTopicsState(language, nextState);
  }, [language, level, topicId]);

  const isLegendaryRound =
    Boolean(topicId) && searchParams.get("legendary") === "1";

  const submitLegendaryResults = useCallback(
    async (results: { deckWordId: string; correct: boolean }[]) => {
      if (!topicId || !isLegendaryRound) {
        return false;
      }
      return submitLegendaryRound({
        language,
        foreignLang: learningLanguage,
        topicId,
        results,
      });
    },
    [isLegendaryRound, language, learningLanguage, topicId],
  );

  return {
    topicId,
    level,
    isLegendaryRound,
    submitLegendaryResults,
    // A custom deck opened straight from /my-decks has no level ladder, so it
    // must keep drawing from the whole deck — and so does the legendary round,
    // which is a review of the pack rather than of one of its levels.
    deckLevel: topicId && !isLegendaryRound ? level : undefined,
    backHref: topicId
      ? `/topics/${encodeURIComponent(topicId)}`
      : deckId
        ? "/my-decks"
        : "/topics",
    markComplete,
  };
}
