"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useLanguage } from "../../_lib/languageContext";
import {
  ApiError,
  DeckProgressSummary,
  DeckWithWords,
  fetchDeckProgress,
  getDeck,
} from "../../games/_lib/deckSessionClient";
import DeckProgress from "@/app/_components/DeckProgress";

const GAME_MODE_IDS = [
  {
    id: "flip-cards",
    icon: "🃏",
    tKey: "games.flipCards",
    descKey: "games.flipCardsDesc",
  },
  {
    id: "one-of-three",
    icon: "🎯",
    tKey: "games.oneOfThree",
    descKey: "games.oneOfThreeDesc",
  },
  {
    id: "guess-match",
    icon: "🔗",
    tKey: "games.guessMatch",
    descKey: "games.guessMatchDesc",
  },
  {
    id: "quick-guess",
    icon: "⚡",
    tKey: "games.quickGuess",
    descKey: "games.quickGuessDesc",
  },
];

function PracticeModeSelector() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const deckId = searchParams.get("deck") ?? "";
  const [deck, setDeck] = useState<DeckWithWords | null>(null);
  const [progress, setProgress] = useState<DeckProgressSummary | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound">(
    deckId ? "loading" : "notfound",
  );

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
        // Non-critical: the launcher still works without the progress bar.
      });

    getDeck(deckId)
      .then((data) => {
        if (!cancelled) {
          setDeck(data.deck);
          setStatus("ready");
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setStatus("notfound");
          if (!(err instanceof ApiError)) {
            // network/parse error — treat as not found for the selector
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [deckId]);

  if (status !== "ready" || !deck) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <p className="text-slate-600 dark:text-slate-400">
            {status === "loading"
              ? t("common.loading", "Loading…")
              : t("practice.deckNotFound")}
          </p>
          <Link
            href="/my-decks"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            {t("practice.backToDecks")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <Link
              href="/my-decks"
              className="mb-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              ← {t("practice.backToDecks")}
            </Link>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 sm:text-4xl">
              {t("practice.choosePracticeMode")}
            </h1>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              {deck.name} ({deck.nativeLang} ↔ {deck.foreignLang})
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {GAME_MODE_IDS.map((mode) => (
            <Link
              key={mode.id}
              href={`/games/${mode.id}?deck=${deck.id}`}
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-blue-400 hover:shadow-lg dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-500"
            >
              <div className="text-4xl">{mode.icon}</div>
              <h2 className="mt-4 text-xl font-bold text-slate-900 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400">
                {t(mode.tKey)}
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {t(mode.descKey)}
              </p>
            </Link>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/60 dark:bg-amber-950/30">
          <h2 className="text-lg font-bold text-amber-900 dark:text-amber-200">
            🏁 {t("practice.finishRound", "Finish round")}
          </h2>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-300/90">
            {t(
              "practice.finishRoundDesc",
              "Drill the hardest words you keep getting wrong.",
            )}
          </p>
          <Link
            href={`/games/quick-guess?deck=${deck.id}&mode=finish`}
            className="mt-4 inline-block rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
          >
            {t("practice.startFinishRound", "Start finish round")}
          </Link>
        </div>

        {progress && progress.total > 0 && (
          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
            <DeckProgress known={progress.known} total={progress.total} />
          </div>
        )}

        <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {t("practice.info")}:
            </span>{" "}
            {t("practice.deckHasWords")} {deck.words.length}{" "}
            {t("practice.chooseAMode")}
          </p>
        </div>
      </div>
    </div>
  );
}

export default PracticeModeSelector;
