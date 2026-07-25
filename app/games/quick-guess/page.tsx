"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import GamePage from "../_components/GamePage";
import DeckMessage from "../_components/DeckMessage";
import { useLanguage } from "@/app/_lib/languageContext";
import type { Lang } from "@/app/_lib/languages";
import {
  completeTopicLevel,
  loadTopicsState,
  saveTopicsState,
} from "@/app/topics/_lib/topicsProgress";
import { useFallbackWords } from "../_lib/useFallbackWords";
import { gainEnergy, spendEnergy, ENERGY_PRACTICE_REWARD } from "@/app/_lib/energy";
import { useDeckSession } from "../_hooks/useDeckSession";
import { useAuthState } from "@/app/_lib/auth";

interface PracticeWord {
  id: string;
  native: string;
  foreign: string;
}

const QUESTION_SECONDS = 12;
const MAX_WORDS = 10;
const CORRECT_ADVANCE_DELAY_MS = 700;
const REVEAL_ADVANCE_DELAY_MS = 2600;

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
  return shuffled.slice(0, Math.min(MAX_WORDS, shuffled.length));
}

const QuickGuessPage = () => {
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
  const [knownWords, setKnownWords] = useState<PracticeWord[]>([]);

  const deckSession = useDeckSession(deckId || null, sessionMode);

  // Fetch the user's known words from the DB for energy-practice.
  useEffect(() => {
    if (!isEnergyReview || deckId) return;
    let cancelled = false;
    fetch("/api/decks/energy-practice")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { words: PracticeWord[] } | null) => {
        if (!cancelled && data?.words) {
          setKnownWords(data.words);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isEnergyReview, deckId, attempt]);

  const allWords = useFallbackWords();
  const roundSeed = `${topicId || "default"}:${safeLevel}:quick-guess:${attempt}`;

  const words = useMemo<PracticeWord[]>(() => {
    if (deckId) {
      return (deckSession.session?.words ?? []).map((word) => ({
        id: word.id,
        native: word.native,
        foreign: word.foreign,
      }));
    }
    // Energy review: use the user's known words from DB.
    if (isEnergyReview && knownWords.length > 0) {
      return knownWords;
    }
    return buildRoundWords(allWords, roundSeed);
  }, [deckId, deckSession.session, isEnergyReview, knownWords, allWords, roundSeed]);

  // Deck path: gate on auth/session status before rendering the round.
  if (deckId) {
    const gate = { name: "Speed Spelling", description: "Type the correct word before the timer runs out.", bgImage: "flip_cards.png" };
    if ((isReady && !isSignedIn) || deckSession.status === "unauthorized") {
      return (
        <DeckMessage
          {...gate}
          title="Sign in to practice this deck"
          body="Your progress is saved to your account."
          action={{ label: "Sign in", onClick: signIn }}
        />
      );
    }
    if (deckSession.status === "loading" || deckSession.status === "idle") {
      return <DeckMessage {...gate} title="Loading deck…" />;
    }
    if (deckSession.status === "notfound") {
      return (
        <DeckMessage {...gate} title="Deck not found" backHref="/my-decks" />
      );
    }
    if (deckSession.status === "empty") {
      return (
        <DeckMessage
          {...gate}
          title={
            sessionMode === "finish"
              ? "No hard words to review yet"
              : "You've mastered every word in this deck! 🎉"
          }
          body={
            sessionMode === "finish"
              ? "Practice some rounds first, then the toughest words show up here."
              : "Nothing left to practice right now."
          }
          backHref="/my-decks"
        />
      );
    }
  }

  return (
    <QuickGuessRound
      key={
        deckId
          ? `deck:${deckId}:${sessionMode}:${words.map((w) => w.id).join(",")}`
          : roundSeed
      }
      words={words}
      deckId={deckId}
      sessionMode={sessionMode}
      topicId={topicId}
      safeLevel={safeLevel}
      language={language}
      isEnergyReview={isEnergyReview}
      onResult={deckId ? deckSession.recordResult : undefined}
      onKnown={deckId ? deckSession.markKnown : undefined}
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

interface QuickGuessRoundProps {
  words: PracticeWord[];
  deckId: string;
  sessionMode: "practice" | "finish";
  topicId: string;
  safeLevel: number;
  language: Lang;
  isEnergyReview: boolean;
  onResult?: (deckWordId: string, correct: boolean) => void;
  onKnown?: (deckWordId: string) => void;
  onReplay: () => void;
}

function QuickGuessRound(props: QuickGuessRoundProps) {
  const {
    words,
    deckId,
    sessionMode,
    topicId,
    safeLevel,
    language,
    isEnergyReview,
    onResult,
    onKnown,
    onReplay,
  } = props;

  const [questionIndex, setQuestionIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [typedValue, setTypedValue] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_SECONDS);
  const [isLocked, setIsLocked] = useState(false);
  const [banner, setBanner] = useState<{
    tone: "good" | "bad";
    text: string;
  } | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [lessonPassed, setLessonPassed] = useState(false);

  const completionSaved = useRef(false);
  const lockedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentWord = words[questionIndex] ?? null;
  const totalWords = words.length;
  const progressPercent =
    totalWords > 0 ? Math.round((questionIndex / totalWords) * 100) : 0;
  const scorePercent =
    totalWords > 0 ? Math.round((correctCount / totalWords) * 100) : 0;

  const goToNext = (nextCorrect: number) => {
    const nextIndex = questionIndex + 1;

    if (nextIndex >= totalWords) {
      const finalScore =
        totalWords > 0 ? Math.round((nextCorrect / totalWords) * 100) : 0;
      const passed = finalScore >= 70;

      if (isEnergyReview) {
        gainEnergy(ENERGY_PRACTICE_REWARD);
      } else {
        spendEnergy(1);
      }
      setCorrectCount(nextCorrect);
      setLessonPassed(passed);
      setIsFinished(true);

      if (
        passed &&
        topicId &&
        !deckId &&
        !completionSaved.current &&
        totalWords > 0
      ) {
        const state = loadTopicsState(language);
        const { nextState } = completeTopicLevel(state, topicId, safeLevel);
        saveTopicsState(language, nextState);
        completionSaved.current = true;
      }
      return;
    }

    setCorrectCount(nextCorrect);
    lockedRef.current = false;
    setIsLocked(false);
    setQuestionIndex(nextIndex);
  };

  const advance = (wasCorrect: boolean, revealText?: string) => {
    if (lockedRef.current) {
      return;
    }

    lockedRef.current = true;
    setIsLocked(true);

    const nextCorrect = correctCount + (wasCorrect ? 1 : 0);

    if (currentWord && deckId) {
      onResult?.(currentWord.id, wasCorrect);
    }

    setBanner(
      wasCorrect
        ? { tone: "good", text: "Correct!" }
        : {
            tone: "bad",
            text: revealText
              ? `Time's up - it was "${revealText}"`
              : "Wrong answer",
          },
    );

    window.setTimeout(
      () => goToNext(nextCorrect),
      wasCorrect ? CORRECT_ADVANCE_DELAY_MS : REVEAL_ADVANCE_DELAY_MS,
    );
  };

  // Deck path only: "I already know this" marks the word known and skips it
  // without counting as a scored attempt.
  const handleKnowIt = () => {
    if (!currentWord || lockedRef.current) {
      return;
    }
    lockedRef.current = true;
    setIsLocked(true);
    onKnown?.(currentWord.id);
    setBanner({ tone: "good", text: "Marked as known" });
    window.setTimeout(() => goToNext(correctCount), CORRECT_ADVANCE_DELAY_MS);
  };

  useEffect(() => {
    if (isFinished || !currentWord) {
      return;
    }

    setSecondsLeft(QUESTION_SECONDS);
    setTypedValue("");
    setBanner(null);

    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, QUESTION_SECONDS - elapsed);
      setSecondsLeft(remaining);

      if (remaining <= 0) {
        window.clearInterval(interval);
        advance(false, currentWord.foreign);
      }
    }, 200);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(focusTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIndex, isFinished]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTypedValue(event.target.value);
    if (banner) {
      setBanner(null);
    }
  };

  const handleSubmit = () => {
    if (!currentWord || lockedRef.current || typedValue.trim().length === 0) {
      return;
    }

    const isCorrect =
      typedValue.trim().toLowerCase() ===
      currentWord.foreign.trim().toLowerCase();

    if (isCorrect) {
      advance(true);
      return;
    }

    setBanner({ tone: "bad", text: "Not quite, keep trying" });
  };

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

  return (
    <GamePage
      name="Speed Spelling"
      description="Type the correct word before the timer runs out. Reach 70% to complete the lesson."
      bgImage="flip_cards.png"
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
        <div className="bg-linear-to-r from-sky-300 via-cyan-300 to-teal-300 p-5 dark:from-sky-700 dark:via-cyan-700 dark:to-teal-700">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-700 dark:text-sky-100">
            {headerLabel}
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            Type the Translation
          </h2>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-100">
            Progress {progressPercent}%
          </p>
          <div className="mt-2 h-2 rounded-full bg-white/50">
            <div
              className="h-full rounded-full bg-slate-900 transition-all dark:bg-white"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {!isFinished && currentWord && (
            <>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center dark:border-slate-800 dark:bg-slate-900/70">
                <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  <Clock className="h-4 w-4" />
                  <span>{secondsLeft}s left</span>
                </div>
                <div className="mx-auto mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-200 ease-linear ${
                      secondsLeft <= 3 ? "bg-rose-500" : "bg-sky-500"
                    }`}
                    style={{
                      width: `${(secondsLeft / QUESTION_SECONDS) * 100}%`,
                    }}
                  />
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Type this word
                </p>
                <p className="mt-2 text-4xl font-black text-slate-900 dark:text-slate-100">
                  {currentWord.native}
                </p>
              </div>

              <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row">
                <input
                  ref={inputRef}
                  type="text"
                  value={typedValue}
                  onChange={handleChange}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleSubmit();
                    }
                  }}
                  disabled={isLocked}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder="Start typing..."
                  className="w-full flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-lg font-semibold text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-600"
                />
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLocked || typedValue.trim().length === 0}
                  className="w-full rounded-2xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 sm:w-auto"
                >
                  Check
                </button>
              </div>

              {banner && (
                <p
                  className={`mt-4 text-center text-sm font-semibold ${
                    banner.tone === "good"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {banner.text}
                </p>
              )}

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Correct answers: {correctCount}/{totalWords}
                </p>
                {deckId && onKnown && (
                  <button
                    type="button"
                    onClick={handleKnowIt}
                    disabled={isLocked}
                    className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                  >
                    ✓ I already know this
                  </button>
                )}
              </div>
            </>
          )}

          {!isFinished && !currentWord && (
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
                Score: {scorePercent}% ({correctCount}/{totalWords})
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
                    href={`/games/quick-guess?deck=${deckId}&mode=finish`}
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

export default QuickGuessPage;
