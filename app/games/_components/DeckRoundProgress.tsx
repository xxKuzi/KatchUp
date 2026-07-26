"use client";

import { useEffect, useState } from "react";
import DeckProgress from "@/app/_components/DeckProgress";
import { useLanguage } from "@/app/_lib/languageContext";
import {
  DeckProgressSummary,
  fetchDeckProgress,
} from "../_lib/deckSessionClient";

/**
 * Deck-wide progress on an end-of-round screen.
 *
 * A round is only ever 10 words, so without this there's no way to tell a
 * 30-word deck is being worked through in batches. Fetches on mount, which for
 * this component means "the round just ended", so the numbers are current
 * rather than the stale snapshot bundled with the session.
 *
 * Pass `level` on a topic level so the bar tracks that level's slice instead of
 * the whole deck — otherwise a finished level reads as 20% done.
 */
export default function DeckRoundProgress({
  deckId,
  level,
  className = "",
}: {
  deckId: string;
  level?: number;
  className?: string;
}) {
  const { t } = useLanguage();
  const [progress, setProgress] = useState<DeckProgressSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!deckId) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetchDeckProgress(deckId, level)
      .then((value) => {
        if (!cancelled) {
          setProgress(value);
        }
      })
      .catch(() => {
        // Non-critical: the results screen still works without it.
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [deckId, level]);

  // The fetch only starts once the round ends, so rendering nothing until it
  // lands would drop the box in a second later and shove the buttons below it
  // down. The skeleton below is laid out exactly like the real content, so the
  // results screen settles at its final height right away.
  const box = `mx-auto max-w-sm rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900 ${className}`;

  if (loading) {
    return (
      <div className={box} aria-hidden>
        <div className="animate-pulse">
          <div className="h-5 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="mt-3 h-4 w-2/3 rounded bg-slate-200/70 dark:bg-slate-800/70" />
        </div>
      </div>
    );
  }

  if (!progress || progress.total === 0) {
    return null;
  }

  const remaining = progress.total - progress.known;

  return (
    <div className={box}>
      <DeckProgress known={progress.known} total={progress.total} />
      {/* Fixed height so the hint appearing (or not) doesn't move anything. */}
      <p className="mt-3 h-4 text-xs text-slate-500 dark:text-slate-400">
        {remaining > 0 ? t("deck.nextBatch", "Play again for the next words") : ""}
      </p>
    </div>
  );
}
