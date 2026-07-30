"use client";

import Link from "next/link";
import { useCallback, useState, useSyncExternalStore } from "react";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { useLanguage } from "../_lib/languageContext";

/**
 * Explains what the "Learned" badge and its ×N actually count.
 *
 * The number is mastery progress, not rounds played — a confident flip-card
 * answer moves it by two — and nothing in the UI said so, which made a word
 * mastered in two answers read as if it had been practised four times.
 *
 * Pass `storageKey` to make it dismissible: on My Decks it is a one-time
 * welcome and stays closed forever, while on the Learned Words page it is the
 * legend for the badges next to it and has to stay.
 */
export default function MasteryTip({
  storageKey,
  className = "",
}: {
  storageKey?: string;
  className?: string;
}) {
  const { t } = useLanguage();

  const subscribe = useCallback((onChange: () => void) => {
    // Another tab dismissing it should close this one too.
    window.addEventListener("storage", onChange);
    return () => window.removeEventListener("storage", onChange);
  }, []);

  const wasDismissed = useSyncExternalStore(
    subscribe,
    () => {
      if (!storageKey) {
        return false;
      }
      try {
        return window.localStorage.getItem(storageKey) === "1";
      } catch {
        // Private mode or storage disabled: showing the tip every time is the
        // harmless direction to fail in.
        return false;
      }
    },
    // Server-rendered as already dismissed, because there is no way to know
    // yet — better a tip that appears a beat late than one that flashes at
    // everyone who closed it months ago.
    () => Boolean(storageKey),
  );

  const [dismissedNow, setDismissedNow] = useState(false);

  const dismiss = () => {
    setDismissedNow(true);
    try {
      window.localStorage.setItem(storageKey as string, "1");
    } catch {
      // Nothing to do — it reappears next visit, which is not worth an error.
    }
  };

  if (wasDismissed || dismissedNow) {
    return null;
  }

  return (
    <div
      className={`relative flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 pr-10 text-sm shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/40 sm:p-5 sm:pr-12 ${className}`}
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
        <Sparkles size={16} />
      </span>

      <div className="min-w-0">
        <p className="font-semibold text-emerald-900 dark:text-emerald-100">
          {t("masteryTip.title", "What “Learned” means")}
        </p>
        <p className="mt-1 leading-relaxed text-emerald-800/90 dark:text-emerald-200/90">
          {t(
            "masteryTip.body",
            "A word needs 3 points to count as learned. Flip cards and speed spelling give 2 points for a right answer. Other games give 1. A wrong answer takes 1 point back and the word comes again later. So “Learned ×4” means 4 points — not 4 games.",
          )}
        </p>
        <Link
          href="/blog/how-katchup-counts-learned-words"
          className="mt-2 inline-flex items-center gap-1 font-semibold text-emerald-700 underline-offset-2 transition hover:gap-1.5 hover:underline dark:text-emerald-300"
        >
          {t("masteryTip.readMore", "How KatchUp counts learned words")}
          <ArrowRight size={14} />
        </Link>
      </div>

      {storageKey && (
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("common.close", "Close")}
          className="absolute right-2 top-2 rounded-lg p-1.5 text-emerald-700/70 transition hover:bg-emerald-100 hover:text-emerald-900 dark:text-emerald-300/70 dark:hover:bg-emerald-900/60 dark:hover:text-emerald-100"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
