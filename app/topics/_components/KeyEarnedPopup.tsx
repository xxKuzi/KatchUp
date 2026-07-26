"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Crown, KeyRound, Sparkles, X } from "lucide-react";
import { useLanguage } from "@/app/_lib/languageContext";

interface KeyEarnedPopupProps {
  /** The pack that was just finished, in the language being learned. */
  topicName: string;
  /** Keys held now — the one just earned is already counted. */
  keys: number;
  /** Dismiss without leaving the page. */
  onClose: () => void;
  /** Take the key: dismisses and goes to the pack list to spend it. */
  onSpend: () => void;
  /** The legendary review round, when the pack resolved to a real deck. */
  reviewHref: string | null;
}

/** Sparks flung out from behind the key, at fixed angles so it looks composed. */
const SPARK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/**
 * The key a finished pack earns, handed over on sight.
 *
 * The key used to be collected by pressing "Ascend this pack" — a button that
 * did nothing else, on a screen the player had already been congratulated on.
 * Finishing the fifth level now grants it outright and this is where they hear
 * about it, once: `keyCelebrated` is written on dismiss.
 */
export default function KeyEarnedPopup({
  topicName,
  keys,
  onClose,
  onSpend,
  reviewHref,
}: KeyEarnedPopupProps) {
  const { t } = useLanguage();

  // Escape closes it, like any other dialog.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-[keyPopupFade_0.25s_ease-out]"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-amber-300/80 bg-linear-to-br from-amber-50 via-white to-yellow-100 p-8 text-center shadow-[0_30px_80px_rgba(15,23,42,0.35)] animate-[keyPopupRise_0.45s_cubic-bezier(0.2,0.9,0.3,1.2)] dark:border-amber-800/70 dark:from-slate-950 dark:via-slate-950 dark:to-amber-950/50"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close", "Close")}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 transition hover:bg-black/5 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200"
        >
          <X size={18} />
        </button>

        {/* The key itself: a glow behind it, sparks thrown outward, and a slow
            rock so it reads as landing rather than as an icon sitting there. */}
        <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-amber-400/40 blur-2xl animate-[keyGlow_1.8s_ease-in-out_infinite]" />
          {SPARK_ANGLES.map((angle, index) => (
            <span
              key={angle}
              // The angle rides along as a variable so the flight-out keyframes
              // can keep it while animating the distance.
              style={
                {
                  "--angle": `${angle}deg`,
                  animationDelay: `${index * 0.06}s`,
                } as React.CSSProperties
              }
              className="absolute h-1.5 w-1.5 rounded-full bg-amber-400 animate-[keySpark_1.1s_ease-out_forwards] dark:bg-amber-300"
            />
          ))}
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-amber-300 bg-white shadow-lg animate-[keyLand_0.7s_cubic-bezier(0.2,0.9,0.3,1.4)] dark:border-amber-700 dark:bg-slate-900">
            <KeyRound className="h-9 w-9 text-amber-500 dark:text-amber-300" />
          </div>
        </div>

        <p className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.24em] text-amber-700 dark:text-amber-300">
          <Sparkles size={12} />
          {topicName}
        </p>
        <h2 className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-50">
          {t("topics.keyEarnedTitle", "You earned a key!")}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {t(
            "topics.keyEarnedText",
            "Every level of this pack is done. Spend the key to unlock a new pack — or go for the crown.",
          )}
        </p>
        <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-100/80 px-4 py-1.5 text-sm font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
          <KeyRound size={14} />
          {t("topics.keys", "Keys")}: {keys}
        </p>

        {/* Two ways on: go for the crown, or take the key to the pack list —
            which is where it gets spent, so that is what "back to topics" is. */}
        <div className="mt-6 flex flex-col gap-2">
          {reviewHref && (
            <Link
              href={reviewHref}
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-semibold text-white transition hover:bg-violet-700"
            >
              <Crown size={16} />
              {t("topics.makeLegendary", "Make this deck legendary")}
            </Link>
          )}
          <button
            type="button"
            onClick={onSpend}
            className="mt-2 text-sm font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            {t("topics.back", "Back to topics")}
          </button>
        </div>
      </div>
    </div>
  );
}
