"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, GraduationCap } from "lucide-react";
import FeatureGate from "@/app/_components/FeatureGate";
import { signIn } from "@/lib/auth-client";
import { useAuthState } from "@/app/_lib/auth";
import {
  readChosenLanguagePair,
  useLanguage,
} from "@/app/_lib/languageContext";
import { LANG_LABELS, type CefrLevel } from "@/app/_lib/languages";
import { LEVEL_TEST_PASS_RATIO } from "@/app/_lib/level";
import { saveStoredPlacement } from "@/app/_lib/placement";
import { isPlacementTest } from "@/app/_lib/placementTest";
import { notifyOnboardingChanged } from "@/app/_lib/onboardingEvents";
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
  band?: CefrLevel;
  correctByBand?: Record<string, number>;
  /** Placement sat without an account: the server's signed verdict, to be spent
   *  on whichever account signs in next. */
  ticket?: string;
}

const PASS_PERCENT = Math.round(LEVEL_TEST_PASS_RATIO * 100);

/**
 * How long a pick stays on screen before the placement moves on.
 *
 * Long enough to see which option went blue — an answer that vanishes the
 * instant it is chosen reads as a dropped tap, and the learner comes back to
 * check. Short enough that it never feels like waiting.
 */
const AUTO_ADVANCE_MS = 220;

/**
 * The placement test is mandatory, so it is presented as such: it takes the
 * whole screen, sits over the navbar, and carries no way back. There is nothing
 * to go back to — every route it stands in front of needs the level it is about
 * to establish — and leaving costs only the fifteen questions, since nothing is
 * recorded until the paper is handed in.
 *
 * The level test next door is the opposite: it is optional, sat by a player who
 * already has a level and wants a shortcut to the next one, so it keeps its
 * page and its back button.
 */
