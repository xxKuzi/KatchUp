"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useLanguage } from "../../_lib/languageContext";
import {
  CustomDeck,
  loadCustomDecks,
  saveCustomDecks,
} from "../_lib/customDecks";

const GAME_MODE_IDS = [
  { id: "flip-cards", icon: "🃏", tKey: "games.flipCards", descKey: "games.flipCardsDesc" },
  { id: "one-of-three", icon: "🎯", tKey: "games.oneOfThree", descKey: "games.oneOfThreeDesc" },
  { id: "guess-match", icon: "🔗", tKey: "games.guessMatch", descKey: "games.guessMatchDesc" },
  { id: "quick-guess", icon: "⚡", tKey: "games.quickGuess", descKey: "games.quickGuessDesc" },
];

function PracticeModeSelector() {
  const { t, nativeLanguage, learningLanguage } = useLanguage();
  const searchParams = useSearchParams();
  const [deck, setDeck] = useState<CustomDeck | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const deckId = searchParams.get("deck");

      if (!deckId) {
        return;
      }

      const decks = loadCustomDecks();
      const selectedDeck =
        decks.find(
          (d) =>
            d.id === deckId &&
            d.nativeLang.trim().toLowerCase() === nativeLanguage &&
            d.foreignLang.trim().toLowerCase() === learningLanguage,
        ) ?? null;

      if (selectedDeck) {
        const updatedDecks = decks.map((d) =>
          d.id === deckId
            ? { ...d, lastPracticed: new Date().toISOString() }
            : d,
        );

        saveCustomDecks(updatedDecks);
        setDeck(selectedDeck);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [searchParams, nativeLanguage, learningLanguage]);

  if (!deck) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <p className="text-slate-600 dark:text-slate-400">
            {t("practice.deckNotFound")}
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

        <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {t("practice.info")}:
            </span>{" "}
            {t("practice.deckHasWords")} {deck.words.length} {t("practice.chooseAMode")}
          </p>
        </div>
      </div>
    </div>
  );
}

export default PracticeModeSelector;
