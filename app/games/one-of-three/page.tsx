"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
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
import type { LectureWord } from "../_lib/learning/types";
import { spendEnergy } from "@/app/_lib/energy";
import { recordMistake } from "@/app/my-decks/_lib/customDecks";
import { useDeckSession } from "../_hooks/useDeckSession";
import { useAuthState } from "@/app/_lib/auth";

interface Question {
  id: string;
  wordId: string;
  prompt: string;
  options: string[];
  correctOption: string;
}

interface SimpleWord {
  id: string;
  native: string;
  foreign: string;
}

const GATE = {
  name: "One of Three",
  description: "Pick the correct translation from three options.",
  bgImage: "one_of_three.png",
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

function buildLessonWords(words: LectureWord[], seed: string): LectureWord[] {
  const shuffled = shuffleWithSeed(words, `${seed}:lesson`);
  return shuffled.slice(0, Math.min(10, shuffled.length));
}

function buildQuestions(
  lessonWords: SimpleWord[],
  distractorPool: string[],
  seed: string,
): Question[] {
  return lessonWords.map((word, index) => {
    const distractors = shuffleWithSeed(
      distractorPool.filter((candidate) => candidate !== word.foreign),
      `${seed}:${word.id}:distractors`,
    ).slice(0, 2);

    const options = shuffleWithSeed(
      [word.foreign, ...distractors],
      `${seed}:${word.id}:options`,
    );

    return {
      id: `${word.id}-${index}`,
      wordId: word.id,
      prompt: word.native,
      options,
      correctOption: word.foreign,
    };
  });
}

const OneOfThreePage = () => {
  const searchParams = useSearchParams();
  const { language } = useLanguage();
  const { isSignedIn, isReady, signIn } = useAuthState();

  const deckId = searchParams.get("deck") ?? "";
  const topicId = searchParams.get("topicId") ?? "";
  const level = Number(searchParams.get("level") ?? "1");
  const safeLevel = Number.isFinite(level)
    ? Math.max(1, Math.min(5, level))
    : 1;
  const sessionMode =
    searchParams.get("mode") === "finish" ? "finish" : "practice";

  const [attempt, setAttempt] = useState(0);

  const deckSession = useDeckSession(deckId || null, sessionMode);

  const allWords = useMemo(() => getAllWords("german"), []);
  const roundSeed = deckId
    ? `deck:${deckId}:${sessionMode}:${
        deckSession.session?.words.map((w) => w.id).join(",") ?? ""
      }`
    : `${topicId || "default"}:${safeLevel}:${attempt}`;

  const questions = useMemo<Question[]>(() => {
    if (deckId) {
      const deckWords = (deckSession.session?.words ?? []).map((word) => ({
        id: word.id,
        native: word.native,
        foreign: word.foreign,
      }));
      // Distractors from the deck itself, padded with the base DB if tiny.
      const pool = [
        ...deckWords.map((word) => word.foreign),
        ...allWords.map((word) => word.foreign),
      ];
      return buildQuestions(deckWords, pool, roundSeed);
    }
    const lessonWords = buildLessonWords(allWords, roundSeed);
    return buildQuestions(
      lessonWords,
      allWords.map((word) => word.foreign),
      roundSeed,
    );
  }, [deckId, deckSession.session, allWords, roundSeed]);

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
    <OneOfThreeRound
      key={roundSeed}
      questions={questions}
      deckId={deckId}
      sessionMode={sessionMode}
      topicId={topicId}
      safeLevel={safeLevel}
      language={language}
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

interface OneOfThreeRoundProps {
  questions: Question[];
  deckId: string;
  sessionMode: "practice" | "finish";
  topicId: string;
  safeLevel: number;
  language: Language;
  onResult?: (deckWordId: string, correct: boolean) => void;
  onKnown?: (deckWordId: string) => void;
  onReplay: () => void;
}

function OneOfThreeRound(props: OneOfThreeRoundProps) {
  const {
    questions,
    deckId,
    sessionMode,
    topicId,
    safeLevel,
    language,
    onResult,
    onKnown,
    onReplay,
  } = props;

  const [questionIndex, setQuestionIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [lessonPassed, setLessonPassed] = useState(false);
  const completionSaved = useRef(false);

  const currentQuestion = questions[questionIndex] ?? null;
  const totalQuestions = questions.length;
  const progressPercent =
    totalQuestions > 0 ? Math.round((questionIndex / totalQuestions) * 100) : 0;

  const goToNext = (nextCorrectCount: number) => {
    const nextIndex = questionIndex + 1;

    if (nextIndex >= totalQuestions) {
      const scorePercent =
        totalQuestions > 0
          ? Math.round((nextCorrectCount / totalQuestions) * 100)
          : 0;
      const passed = scorePercent >= 70;

      spendEnergy();
      setCorrectCount(nextCorrectCount);
      setLessonPassed(passed);
      setIsFinished(true);

      if (
        passed &&
        topicId &&
        !deckId &&
        !completionSaved.current &&
        totalQuestions > 0
      ) {
        const state = loadTopicsState(language);
        const { nextState } = completeTopicLevel(state, topicId, safeLevel);
        saveTopicsState(language, nextState);
        completionSaved.current = true;
      }
      return;
    }

    setCorrectCount(nextCorrectCount);
    setQuestionIndex(nextIndex);
    setSelectedOption(null);
  };

  const handleAnswer = (option: string) => {
    if (!currentQuestion || selectedOption) {
      return;
    }

    const isCorrect = option === currentQuestion.correctOption;
    setSelectedOption(option);

    if (deckId) {
      onResult?.(currentQuestion.wordId, isCorrect);
    } else if (!isCorrect) {
      recordMistake(
        {
          native: currentQuestion.prompt,
          foreign: currentQuestion.correctOption,
        },
        { nativeLang: "english", foreignLang: "deutsch" },
      );
    }

    window.setTimeout(() => {
      goToNext(correctCount + (isCorrect ? 1 : 0));
    }, 380);
  };

  const handleKnowIt = () => {
    if (!currentQuestion || selectedOption) {
      return;
    }
    setSelectedOption(currentQuestion.correctOption);
    onKnown?.(currentQuestion.wordId);
    window.setTimeout(() => goToNext(correctCount), 380);
  };

  const scorePercent =
    totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  const headerLabel = deckId
    ? sessionMode === "finish"
      ? "Finish Round"
      : "Custom Deck"
    : `Lesson ${safeLevel}`;

  return (
    <GamePage
      name="One of Three"
      description="Pick the correct word from three options. Reach 70% to complete the lesson automatically."
      bgImage="one_of_three.png"
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
        <div className="bg-linear-to-r from-amber-300 via-orange-300 to-rose-300 p-5 dark:from-amber-700 dark:via-orange-700 dark:to-rose-700">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-700 dark:text-amber-100">
            {headerLabel}
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            Translation Sprint
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
          {!isFinished && currentQuestion && (
            <>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center dark:border-slate-800 dark:bg-slate-900/70">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  What matches this word?
                </p>
                <p className="mt-2 text-4xl font-black text-slate-900 dark:text-slate-100">
                  {currentQuestion.prompt}
                </p>
              </div>

              <div className="mt-5 grid gap-3">
                {currentQuestion.options.map((option) => {
                  const isCorrect = option === currentQuestion.correctOption;
                  const isSelected = option === selectedOption;
                  const showCorrect = Boolean(selectedOption) && isCorrect;
                  const showWrong =
                    Boolean(selectedOption) && isSelected && !isCorrect;

                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => handleAnswer(option)}
                      disabled={Boolean(selectedOption)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left text-base font-semibold transition ${
                        showCorrect
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                          : showWrong
                            ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
                            : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-slate-700"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Correct answers: {correctCount}/{totalQuestions}
                </p>
                {deckId && onKnown && (
                  <button
                    type="button"
                    onClick={handleKnowIt}
                    disabled={Boolean(selectedOption)}
                    className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                  >
                    ✓ I already know this
                  </button>
                )}
              </div>
            </>
          )}

          {isFinished && (
            <div className="text-center">
              <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100">
                {lessonPassed ? "Lesson completed" : "Try once more"}
              </h3>
              <p className="mt-3 text-slate-600 dark:text-slate-300">
                Score: {scorePercent}% ({correctCount}/{totalQuestions})
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
                  href={
                    deckId
                      ? "/my-decks"
                      : topicId
                        ? `/topics/${encodeURIComponent(topicId)}`
                        : "/topics"
                  }
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  {deckId ? "Back to decks" : "Back to topic"}
                </Link>
                {deckId && sessionMode !== "finish" && (
                  <Link
                    href={`/games/one-of-three?deck=${deckId}&mode=finish`}
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
                  Replay lesson
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </GamePage>
  );
}

export default OneOfThreePage;
