"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, GraduationCap } from "lucide-react";
import FeatureGate from "@/app/_components/FeatureGate";
import { useAuthState } from "@/app/_lib/auth";
import { useLanguage } from "@/app/_lib/languageContext";
import { LANG_LABELS } from "@/app/_lib/languages";
import { LEVEL_TEST_PASS_RATIO } from "@/app/_lib/level";
import { notifyLevelChanged } from "@/app/_lib/useLearningLevel";

interface TestQuestion {
  conceptId: string;
  prompt: string;
  options: string[];
}

/**
 * Two exams share this page, because the paper looks the same either way — a
 * prompt, four options, no feedback until the end. Only what is on the line
 * differs, so the promotion fields are absent on a placement and vice versa.
 */
interface TestPayload {
  /** Promotion only: the level being sat for and what it normally costs. */
  currentLevel?: number;
  targetLevel?: number;
  wordsAtTargetLevel?: number;
  /** Placement only: how many of a band's questions must land to clear it. */
  bandPass?: number;
  questionsPerBand?: number;
  questions: TestQuestion[];
}

interface TestResult {
  correct: number;
  total: number;
  level: number;
  masteredCount: number;
  /** Promotion only. */
  passed?: boolean;
  previousLevel?: number;
  /** Placement only: where the answers put the learner. */
  band?: string;
  correctByBand?: Record<string, number>;
}

const PASS_PERCENT = Math.round(LEVEL_TEST_PASS_RATIO * 100);

