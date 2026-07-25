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
 */
export default function DeckRoundProgress({
  deckId,
  className = "",
}: {
  deckId: string;
  className?: string;
}) {
  const { t } = useLanguage();
  const [progress, setProgress] = useState<DeckProgressSummary | null>(null);

  useEffect(() => {
    if (!deckId) {
      return;
    }

    let cancelled = false;
    fetchDeckProgress(deckId)
      .then((value) => {
        if (!cancelled) {
          setProgress(value);
        }
      })
      .catch(() => {
        // Non-critical: the results screen still works without it.
      });

    return () => {
      cancelled = true;
    };
  }, [deckId]);

  if (!progress || progress.total === 0) {
    return null;
  }

  const remaining = progress.total - progress.known;

  return (
    <div
      className={`mx-auto max-w-sm rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      <DeckProgress known={progress.known} total={progress.total} />
      {remaining > 0 && (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          {t("deck.nextBatch", "Play again for the next words")}
        </p>
      )}
    </div>
  );
}
