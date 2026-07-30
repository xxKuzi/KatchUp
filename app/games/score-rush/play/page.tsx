"use client";
/* eslint-disable react-hooks/purity */

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GamePage from "../../_components/GamePage";
import { spendEnergy } from "@/app/_lib/energy";
import { useEnergyBlocked } from "../../_lib/energyGate";
import OutOfEnergy from "../../_components/OutOfEnergy";
import {
  isCefrLevel,
  LANG_LABELS,
  normalizeLang,
  type CefrLevel,
} from "@/app/_lib/languages";
import {
  buildOptions,
  fetchWordPairs,
  shuffle,
  type WordPair,
} from "../../_lib/wordPairs";
import { useVocabProgress } from "../../_lib/useVocabProgress";
import { withArticle } from "@/app/_lib/articles";

interface RushQuestion {
  /** Unique per slot in the queue — the same word recurs as the pool recycles. */
  id: string;
  /**
   * The word itself, kept separately from `id`. Progress is recorded against
   * this, and `id` carries a queue-position suffix that would not resolve.
   */
  conceptId: string;
  prompt: string;
  options: string[];
  correctOption: string;
}

type RunStatus = "playing" | "finished";

const RUN_DURATION_MS = 30_000;
const WRONG_ANSWER_DELAY_MS = 2_000;

// Score Rush is a recall drill: it shows the word in your language
// and asks what it means in the language you're learning.
const DIRECTION = "recall" as const;

function buildQuestionQueue(pool: WordPair[], count: number): RushQuestion[] {
  return shuffle(pool)
    .slice(0, Math.min(count, pool.length))
    .map((pair, index) => {
      const rawOptions = buildOptions(pair, pool);
      const formattedOptions = rawOptions.map((optionText) => {
        const match = pool.find((p) => p.answer === optionText);
        return match ? withArticle(optionText, match.answerArticle) : optionText;
      });

      return {
        id: `${pair.conceptId}-${index}`,
        conceptId: pair.conceptId,
        // In recall, the prompt is in the speaker's language (no article needed)
        prompt: withArticle(pair.prompt, pair.promptArticle),
        options: formattedOptions,
        correctOption: withArticle(pair.answer, pair.answerArticle),
      };
    });
}

