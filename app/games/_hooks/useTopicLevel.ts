"use client";

import { useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "@/app/_lib/languageContext";
import {
  completeTopicLevel,
  loadTopicsState,
  saveTopicsState,
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
  const { language } = useLanguage();
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

  return {
    topicId,
    level,
    // A custom deck opened straight from /my-decks has no level ladder, so it
    // must keep drawing from the whole deck.
    deckLevel: topicId ? level : undefined,
    backHref: topicId
      ? `/topics/${encodeURIComponent(topicId)}`
      : deckId
        ? "/my-decks"
        : "/topics",
    markComplete,
  };
}
