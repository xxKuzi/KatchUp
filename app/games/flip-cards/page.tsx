"use client";
import { useEffect, useState } from "react";
import FlipCard from "../../_components/FlipCard";
import GamePage from "../_components/GamePage";
import { useLearningProgress } from "../_hooks/useLearningProgress";
import { SupportedLanguage } from "../_lib/learning/types";

const LANGUAGE_OPTIONS: SupportedLanguage[] = ["german", "spanish"];
const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  german: "German",
  spanish: "Spanish",
};

const FlipCardsPage = () => {
  const [language, setLanguage] = useState<SupportedLanguage>("german");
  const { activeWords, stats, progress, isHydrated, markCorrect, reset } =
    useLearningProgress(language);
  const [wordIndex, setWordIndex] = useState(0);
  const [isForeign, setIsForeign] = useState(true);

  useEffect(() => {
    setWordIndex(0);
    setIsForeign(true);
  }, [language]);

  useEffect(() => {
    if (activeWords.length === 0) {
      setWordIndex(0);
      return;
    }

    if (wordIndex >= activeWords.length) {
      setWordIndex(activeWords.length - 1);
    }
  }, [activeWords.length, wordIndex]);

  const currentWord = activeWords[wordIndex];

  const flipCard = () => {
    setIsForeign((prev) => !prev);
  };

  const markCurrentAsCorrect = () => {
    if (!currentWord) {
      return;
    }

    markCorrect(currentWord.id);
    setIsForeign(true);
  };

  return (
    <GamePage
      name="Flip Cards"
      description="Practice and master words by lecture. Correct answers hide learned words and unlock one word from the next lecture."
      bgImage="flip_cards.png"
    >
      <div className="flex w-full flex-wrap items-center justify-center gap-2">
        {LANGUAGE_OPTIONS.map((option) => {
          const isActive = option === language;
          return (
            <button
              key={option}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400"
              }`}
              onClick={() => setLanguage(option)}
            >
              {LANGUAGE_LABELS[option]}
            </button>
          );
        })}
      </div>

      <div className="grid w-full max-w-3xl grid-cols-2 gap-3 rounded-xl border border-zinc-200 p-4 text-sm sm:grid-cols-4">
        <p>Lecture: {progress.currentLecture}/10</p>
        <p>Active: {stats.activeCount}</p>
        <p>Mastered: {stats.masteredCount}</p>
        <p>Unlocked: {stats.unlockedCount}</p>
      </div>

      {!isHydrated ? (
        <p className="text-zinc-600">Loading progress...</p>
      ) : !currentWord ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-lg font-semibold">
            You mastered all unlocked {LANGUAGE_LABELS[language]} words.
          </p>
          <button
            className="rounded-lg bg-zinc-800 px-4 py-2 text-white"
            onClick={reset}
          >
            Reset Progress
          </button>
        </div>
      ) : (
        <>
          <FlipCard
            foreign={currentWord.foreign}
            native={currentWord.native}
            isForeign={isForeign}
            flipCard={flipCard}
            index={wordIndex + 1}
          />

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              className="rounded-lg border border-zinc-300 px-4 py-2"
              onClick={flipCard}
            >
              Show Translation
            </button>
            <button
              className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white"
              onClick={markCurrentAsCorrect}
            >
              I Got It Right
            </button>
          </div>

          <div className="flex items-center justify-center gap-2">
            <button
              className="rounded-lg border border-zinc-300 px-4 py-2 disabled:opacity-40"
              onClick={() => setWordIndex((prev) => prev - 1)}
              disabled={wordIndex === 0}
            >
              Previous
            </button>
            <button
              className="rounded-lg border border-zinc-300 px-4 py-2 disabled:opacity-40"
              onClick={() => setWordIndex((prev) => prev + 1)}
              disabled={wordIndex >= activeWords.length - 1}
            >
              Next
            </button>
          </div>
        </>
      )}
    </GamePage>
  );
};

export default FlipCardsPage;
