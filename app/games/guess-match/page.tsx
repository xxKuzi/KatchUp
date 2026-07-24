"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import GamePage from "../_components/GamePage";
import DeckMessage from "../_components/DeckMessage";
import { useLanguage } from "@/app/_lib/languageContext";
import { Language } from "@/app/_lib/translations";
import {
  completeTopicLevel,
  loadTopicsState,
  saveTopicsState,
} from "@/app/topics/_lib/topicsProgress";
import { getAllWords } from "../_lib/learning/wordDatabase";
import { MISTAKES_PRACTICE_ENERGY_REWARD } from "@/app/my-decks/_lib/customDecks";
import { gainEnergy, spendEnergy } from "@/app/_lib/energy";
import { useDeckSession } from "../_hooks/useDeckSession";
import { useAuthState } from "@/app/_lib/auth";

interface PracticeWord {
  id: string;
  native: string;
  foreign: string;
}

const MAX_PAIRS = 6;
const GATE = {
  name: "Word Pairing",
  description: "Match each word with its translation.",
  bgImage: "guess_match.png",
};

function hashSeed(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function createSeededRandom(seed: string): () => number {
  let state = hashSeed(seed) || 1;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function shuffleWithSeed<T>(items: T[], seed: string): T[] {
  const random = createSeededRandom(seed);
  const cloned = [...items];

  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [cloned[index], cloned[swapIndex]] = [cloned[swapIndex], cloned[index]];
  }

  return cloned;
}

function buildRoundWords(words: PracticeWord[], seed: string): PracticeWord[] {
  const shuffled = shuffleWithSeed(words, seed);
  return shuffled.slice(0, Math.min(MAX_PAIRS, shuffled.length));
}

const GuessMatchPage = () => {
  const searchParams = useSearchParams();
  const { language } = useLanguage();
  const { isSignedIn, isReady, signIn } = useAuthState();

  const deckId = searchParams.get("deck") ?? "";
  const topicId = searchParams.get("topicId") ?? "";
  const level = Number(searchParams.get("level") ?? "1");
  const safeLevel = Number.isFinite(level)
    ? Math.max(1, Math.min(5, level))
    : 1;
  const isEnergyReview = searchParams.get("energyReview") === "1";
  const sessionMode =
    searchParams.get("mode") === "finish" ? "finish" : "practice";

  const [attempt, setAttempt] = useState(0);

  const deckSession = useDeckSession(deckId || null, sessionMode);

  const allWords = useMemo(() => getAllWords("german"), []);
  const roundSeed = deckId
    ? `deck:${deckId}:${sessionMode}:guess-match:${
        deckSession.session?.words.map((w) => w.id).join(",") ?? ""
      }`
    : `${topicId || "default"}:${safeLevel}:guess-match:${attempt}`;

  const pairs = useMemo<PracticeWord[]>(() => {
    if (deckId) {
      const words = (deckSession.session?.words ?? []).map((word) => ({
        id: word.id,
        native: word.native,
        foreign: word.foreign,
      }));
      return words.slice(0, MAX_PAIRS);
    }
    return buildRoundWords(allWords, roundSeed);
  }, [deckId, deckSession.session, allWords, roundSeed]);

  const leftTiles = useMemo(
    () => shuffleWithSeed(pairs, `${roundSeed}:left`),
    [pairs, roundSeed],
  );
  const rightTiles = useMemo(
    () => shuffleWithSeed(pairs, `${roundSeed}:right`),
    [pairs, roundSeed],
  );

  if (deckId) {
    if ((isReady && !isSignedIn) || deckSession.status === "unauthorized") {
      return (
        <DeckMessage
          {...GATE}
          title="Sign in to practice this deck"
          body="Your progress is saved to your account."
          action={{ label: "Sign in", onClick: signIn }}
        />
      );
    }
    if (deckSession.status === "loading" || deckSession.status === "idle") {
      return <DeckMessage {...GATE} title="Loading deck…" />;
    }
    if (deckSession.status === "notfound") {
      return (
        <DeckMessage {...GATE} title="Deck not found" backHref="/my-decks" />
      );
    }
    if (deckSession.status === "empty") {
      return (
        <DeckMessage
          {...GATE}
          title={
            sessionMode === "finish"
              ? "No hard words to review yet"
              : "You've mastered every word in this deck! 🎉"
          }
          backHref="/my-decks"
        />
      );
    }
  }

  return (
    <GuessMatchRound
      key={roundSeed}
      pairs={pairs}
      leftTiles={leftTiles}
      rightTiles={rightTiles}
      deckId={deckId}
      sessionMode={sessionMode}
      topicId={topicId}
      safeLevel={safeLevel}
      language={language}
      isEnergyReview={isEnergyReview}
      onResult={deckId ? deckSession.recordResult : undefined}
      onReplay={() => {
        if (deckId) {
          deckSession.reload();
        } else {
          setAttempt((value) => value + 1);
        }
      }}
    />
  );
};

interface GuessMatchRoundProps {
  pairs: PracticeWord[];
  leftTiles: PracticeWord[];
  rightTiles: PracticeWord[];
  deckId: string;
  sessionMode: "practice" | "finish";
  topicId: string;
  safeLevel: number;
  language: Language;
  isEnergyReview: boolean;
  onResult?: (deckWordId: string, correct: boolean) => void;
  onReplay: () => void;
}

function GuessMatchRound(props: GuessMatchRoundProps) {
  const {
    pairs,
    leftTiles,
    rightTiles,
    deckId,
    sessionMode,
    topicId,
    safeLevel,
    language,
    isEnergyReview,
    onResult,
    onReplay,
  } = props;
  const totalPairs = pairs.length;

  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [wrongPair, setWrongPair] = useState<{
    left: string;
    right: string;
  } | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [lessonPassed, setLessonPassed] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const completionSaved = useRef(false);

  useEffect(() => {
    if (isFinished || totalPairs === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedSeconds((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isFinished, totalPairs]);

  const finishGame = (finalMistakes: number) => {
    const scorePercent = Math.round(
      (totalPairs / (totalPairs + finalMistakes)) * 100,
    );
    const passed = scorePercent >= 70;

    if (isEnergyReview) {
      gainEnergy(MISTAKES_PRACTICE_ENERGY_REWARD);
    } else {
      spendEnergy(1);
    }
    setLessonPassed(passed);
    setIsFinished(true);

    if (
      passed &&
      topicId &&
      !deckId &&
      !completionSaved.current &&
      totalPairs > 0
    ) {
      const state = loadTopicsState(language);
      const { nextState } = completeTopicLevel(state, topicId, safeLevel);
      saveTopicsState(language, nextState);
      completionSaved.current = true;
    }
  };

  const resolveAttempt = (leftId: string, rightId: string) => {
    if (leftId === rightId) {
      onResult?.(leftId, true);
      const nextMatched = new Set(matchedIds);
      nextMatched.add(leftId);
      setMatchedIds(nextMatched);
      setSelectedLeft(null);
      setSelectedRight(null);

      if (nextMatched.size === totalPairs) {
        finishGame(mistakes);
      }
      return;
    }

    // Wrong pairing: penalize the word the user was trying to match (left).
    onResult?.(leftId, false);
    const nextMistakes = mistakes + 1;
    setMistakes(nextMistakes);
    setWrongPair({ left: leftId, right: rightId });

    window.setTimeout(() => {
      setWrongPair(null);
      setSelectedLeft(null);
      setSelectedRight(null);
    }, 550);
  };

  const handlePick = (side: "left" | "right", id: string) => {
    if (matchedIds.has(id) || wrongPair) {
      return;
    }

    if (side === "left") {
      if (selectedLeft === id) {
        setSelectedLeft(null);
        return;
      }
      setSelectedLeft(id);
      if (selectedRight) {
        resolveAttempt(id, selectedRight);
      }
      return;
    }

    if (selectedRight === id) {
      setSelectedRight(null);
      return;
    }
    setSelectedRight(id);
    if (selectedLeft) {
      resolveAttempt(selectedLeft, id);
    }
  };

  const scorePercent =
    totalPairs > 0
      ? Math.round((totalPairs / (totalPairs + mistakes)) * 100)
      : 0;
  const progressPercent =
    totalPairs > 0 ? Math.round((matchedIds.size / totalPairs) * 100) : 0;

  const backHref = deckId
    ? "/my-decks"
    : topicId
      ? `/topics/${encodeURIComponent(topicId)}`
      : "/games";
  const backLabel = deckId
    ? "Back to decks"
    : topicId
      ? "Back to topic"
      : "Back to games";

  const headerLabel = deckId
    ? sessionMode === "finish"
      ? "Finish Round"
      : "Custom Deck"
    : `Lesson ${safeLevel}`;

  const tileClass = (
    isMatched: boolean,
    isSelected: boolean,
    isWrong: boolean,
  ) =>
    `w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition sm:text-base ${
      isMatched
        ? "border-emerald-300 bg-emerald-50 text-emerald-700 opacity-60 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
        : isWrong
          ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
          : isSelected
            ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
            : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-100"
    }`;

  return (
    <GamePage
      name="Word Pairing"
      description="Match each word with its translation before the mistakes pile up. Reach 70% accuracy to complete the lesson."
      bgImage="guess_match.png"
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
        <div className="bg-linear-to-r from-emerald-300 via-teal-300 to-cyan-300 p-5 dark:from-emerald-700 dark:via-teal-700 dark:to-cyan-700">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-700 dark:text-emerald-100">
            {headerLabel}
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            Synonym Match
          </h2>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-100">
            <span>
              Matched {matchedIds.size}/{totalPairs}
            </span>
            <span>Mistakes: {mistakes}</span>
            <span>{elapsedSeconds}s</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-white/50">
            <div
              className="h-full rounded-full bg-slate-900 transition-all dark:bg-white"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {!isFinished && totalPairs > 0 && (
            <>
              <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Tap a word, then tap its match
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  {leftTiles.map((word) => (
                    <button
                      key={`left-${word.id}`}
                      type="button"
                      disabled={matchedIds.has(word.id)}
                      onClick={() => handlePick("left", word.id)}
                      className={tileClass(
                        matchedIds.has(word.id),
                        selectedLeft === word.id,
                        wrongPair?.left === word.id,
                      )}
                    >
                      {word.native}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  {rightTiles.map((word) => (
                    <button
                      key={`right-${word.id}`}
                      type="button"
                      disabled={matchedIds.has(word.id)}
                      onClick={() => handlePick("right", word.id)}
                      className={tileClass(
                        matchedIds.has(word.id),
                        selectedRight === word.id,
                        wrongPair?.right === word.id,
                      )}
                    >
                      {word.foreign}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {!isFinished && totalPairs === 0 && (
            <p className="text-center text-slate-600 dark:text-slate-300">
              No words available for this round yet.
            </p>
          )}

          {isFinished && (
            <div className="text-center">
              <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100">
                {lessonPassed ? "Lesson completed" : "Try once more"}
              </h3>
              <p className="mt-3 text-slate-600 dark:text-slate-300">
                Accuracy: {scorePercent}% - {mistakes} mistake
                {mistakes === 1 ? "" : "s"} - {elapsedSeconds}s
              </p>
              <div className="mt-2 flex items-center justify-center gap-2 text-sm font-semibold">
                {lessonPassed ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-700 dark:text-emerald-300">
                      Passed
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                    <span className="text-rose-700 dark:text-rose-300">
                      Failed
                    </span>
                  </>
                )}
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href={backHref}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  {backLabel}
                </Link>
                {deckId && sessionMode !== "finish" && (
                  <Link
                    href={`/games/guess-match?deck=${deckId}&mode=finish`}
                    className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
                  >
                    🏁 Finish round
                  </Link>
                )}
                <button
                  type="button"
                  onClick={onReplay}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Play again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </GamePage>
  );
}

export default GuessMatchPage;
