"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getDeterministicMode,
  TOPIC_LEVEL_COUNT,
} from "@/app/topics/_lib/topicsProgress";
import { fetchDeckProgress } from "../_lib/deckSessionClient";

/**
 * Sends the player straight into the next level, but only once this one is
 * actually finished — every word in the level answered right at least once,
 * the same bar the topic page's "Done" badge uses.
 *
 * Pass `cleared` when the caller can work that out from the round it just
 * played (see `predictLevelCleared`), which is what puts the button on screen
 * with the rest of the results instead of a network round trip later. The fetch
 * below is the fallback for when it can't, and can only ever bring the button
 * in — never take it away again under the cursor.
 */
export default function NextLevelButton({
  deckId,
  topicId,
  level,
  cleared = false,
}: {
  deckId: string;
  topicId: string;
  level: number;
  /** The caller's own verdict on the level being finished. */
  cleared?: boolean;
}) {
  const [fetchedCleared, setFetchedCleared] = useState(false);
  const nextLevel = level + 1;
  const hasNextLevel = nextLevel <= TOPIC_LEVEL_COUNT;
  const levelCleared = cleared || fetchedCleared;

  useEffect(() => {
    if (!deckId || !topicId || !hasNextLevel || cleared) {
      return;
    }

    let cancelled = false;
    fetchDeckProgress(deckId, level)
      .then((progress) => {
        if (
          !cancelled &&
          progress.total > 0 &&
          progress.cleared >= progress.total
        ) {
          setFetchedCleared(true);
        }
      })
      .catch(() => {
        // Non-critical: the results screen still works without the button.
      });

    return () => {
      cancelled = true;
    };
  }, [deckId, topicId, level, hasNextLevel, cleared]);

  if (!hasNextLevel || !levelCleared) {
    return null;
  }

  const gameBase =
    getDeterministicMode(topicId, nextLevel) === "flip-cards"
      ? "/games/flip-cards"
      : "/games/one-of-three";
  const href = `${gameBase}?deck=${deckId}&topicId=${encodeURIComponent(
    topicId,
  )}&level=${nextLevel}`;

  return (
    <Link
      href={href}
      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
    >
      Next level →
    </Link>
  );
}
