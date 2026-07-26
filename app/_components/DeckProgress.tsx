"use client";

import { useLanguage } from "../_lib/languageContext";

/**
 * How far through a deck the user is.
 *
 * Practice sessions serve 10 words at a time and permanently drop words once
 * mastered, so a 30-word deck is already worked through in batches — this is
 * what makes that visible.
 */
export default function DeckProgress({
  known,
  total,
  cleared,
  variant = "bar",
  showLabel = true,
  className = "",
}: {
  known: number;
  total: number;
  /**
   * Words met — answered right at least once. Drawn as a paler segment behind
   * the solid `known` fill, so a topic bar shows both tiers at once. Omit to
   * draw a single-tier bar.
   */
  cleared?: number;
  /** "bar" shows a labelled progress bar; "compact" is a single line of text. */
  variant?: "bar" | "compact";
  /** Drops the "3 / 6 learned" line, for callers that show the count elsewhere. */
  showLabel?: boolean;
  className?: string;
}) {
  const { t } = useLanguage();

  const safeTotal = Math.max(0, total);
  const safeKnown = Math.max(0, Math.min(known, safeTotal));
  const remaining = safeTotal - safeKnown;
  const percent = safeTotal > 0 ? Math.round((safeKnown / safeTotal) * 100) : 0;
  const isComplete = safeTotal > 0 && remaining === 0;

  // Cleared always contains known, so the pale segment sits underneath rather
  // than after it — no arithmetic to keep the two widths from overlapping.
  const clearedPercent =
    cleared === undefined || safeTotal === 0
      ? 0
      : Math.round(
          (Math.max(safeKnown, Math.min(cleared, safeTotal)) / safeTotal) * 100,
        );

  const label = isComplete
    ? t("deck.allLearned", "All learned 🎉")
    : `${safeKnown} / ${safeTotal} ${t("deck.learned", "learned")}`;

  if (variant === "compact") {
    return (
      <p
        className={`text-sm font-medium ${
          isComplete
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-slate-600 dark:text-slate-300"
        } ${className}`}
      >
        {label}
        {!isComplete && remaining > 0 && (
          <span className="text-slate-500 dark:text-slate-400">
            {" — "}
            {remaining} {t("deck.toGo", "to go")}
          </span>
        )}
      </p>
    );
  }

  return (
    <div className={className}>
      {showLabel && (
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={`text-sm font-semibold ${
              isComplete
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-slate-700 dark:text-slate-200"
            }`}
          >
            {label}
          </span>
          {!isComplete && (
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {remaining} {t("deck.toGo", "to go")}
            </span>
          )}
        </div>
      )}

      <div
        className={`${showLabel ? "mt-2" : ""} relative h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800`}
        role="progressbar"
        aria-valuenow={safeKnown}
        aria-valuemin={0}
        aria-valuemax={safeTotal}
        aria-label={label}
      >
        {clearedPercent > 0 && (
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-blue-500/30 transition-all duration-500 dark:bg-blue-400/30"
            style={{ width: `${clearedPercent}%` }}
          />
        )}
        <div
          className={`relative h-full rounded-full transition-all duration-500 ${
            isComplete ? "bg-emerald-500" : "bg-blue-500 dark:bg-blue-400"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
