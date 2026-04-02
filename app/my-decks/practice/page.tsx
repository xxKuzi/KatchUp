"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CustomDeck,
  loadCustomDecks,
  saveCustomDecks,
} from "../_lib/customDecks";

const GAME_MODES = [
  {
    id: "flip-cards",
    name: "Flip Cards",
    description: "Flip through cards and test your memory",
    icon: "🃏",
  },
  {
    id: "one-of-three",
    name: "One of Three",
    description: "Choose the correct translation from three options",
    icon: "🎯",
  },
  {
    id: "guess-match",
    name: "Guess Match",
    description: "Match native words with their translations",
    icon: "🔗",
  },
  {
    id: "quick-guess",
    name: "Quick Guess",
    description: "Rapid-fire translation challenges",
    icon: "⚡",
  },
];

function PracticeModeSelector() {
  const searchParams = useSearchParams();
  const [deck, setDeck] = useState<CustomDeck | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const deckId = searchParams.get("deck");

      if (!deckId) {
        return;
      }

      const decks = loadCustomDecks();
      const selectedDeck = decks.find((d) => d.id === deckId) ?? null;

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
  }, [searchParams]);

  if (!deck) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <p className="text-slate-600 dark:text-slate-400">
            Deck not found. Please select a deck from the overview.
          </p>
          <Link
            href="/my-decks"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            Back to Decks
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
              ← Back to Decks
            </Link>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 sm:text-4xl">
              Choose Practice Mode
            </h1>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              {deck.name} ({deck.nativeLang} ↔ {deck.foreignLang})
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {GAME_MODES.map((mode) => (
            <Link
              key={mode.id}
              href={`/games/${mode.id}?deck=${deck.id}`}
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-blue-400 hover:shadow-lg dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-500"
            >
              <div className="text-4xl">{mode.icon}</div>
              <h2 className="mt-4 text-xl font-bold text-slate-900 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400">
                {mode.name}
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {mode.description}
              </p>
            </Link>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Info:
            </span>{" "}
            This deck has {deck.words.length} words. Choose a practice mode to
            start.
          </p>
        </div>
      </div>
    </div>
  );
}

export default PracticeModeSelector;