export default function ScoreRushPlayPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // `language` is the pre-migration param name, kept so older links and the
  // lobby's in-flight navigations still resolve to a sensible pair.
  const speak = normalizeLang(searchParams.get("speak")) ?? "en";
  const learning =
    normalizeLang(searchParams.get("learning")) ??
    normalizeLang(searchParams.get("language")) ??
    "de";
  const levelParam = searchParams.get("level")?.toUpperCase();
  const level: CefrLevel = isCefrLevel(levelParam) ? levelParam : "A1";
  const playerId = searchParams.get("playerId") ?? "player-local";
  const playerName = searchParams.get("playerName") ?? "You";
  const playerAvatar =
    searchParams.get("playerAvatar") ?? "https://i.pravatar.cc/100?img=12";

  // Score Rush takes its pair from the URL, not the stored one.
  const vocabProgress = useVocabProgress({ speak, learning });

  const energyBlocked = useEnergyBlocked();

  const [wordPool, setWordPool] = useState<WordPair[]>([]);
  const [queue, setQueue] = useState<RushQuestion[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<RunStatus>("playing");
  // Starts at 2, not 3: a solo run has nothing to sync with, so the extra
  // second is only a delay between tapping play and playing.
  const [countdown, setCountdown] = useState<number | null>(2);
  const [msRemaining, setMsRemaining] = useState(RUN_DURATION_MS);
  const [feedback, setFeedback] = useState<{
    text: string;
    tone: "good" | "bad";
  } | null>(null);
  const [answerLocked, setAnswerLocked] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Set once the finished run has been saved: the server answers with the best
  // this player had before it, which is what the result screen compares against.
  const [runOutcome, setRunOutcome] = useState<{
    previousBest: number | null;
    isPersonalBest: boolean;
  } | null>(null);
  const scoreSubmitted = useRef(false);
  const answerLockedRef = useRef(false);
  const answerTimeout = useRef<number | null>(null);
  const questionStartedAt = useRef<number>(Date.now());
  const runEndsAt = useRef<number>(0);
  const [paused, setPaused] = useState(false);
  const pausedAt = useRef<number | null>(null);
  const [roundKey, setRoundKey] = useState(0);

  useEffect(() => {
    return () => {
      if (answerTimeout.current !== null) {
        window.clearTimeout(answerTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetchWordPairs({
      speak,
      learning,
      direction: DIRECTION,
      level,
      count: 40,
      signal: controller.signal,
    })
      .then((pairs) => {
        setWordPool(pairs);
        setQueue(buildQuestionQueue(pairs, 40));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setLoadError("Could not load words for this level.");
      });

    return () => controller.abort();
  }, [speak, learning, level, roundKey]);

  useEffect(() => {
    // Held at the door with no energy: the countdown never starts, so the clock
    // never runs out and the run is never charged or scored.
    if (countdown === null || energyBlocked) {
      return;
    }

    // Each number holds for a second; after "1" the run starts straight away,
    // with no "GO!" beat in between.
    const timeoutId = window.setTimeout(() => {
      if (countdown <= 1) {
        runEndsAt.current = Date.now() + RUN_DURATION_MS;
        questionStartedAt.current = Date.now();
        setCountdown(null);
      } else {
        setCountdown(countdown - 1);
      }
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [countdown, energyBlocked]);

  useEffect(() => {
    if (countdown !== null || status !== "playing" || paused) {
      return;
    }

    const tickId = window.setInterval(() => {
      const remaining = runEndsAt.current - Date.now();
      if (remaining <= 0) {
        setMsRemaining(0);
        setStatus("finished");
      } else {
        setMsRemaining(remaining);
      }
    }, 100);

    return () => window.clearInterval(tickId);
  }, [countdown, status, paused]);

  // Pausing has to move the finish line, not just stop the display: the run's
  // clock is a deadline, so time spent in the pause menu would otherwise be time
  // spent running out.
  const handlePauseChange = (next: boolean) => {
    if (next) {
      pausedAt.current = Date.now();
    } else if (pausedAt.current !== null) {
      runEndsAt.current += Date.now() - pausedAt.current;
      pausedAt.current = null;
    }
    setPaused(next);
  };

  useEffect(() => {
    if (status !== "finished" || scoreSubmitted.current) {
      return;
    }

    scoreSubmitted.current = true;

    // A run costs one energy, like every other round. It used to cost one per
    // answer, which meant a single thirty-second run could swallow the day.
    void spendEnergy();

    const submitScore = async () => {
      try {
        const response = await fetch("/api/flip-cards/async-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerId,
            nickname: playerName,
            avatar: playerAvatar,
            // Leaderboards are per language-being-learned, not per pair.
            language: learning,
            level,
            score,
            correct,
            timeMs: RUN_DURATION_MS,
          }),
        });

        if (!response.ok) {
          return;
        }

        const saved = (await response.json()) as {
          previousBest?: number | null;
          isPersonalBest?: boolean;
        };
        setRunOutcome({
          previousBest: saved.previousBest ?? null,
          isPersonalBest: saved.isPersonalBest === true,
        });
      } catch {
        // Non-blocking: the run already completed. Without the response the
        // result screen simply says nothing about a best, rather than guessing.
      }
    };

    void submitScore();
  }, [
    correct,
    learning,
    level,
    playerAvatar,
    playerId,
    playerName,
    score,
    status,
  ]);

  const currentQuestion = queue[queueIndex] ?? null;

  const showFeedback = (text: string, tone: "good" | "bad") => {
    setFeedback({ text, tone });
    window.setTimeout(() => {
      setFeedback(null);
    }, 400);
  };

  const advanceQuestion = () => {
    const nextIndex = queueIndex + 1;
    if (nextIndex >= queue.length) {
      setQueue((previous) => [
        ...previous,
        ...buildQuestionQueue(wordPool, 40),
      ]);
    }
    setQueueIndex(nextIndex);
    questionStartedAt.current = Date.now();
  };

  const handleAnswer = (selectedOption: string) => {
    if (!currentQuestion || status !== "playing" || answerLockedRef.current) {
      return;
    }

    const responseTime = Date.now() - questionStartedAt.current;
    const speedBonus = Math.max(0, 50 - Math.floor(responseTime / 45));

    setAnswered((previous) => previous + 1);

    const isCorrect = selectedOption === currentQuestion.correctOption;
    // Speed drill, but still study: an answer here counts toward the word like
    // it would anywhere else. The queue recycles the same pool until the clock
    // runs out, so a word can come up several times — the buffer keys by word,
    // which makes a run count each one once.
    vocabProgress.record(currentQuestion.conceptId, isCorrect);
    if (isCorrect) {
      setCorrect((previous) => previous + 1);
      setScore((previous) => previous + 100 + speedBonus);
      showFeedback(`Correct +${100 + speedBonus} pts`, "good");
      advanceQuestion();
    } else {
      answerLockedRef.current = true;
      setAnswerLocked(true);
      setFeedback({ text: "Wrong answer", tone: "bad" });
      answerTimeout.current = window.setTimeout(() => {
        setFeedback(null);
        advanceQuestion();
        answerLockedRef.current = false;
        setAnswerLocked(false);
        answerTimeout.current = null;
      }, WRONG_ANSWER_DELAY_MS);
    }
  };

  const restartRun = () => {
    if (answerTimeout.current !== null) {
      window.clearTimeout(answerTimeout.current);
      answerTimeout.current = null;
    }
    setQueueIndex(0);
    setCorrect(0);
    setAnswered(0);
    setScore(0);
    setStatus("playing");
    setCountdown(2);
    setMsRemaining(RUN_DURATION_MS);
    setFeedback(null);
    setAnswerLocked(false);
    setLoadError(null);
    setRunOutcome(null);
    setPaused(false);
    
    scoreSubmitted.current = false;
    answerLockedRef.current = false;
    pausedAt.current = null;
    runEndsAt.current = 0;
    questionStartedAt.current = Date.now();

    setRoundKey((prev) => prev + 1);
  };

  const backToLobby = () => {
    router.push("/games/score-rush");
  };

  const secondsRemaining = Math.max(0, Math.ceil(msRemaining / 1000));
  const timerPercent = Math.max(
    0,
    Math.min(100, (msRemaining / RUN_DURATION_MS) * 100),
  );

  if (energyBlocked) {
    return (
      <OutOfEnergy
        name="Score Rush"
        description="Answer as many translations as you can before the clock runs out."
        bgImage="score_rush.webp"
      />
    );
  }

  if (countdown !== null) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/95 text-white font-sans">
        <div className="text-center animate-pulse">
          <span className="text-xs uppercase tracking-widest text-blue-400 font-extrabold">
            Get Ready
          </span>
          <h1 className="mt-4 text-9xl font-black tracking-tight text-white transition-all duration-300 transform scale-110">
            {countdown}
          </h1>
        </div>
      </div>
    );
  }

  return (
    <GamePage
      name="Score Rush"
      description="Answer as many translations as you can before the clock runs out."
      bgImage="score_rush.webp"
      playing={status === "playing"}
      exitHref="/games/score-rush"
      onPauseChange={handlePauseChange}
    >
      <div className="w-full max-w-4xl rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/40">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600 dark:text-zinc-300">
          <p>
            Language:{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {LANG_LABELS[speak]} → {LANG_LABELS[learning]}
            </span>
          </p>
          <p className="text-xs">Difficulty matched to your level</p>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-300">
          <p>Score: {score} pts</p>
          <p>
            Accuracy: {correct}/{Math.max(answered, 1)}
          </p>
        </div>

        <div className="mt-4">
          <div className="relative h-4 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div
              className={`h-full rounded-full transition-all duration-100 ${
                secondsRemaining <= 5 ? "bg-red-500" : "bg-blue-500"
              }`}
              style={{ width: `${timerPercent}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-center">
            <p className="text-2xl font-black tabular-nums text-zinc-900 dark:text-zinc-100">
              {secondsRemaining}s
            </p>
          </div>
        </div>
      </div>

      {status === "playing" ? (
        currentQuestion ? (
          <div className="relative w-full max-w-4xl rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
            <h2 className="mt-3 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
              {currentQuestion.prompt}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Pick the correct translation
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {currentQuestion.options.map((option) => (
                <button
                  key={option}
                  className="rounded-xl border border-zinc-300 px-4 py-3 text-left font-medium text-zinc-800 transition hover:border-blue-500 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  disabled={answerLocked}
                  onClick={() => handleAnswer(option)}
                >
                  {option}
                </button>
              ))}
            </div>

            {feedback && (
              <div
                className={`absolute right-6 top-5 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider shadow-sm transition-all duration-300 ${
                  feedback.tone === "good"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                    : "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                }`}
              >
                {feedback.text}
              </div>
            )}

            {loadError && (
              <p className="mt-3 text-sm text-red-500">{loadError}</p>
            )}
          </div>
        ) : (
          <div className="w-full max-w-4xl rounded-2xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900 flex flex-col justify-center items-center">
            <p className="text-zinc-500 animate-pulse font-medium">Loading words...</p>
            {loadError && (
              <p className="mt-3 text-sm text-red-500">{loadError}</p>
            )}
          </div>
        )
      ) : (
        <div className="w-full max-w-4xl rounded-2xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm uppercase tracking-wide text-zinc-500">
            Time&apos;s up
          </p>
          <h2 className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            {score} points
          </h2>
          <p className="mt-3 text-zinc-600 dark:text-zinc-300">
            {correct}/{answered} correct answers
          </p>

          {runOutcome?.isPersonalBest ? (
            <div className="mx-auto mt-4 max-w-sm rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/40">
              <p className="text-sm font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                New personal best
              </p>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                Your old best at {level} was {runOutcome.previousBest} pts.
              </p>
            </div>
          ) : runOutcome && runOutcome.previousBest === score ? (
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              You matched your best at {level}.
            </p>
          ) : null}
          {/*
            A run under the record says nothing at all. Naming the record, or
            the gap to it, turns every ordinary run into a near miss — the
            screen should only ever hand out good news.
          */}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              className="rounded-xl bg-blue-600 px-5 py-2 font-semibold text-white transition hover:bg-blue-500"
              onClick={restartRun}
            >
              Play Again
            </button>
            <button
              className="rounded-xl border border-zinc-300 px-5 py-2 font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              onClick={backToLobby}
            >
              Back to lobby
            </button>
          </div>
        </div>
      )}
    </GamePage>
  );
}