export default function LevelTestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn, isReady } = useAuthState();
  const { language, learningLanguage } = useLanguage();
  // Setting a language up sends the learner here to be placed. The server is the
  // one that decides whether they are still entitled to it — this only picks
  // which exam to ask for.
  const placement = isPlacementTest(searchParams);
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

  // A placement with no pair behind it is a test for a language nobody picked.
  // The setup prompt lives on the landing page and asks for one.
  useEffect(() => {
    if (placement && readChosenLanguagePair() === null) {
      router.replace("/");
    }
  }, [placement, router]);

  // The pending move to the next question, so that pressing Previous — or
  // handing the paper in — during the pause after a pick does not get overruled
  // a fifth of a second later by a jump the learner has already changed their
  // mind about.
  const autoAdvance = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelAutoAdvance = useCallback(() => {
    if (autoAdvance.current) {
      clearTimeout(autoAdvance.current);
      autoAdvance.current = null;
    }
  }, []);

  useEffect(() => cancelAutoAdvance, [cancelAutoAdvance]);

  /**
   * Whether the question on screen already had an answer when it came up.
   *
   * This, rather than "is it answered now", is what Next reads. Answering a
   * fresh question is immediately followed by moving off it, so a Next that
   * tracked the live answer would light up and go out again on every single
   * pick — fourteen flashes of a button nobody pressed. Stepping back onto a
   * question you have already done is the case Next is actually for, and that
   * is a state you arrive in rather than one you enter mid-question.
   */
  const [arrivedAnswered, setArrivedAnswered] = useState(false);

  // The one way the question changes, so the arrival state has nowhere else to
  // be kept in step.
  const goToQuestion = useCallback(
    (target: number) => {
      cancelAutoAdvance();
      setIndex(target);
      setArrivedAnswered(
        Boolean(
          test?.questions[target] &&
            answers[test.questions[target].conceptId],
        ),
      );
    },
    [answers, cancelAutoAdvance, test],
  );

  const loadTest = useCallback(async () => {
    cancelAutoAdvance();
    setLoading(true);
    setError(null);
    setResult(null);
    setAnswers({});
    setIndex(0);
    setArrivedAnswered(false);

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
  }, [language, learningLanguage, endpoint, cancelAutoAdvance]);

  useEffect(() => {
    // Wait for the session to resolve — acting on the not-yet-known signed-out
    // state would flash the sign-in gate at someone who is signed in.
    if (!isReady) {
      return;
    }
    // Placement is the one exam a visitor sits: it is what stands between them
    // and everything else, so requiring an account for it would put the sign-up
    // ask before the only thing they came to do.
    if (!isSignedIn && !placement) {
      setLoading(false);
      return;
    }
    void loadTest();
  }, [isReady, isSignedIn, placement, loadTest]);

  const handleAnswer = (conceptId: string, option: string) => {
    setAnswers((current) => ({ ...current, [conceptId]: option }));

    // Fifteen questions of one tap each: making every one of them two taps is
    // fourteen presses of a button that had only one thing to do. The last
    // question has nowhere to go, and handing the paper in is a decision rather
    // than a step, so it is left to be pressed.
    if (!placement || !test || index >= test.questions.length - 1) {
      return;
    }

    cancelAutoAdvance();
    autoAdvance.current = setTimeout(() => {
      autoAdvance.current = null;
      goToQuestion(index + 1);
    }, AUTO_ADVANCE_MS);
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
      const body = (await response.json()) as TestResult & { error?: string };

      if (!response.ok) {
        throw new Error(body?.error ?? "Could not grade the test");
      }

      setResult(body);

      // Nothing was recorded for a visitor, so the verdict has to be kept until
      // there is an account to record it against.
      if (placement && body.ticket && body.band) {
        saveStoredPlacement({
          learning: learningLanguage,
          band: body.band,
          level: body.level,
          ticket: body.ticket,
        });
      }

      // A placement always moves the level — even A1 is a level to be put on —
      // so the badge repaints either way rather than only on a pass.
      if (body.passed || placement) {
        notifyLevelChanged();
      }
      // And it is the thing the setup prompt was holding out for, so the prompt
      // has to be told it can come down.
      if (placement) {
        notifyOnboardingChanged();
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

  const card = (
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
            {LANG_LABELS[learningLanguage]} · answer in {LANG_LABELS[language]}
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
              result.passed || placement ? "text-emerald-500" : "text-rose-500"
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
                You&apos;re still level {result.level}. Practise a little and try
                again.
              </p>
            </>
          )}

          {/* A visitor's placement is real but homeless: it was graded on the
              server and signed, and it is waiting in this browser for an account
              to be put on. Signing in is what spends it, so it is the only thing
              offered here — and it is offered now, while the number they just
              earned is still on the screen. */}
          {placement && !isSignedIn ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/60">
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Keep level {result.level}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Sign in and this result goes on your account. Without one there
                is nowhere to save it, and nothing to play.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() =>
                    void signIn("google", { callbackUrl: "/games" })
                  }
                  className="cursor-pointer rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
                >
                  Continue with Google
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void signIn("github", { callbackUrl: "/games" })
                  }
                  className="cursor-pointer rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Continue with GitHub
                </button>
              </div>
            </div>
          ) : (
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
          )}
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
                These get harder as they go, and they are not in order. Answer
                what you know and guess the rest — you start wherever the answers
                say, which may well be higher than you expect. Leave now and you
                start this over.
              </>
            ) : (
              <>
                Level {test.targetLevel} normally takes{" "}
                {test.wordsAtTargetLevel} mastered words — score {PASS_PERCENT}%
                to skip straight to it.
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
            <p className="mt-4 text-sm font-semibold text-rose-500">{error}</p>
          )}

          {/* No feedback between questions: it's an exam, not a drill. */}
          <div className="mt-7 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => goToQuestion(Math.max(0, index - 1))}
              className="cursor-pointer rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Previous
            </button>

            {index < test.questions.length - 1 ? (
              <button
                type="button"
                disabled={!arrivedAnswered}
                onClick={() =>
                  goToQuestion(Math.min(test.questions.length - 1, index + 1))
                }
                className="cursor-pointer rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-blue-500 dark:hover:bg-blue-400"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                disabled={!allAnswered || submitting}
                onClick={() => {
                  cancelAutoAdvance();
                  void handleSubmit();
                }}
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
  );

  if (placement) {
    return (
      <div className="fixed inset-0 z-100 overflow-y-auto bg-slate-50 dark:bg-slate-950">
        <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-16">
          {card}
        </div>
      </div>
    );
  }

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

        {card}
      </main>
    </FeatureGate>
  );
}
