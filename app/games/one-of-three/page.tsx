"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import GamePage from "../_components/GamePage";
import { useLanguage } from "@/app/_lib/languageContext";
import {
  completeTopicLevel,
  loadTopicsState,
  saveTopicsState,
} from "@/app/topics/_lib/topicsProgress";
import { getAllWords } from "../_lib/learning/wordDatabase";
import type { LectureWord } from "../_lib/learning/types";

interface Question {
  id: string;
  prompt: string;
  options: string[];
  correctOption: string;
}

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

function buildLessonWords(
  words: LectureWord[],
  topicId: string,
  level: number,
): LectureWord[] {
  const shuffled = shuffleWithSeed(words, `${topicId}:${level}:lesson`);
  return shuffled.slice(0, Math.min(10, shuffled.length));
}

function buildQuestions(
  lessonWords: LectureWord[],
  allWords: LectureWord[],
  topicId: string,
  level: number,
): Question[] {
  return lessonWords.map((word, index) => {
    const distractors = shuffleWithSeed(
      allWords
        .filter((candidate) => candidate.id !== word.id)
        .map((candidate) => candidate.foreign),
      `${topicId}:${level}:${word.id}:distractors`,
    ).slice(0, 2);

    const options = shuffleWithSeed(
      [word.foreign, ...distractors],
      `${topicId}:${level}:${word.id}:options`,
    );

    return {
      id: `${word.id}-${index}`,
      prompt: word.native,
      options,
      correctOption: word.foreign,
    };
  });
}

const OneOfThreePage = () => {
  const searchParams = useSearchParams();
  const { language } = useLanguage();

  const topicId = searchParams.get("topicId") ?? "";
  const level = Number(searchParams.get("level") ?? "1");
  const safeLevel = Number.isFinite(level)
    ? Math.max(1, Math.min(5, level))
    : 1;

  const allWords = useMemo(() => getAllWords("german"), []);
  const lessonWords = useMemo(
    () => buildLessonWords(allWords, topicId || "default", safeLevel),
    [allWords, safeLevel, topicId],
  );
  const questions = useMemo(
    () =>
      buildQuestions(lessonWords, allWords, topicId || "default", safeLevel),
    [allWords, lessonWords, safeLevel, topicId],
  );

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

  const handleAnswer = (option: string) => {
    if (!currentQuestion || selectedOption) {
      return;
    }

    const isCorrect = option === currentQuestion.correctOption;
    setSelectedOption(option);

    window.setTimeout(() => {
      const nextCorrectCount = correctCount + (isCorrect ? 1 : 0);
      const nextIndex = questionIndex + 1;

      if (nextIndex >= totalQuestions) {
        const scorePercent =
          totalQuestions > 0
            ? Math.round((nextCorrectCount / totalQuestions) * 100)
            : 0;
        const passed = scorePercent >= 70;

        setCorrectCount(nextCorrectCount);
        setLessonPassed(passed);
        setIsFinished(true);

        if (
          passed &&
          topicId &&
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
    }, 380);
  };

  const scorePercent =
    totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  return (
    <GamePage
      name="One of Three"
      description="Pick the correct German word from three options. Reach 70% to complete the lesson automatically."
      bgImage="one_of_three.png"
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
        <div className="bg-linear-to-r from-amber-300 via-orange-300 to-rose-300 p-5 dark:from-amber-700 dark:via-orange-700 dark:to-rose-700">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-700 dark:text-amber-100">
            Lesson {safeLevel}
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

              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                Correct answers: {correctCount}/{totalQuestions}
              </p>
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
                    <span className="text-rose-700 dark:text-rose-300">Failed</span>
                  </>
                )}
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href={
                    topicId
                      ? `/topics/${encodeURIComponent(topicId)}`
                      : "/topics"
                  }
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  Back to topic
                </Link>
                <Link
                  href={`/games/one-of-three?topicId=${encodeURIComponent(topicId)}&level=${safeLevel}`}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Replay lesson
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </GamePage>
  );
};

export default OneOfThreePage;
