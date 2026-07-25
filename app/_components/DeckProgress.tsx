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
  variant = "bar",
  className = "",
}: {
  known: number;
  total: number;
  /** "bar" shows a labelled progress bar; "compact" is a single line of text. */
  variant?: "bar" | "compact";
  className?: string;
}) {
  const { t } = useLanguage();

  const safeTotal = Math.max(0, total);
  const safeKnown = Math.max(0, Math.min(known, safeTotal));
  const remaining = safeTotal - safeKnown;
  const percent = safeTotal > 0 ? Math.round((safeKnown / safeTotal) * 100) : 0;
  const isComplete = safeTotal > 0 && remaining === 0;

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

      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
        role="progressbar"
        aria-valuenow={safeKnown}
        aria-valuemin={0}
        aria-valuemax={safeTotal}
        aria-label={label}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isComplete ? "bg-emerald-500" : "bg-blue-500 dark:bg-blue-400"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