export default function LevelTestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn, isReady } = useAuthState();
  const { language, learningLanguage } = useLanguage();
  // Setting a language up sends the learner here to be placed. The server is the
  // one that decides whether they are still entitled to it — this only picks
  // which exam to ask for.
  const placement = searchParams.get("placement") === "1";
  const endpoint = placement
    ? "/api/decks/level/placement"
    : "/api/decks/level/test";

  const [test, setTest] = useState<TestPayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadTest = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setAnswers({});
    setIndex(0);

    try {
      const response = await fetch(
        `${endpoint}?speak=${language}&learning=${learningLanguage}`,
      );
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error ?? "Could not start the test");
      }

      setTest(body as TestPayload);
    } catch (cause) {
      setTest(null);
      setError(
        cause instanceof Error ? cause.message : "Could not start the test",
      );
    } finally {
      setLoading(false);
    }
  }, [language, learningLanguage, endpoint]);

  useEffect(() => {
    // Wait for the session to resolve — acting on the not-yet-known signed-out
    // state would flash the sign-in gate at someone who is signed in.
    if (!isReady) {
      return;
    }
    if (!isSignedIn) {
      setLoading(false);
      return;
    }
    void loadTest();
  }, [isReady, isSignedIn, loadTest]);

  const handleAnswer = (conceptId: string, option: string) => {
    setAnswers((current) => ({ ...current, [conceptId]: option }));
  };

  const handleSubmit = async () => {
    if (!test) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speak: language,
          learning: learningLanguage,
          answers: test.questions.map((question) => ({
            conceptId: question.conceptId,
            answer: answers[question.conceptId] ?? "",
          })),
        }),
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error ?? "Could not grade the test");
      }

      setResult(body as TestResult);
      // A placement always moves the level — even A1 is a level to be put on —
      // so the badge repaints either way rather than only on a pass.
      if (body.passed || placement) {
        notifyLevelChanged();
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not grade the test",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const question = test?.questions[index] ?? null;
  const answeredCount = test
    ? test.questions.filter((item) => answers[item.conceptId]).length
    : 0;
  const allAnswered = Boolean(test) && answeredCount === test?.questions.length;

  return (
    <FeatureGate
      isAllowed={isSignedIn || !isReady}
      message="Sign in to take the level test and skip ahead a level."
    >
      <main className="mx-auto w-full max-w-2xl px-4 pb-24">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-6 inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="rounded-[2rem] border border-slate-200 bg-white/85 p-6 shadow-xl backdrop-blur-xl sm:p-8 dark:border-slate-800 dark:bg-slate-950/80">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
              <GraduationCap className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                {placement ? "Where do you start?" : "Level test"}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {LANG_LABELS[learningLanguage]} · answer in{" "}
                {LANG_LABELS[language]}
              </p>
            </div>
          </div>

          {loading && (
            <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">
              Building your test...
            </p>
          )}

          {!loading && error && !test && (
            <div className="mt-8">
              <p className="text-sm font-semibold text-rose-500">{error}</p>
              <button
                type="button"
                onClick={() => void loadTest()}
                className="mt-4 cursor-pointer rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Try again
              </button>
            </div>
          )}

          {/* --- Result --- */}
          {test && result && (
            <div className="mt-8">
              <p
                className={`text-4xl font-black ${
                  result.passed || placement
                    ? "text-emerald-500"
                    : "text-rose-500"
                }`}
              >
                {result.correct}/{result.total}
              </p>
              {/* A placement has no pass or fail — it has an answer. Being put at
                  A1 is the correct outcome for a beginner, not a failure, so it
                  is not dressed as one. */}
              {placement ? (
                <>
                  <p className="mt-3 text-lg font-bold text-slate-900 dark:text-white">
                    You start at {result.band} — level {result.level}.
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {result.level > 1
                      ? `That is a head start of ${result.masteredCount} words. Everything above it is climbed a level at a time.`
                      : "Right at the beginning, which is where most people start. The first levels go quickly."}
                  </p>
                </>
              ) : result.passed ? (
                <>
                  <p className="mt-3 text-lg font-bold text-slate-900 dark:text-white">
                    Passed — welcome to level {result.level}!
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    You jumped from level {result.previousLevel} to level{" "}
                    {result.level} ({result.masteredCount} words).
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-3 text-lg font-bold text-slate-900 dark:text-white">
                    Not quite — {PASS_PERCENT}% is needed to move up.
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    You&apos;re still level {result.level}. Practise a little
                    and try again.
                  </p>
                </>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                {/* Placement is sat once, so no retake — the server would refuse
                    it anyway now that the answers are on record. */}
                {!result.passed && !placement && (
                  <button
                    type="button"
                    onClick={() => void loadTest()}
                    className="cursor-pointer rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
                  >
                    Retake the test
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => router.push("/games")}
                  className="cursor-pointer rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Back to games
                </button>
              </div>
            </div>
          )}

          {/* --- Questions --- */}
          {test && !result && question && (
            <div className="mt-8">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                <span>
                  {placement
                    ? "Placement"
                    : `Level ${test.currentLevel} → ${test.targetLevel}`}
                </span>
                <span>
                  {index + 1} / {test.questions.length}
                </span>
              </div>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                {placement ? (
                  <>
                    These get harder as they go, and they are not in order.
                    Answer what you know and guess the rest — you start wherever
                    the answers say, which may well be higher than you expect.
                  </>
                ) : (
                  <>
                    Level {test.targetLevel} normally takes{" "}
                    {test.wordsAtTargetLevel} mastered words — score{" "}
                    {PASS_PERCENT}% to skip straight to it.
                  </>
                )}
              </p>

              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-300 dark:bg-blue-400"
                  style={{
                    width: `${(answeredCount / test.questions.length) * 100}%`,
                  }}
                />
              </div>

              <p className="mt-8 text-center text-3xl font-black text-slate-900 dark:text-white">
                {question.prompt}
              </p>

              <div className="mt-6 grid gap-2.5">
                {question.options.map((option) => {
                  const selected = answers[question.conceptId] === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => handleAnswer(question.conceptId, option)}
                      className={`cursor-pointer rounded-2xl border px-4 py-3.5 text-left text-sm font-semibold transition ${
                        selected
                          ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/60 dark:text-blue-300"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>

              {error && (
                <p className="mt-4 text-sm font-semibold text-rose-500">
                  {error}
                </p>
              )}

              {/* No feedback between questions: it's an exam, not a drill. */}
              <div className="mt-7 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => setIndex((value) => Math.max(0, value - 1))}
                  className="cursor-pointer rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Previous
                </button>

                {index < test.questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setIndex((value) =>
                        Math.min(test.questions.length - 1, value + 1),
                      )
                    }
                    className="cursor-pointer rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!allAnswered || submitting}
                    onClick={() => void handleSubmit()}
                    className="cursor-pointer rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-emerald-500 dark:hover:bg-emerald-400"
                  >
                    {submitting ? "Grading..." : "Finish test"}
                  </button>
                )}
              </div>

              {!allAnswered && index === test.questions.length - 1 && (
                <p className="mt-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
                  Answer all {test.questions.length} questions to finish.
                </p>
              )}
            </div>
          )}
        </div>
      </main>
    </FeatureGate>
  );
}
