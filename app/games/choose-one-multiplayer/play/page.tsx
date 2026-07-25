"use client";
/* eslint-disable react-hooks/purity */

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GamePage from "../../_components/GamePage";
import {
  isCefrLevel,
  LANG_LABELS,
  normalizeLang,
  type CefrLevel,
  type Lang,
} from "@/app/_lib/languages";
import { buildOptions, fetchWordPairs } from "../../_lib/wordPairs";
import { pusherClient } from "@/lib/realtime/pusher-client";
import { spendEnergy } from "@/app/_lib/energy";
import { useSession } from "@/lib/auth-client";
import { recordAnonPlayUsed } from "../../_lib/anonPlayGate";

interface MatchQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctOption: string;
}

type MatchStatus = "playing" | "finished";
type MatchMode = "live" | "async";

const DEFAULT_PLAYER_AVATAR = "https://i.pravatar.cc/100?img=12";
const DEFAULT_OPPONENT_AVATAR = "https://i.pravatar.cc/100?img=34";
const MATCH_HISTORY_KEY = "katchup-choose-one-multi-history-v1";

interface LiveMatchPayload {
  match: {
    id: string;
    status: "active" | "finished";
    winnerId: string | null;
    totalQuestions: number;
    language: Lang;
    level: string;
    startAt: number;
  };
  me: {
    id: string;
    name: string;
    avatar: string;
    progress: number;
    correct: number;
  };
  opponent: {
    id: string;
    name: string;
    avatar: string;
    progress: number;
    correct: number;
  } | null;
  nextQuestion: MatchQuestion | null;
  questions?: MatchQuestion[];
}

interface AsyncLeaderboardRow {
  name: string;
  avatar: string;
  score: number;
  correct: number;
  timeMs: number;
}

function shuffleArray<T>(items: T[]): T[] {
  const cloned = [...items];
  for (let i = cloned.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }
  return cloned;
}

export default function ChooseOneMultiplayerPlayPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const isSignedIn = Boolean(session?.user?.id);

  // `language` is the pre-migration param name, still honoured so older links
  // and in-flight navigations resolve to a sensible pair.
  const speak = normalizeLang(searchParams.get("speak")) ?? "en";
  const learning =
    normalizeLang(searchParams.get("learning")) ??
    normalizeLang(searchParams.get("language")) ??
    "de";
  const mode =
    searchParams.get("mode") === "async"
      ? ("async" as MatchMode)
      : ("live" as MatchMode);
  const levelParam = searchParams.get("level")?.toUpperCase();
  const level: CefrLevel = isCefrLevel(levelParam) ? levelParam : "A1";
  const playerId = searchParams.get("playerId") ?? "player-local";
  const playerName = searchParams.get("playerName") ?? "You";
  const playerAvatar =
    searchParams.get("playerAvatar") ?? DEFAULT_PLAYER_AVATAR;
  const matchId = searchParams.get("matchId") ?? "";
  const opponentName = searchParams.get("opponent") ?? "OnlineRival";
  const opponentAvatar =
    searchParams.get("opponentAvatar") ?? DEFAULT_OPPONENT_AVATAR;

  const [questions, setQuestions] = useState<MatchQuestion[]>([]);
  const [liveQuestions, setLiveQuestions] = useState<MatchQuestion[]>([]);
  const initialLoaded = useRef(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [playerCorrect, setPlayerCorrect] = useState(0);
  const [opponentProgress, setOpponentProgress] = useState(0);
  const [opponentCorrect, setOpponentCorrect] = useState(0);
  const [livePayload, setLivePayload] = useState<LiveMatchPayload | null>(null);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<MatchStatus>("playing");

  // For live matches, the lobby hands us the server-computed moment both
  // players' clocks should start (see MATCH_COUNTDOWN_MS) so the 3-2-1
  // countdown is anchored to the same absolute time on both screens instead
  // of two independent local timers.
  const initialMatchStartAt =
    mode === "async"
      ? Date.now() + 3000
      : (() => {
          const raw = searchParams.get("startAt");
          const parsed = raw ? Number(raw) : NaN;
          return Number.isFinite(parsed) && parsed > Date.now()
            ? parsed
            : null;
        })();

  const [matchStartAt, setMatchStartAt] = useState<number | null>(
    initialMatchStartAt,
  );
  const [countdownValue, setCountdownValue] = useState<number | null>(() => {
    if (initialMatchStartAt === null) {
      return null;
    }
    return Math.min(3, Math.ceil((initialMatchStartAt - Date.now()) / 1000));
  });

  const [winner, setWinner] = useState<"player" | "opponent" | null>(null);
  const [feedback, setFeedback] = useState<{
    text: string;
    tone: "good" | "bad";
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startMs, setStartMs] = useState<number>(() => Date.now());
  const [questionStartedAt, setQuestionStartedAt] = useState<number>(() =>
    Date.now(),
  );

  useEffect(() => {
    if (matchStartAt === null) {
      return;
    }

    const tick = () => {
      const remaining = matchStartAt - Date.now();
      if (remaining <= 0) {
        setStartMs(matchStartAt);
        setQuestionStartedAt(matchStartAt);
        setCountdownValue(null);
        setMatchStartAt(null);
        return;
      }
      setCountdownValue(Math.min(3, Math.ceil(remaining / 1000)));
    };

    tick();
    const intervalId = window.setInterval(tick, 150);
    return () => window.clearInterval(intervalId);
  }, [matchStartAt]);
  const [asyncLeaderboard, setAsyncLeaderboard] = useState<
    AsyncLeaderboardRow[]
  >([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const asyncScoreSubmitted = useRef(false);

  const totalQuestions =
    mode === "live" ? (livePayload?.match.totalQuestions ?? 10) : 10;

  const syncLiveMatch = async () => {
    if (!matchId) {
      return;
    }

    try {
      const response = await fetch(
        `/api/flip-cards/match/${matchId}?playerId=${playerId}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        setLoadError("Could not load live match state.");
        return;
      }

      const payload = (await response.json()) as LiveMatchPayload;
      setLivePayload(payload);
      if (payload.questions) {
        setLiveQuestions(payload.questions);
      }
      setOpponentProgress(payload.opponent?.progress ?? 0);
      setOpponentCorrect(payload.opponent?.correct ?? 0);

      // Only sync client's progress on initial load
      if (!initialLoaded.current) {
        setQuestionIndex(payload.me.progress);
        setPlayerCorrect(payload.me.correct);
        initialLoaded.current = true;

        // Fallback for when we didn't get a startAt via the lobby handoff
        // (e.g. a direct link or a page refresh before the countdown ended).
        setMatchStartAt((prev) => {
          if (prev !== null) {
            return prev;
          }
          return payload.match.startAt > Date.now()
            ? payload.match.startAt
            : null;
        });
      }

      if (payload.match.status === "finished") {
        setStatus("finished");
        setWinner(
          payload.match.winnerId === payload.me.id ? "player" : "opponent",
        );
      }
    } catch {
      setLoadError("Live sync failed temporarily.");
    }
  };

  useEffect(() => {
    setQuestionIndex(0);
    setPlayerCorrect(0);
    setOpponentProgress(0);
    setOpponentCorrect(0);
    setScore(0);
    setStatus("playing");
    setWinner(null);
    setFeedback(null);

    setIsSubmitting(false);
    setStartMs(Date.now());
    setQuestionStartedAt(Date.now());
    setLoadError(null);
    asyncScoreSubmitted.current = false;
    initialLoaded.current = false;
    setLiveQuestions([]);

    if (mode === "async") {
      setLivePayload(null);
      // Recognition: show the word being learned, pick its meaning.
      fetchWordPairs({
        speak,
        learning,
        direction: "recognition",
        level,
        count: 30,
      })
        .then((pairs) => {
          setQuestions(
            shuffleArray(pairs)
              .slice(0, 10)
              .map((pair) => ({
                id: pair.conceptId,
                prompt: pair.prompt,
                options: buildOptions(pair, pairs),
                correctOption: pair.answer,
              })),
          );
        })
        .catch(() => {
          setLoadError("Could not load words for this level.");
        });
    }
  }, [speak, learning, mode, level]);

  useEffect(() => {
    if (mode !== "live" || status !== "playing" || !matchId) {
      return;
    }

    void syncLiveMatch();

    const channel = pusherClient?.subscribe(`match-${matchId}`);
    channel?.bind("turn-played", () => {
      void syncLiveMatch();
    });
    channel?.bind("match-finished", () => {
      void syncLiveMatch();
    });

    const intervalId = window.setInterval(() => {
      void syncLiveMatch();
    }, 700);

    return () => {
      window.clearInterval(intervalId);
      channel?.unbind_all();
      pusherClient?.unsubscribe(`match-${matchId}`);
    };
  }, [matchId, mode, playerId, status]);

  useEffect(() => {
    if (
      mode !== "async" ||
      status !== "finished" ||
      asyncScoreSubmitted.current
    ) {
      return;
    }

    asyncScoreSubmitted.current = true;

    if (!isSignedIn) {
      recordAnonPlayUsed();
    }

    const elapsed = Date.now() - startMs;

    const submitAsyncScore = async () => {
      try {
        await fetch("/api/flip-cards/async-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerId,
            name: playerName,
            avatar: playerAvatar,
            language: learning,
            level,
            score,
            correct: playerCorrect,
            timeMs: elapsed,
          }),
        });

        const leaderboardResponse = await fetch(
          `/api/flip-cards/async-score?language=${learning}&level=${level}`,
        );

        if (!leaderboardResponse.ok) {
          return;
        }

        const leaderboardData = (await leaderboardResponse.json()) as {
          leaderboard: AsyncLeaderboardRow[];
        };

        setAsyncLeaderboard(leaderboardData.leaderboard ?? []);
      } catch {
        // Non-blocking: the game already completed.
      }
    };

    const appendHistory = () => {
      try {
        const stored = window.localStorage.getItem(MATCH_HISTORY_KEY);
        const parsed = stored
          ? (JSON.parse(stored) as Array<Record<string, unknown>>)
          : [];

        const updated = [
          {
            createdAt: Date.now(),
            mode,
            language: learning,
            level,
            playerName,
            score,
            correct: playerCorrect,
            totalQuestions,
            winner,
            durationMs: elapsed,
          },
          ...parsed,
        ].slice(0, 15);

        window.localStorage.setItem(MATCH_HISTORY_KEY, JSON.stringify(updated));
      } catch {
        // Ignore local storage errors.
      }
    };

    appendHistory();
    void submitAsyncScore();
  }, [
    learning,
    level,
    mode,
    playerAvatar,
    playerCorrect,
    playerId,
    playerName,
    score,
    startMs,
    status,
    totalQuestions,
    winner,
    isSignedIn,
  ]);

  useEffect(() => {
    if (mode !== "live" || status !== "finished") {
      return;
    }

    const elapsed = Date.now() - startMs;

    try {
      const stored = window.localStorage.getItem(MATCH_HISTORY_KEY);
      const parsed = stored
        ? (JSON.parse(stored) as Array<Record<string, unknown>>)
        : [];

      const updated = [
        {
          createdAt: Date.now(),
          mode,
          language: learning,
          level,
          playerName,
          opponentName: livePayload?.opponent?.name ?? opponentName,
          score,
          correct: playerCorrect,
          totalQuestions,
          winner,
          durationMs: elapsed,
        },
        ...parsed,
      ].slice(0, 15);

      window.localStorage.setItem(MATCH_HISTORY_KEY, JSON.stringify(updated));
    } catch {
      // Ignore local storage errors.
    }
  }, [
    learning,
    level,
    livePayload?.opponent?.name,
    mode,
    opponentName,
    playerCorrect,
    playerName,
    score,
    startMs,
    status,
    totalQuestions,
    winner,
  ]);

  const currentQuestion =
    mode === "live"
      ? (liveQuestions[questionIndex] ?? null)
      : (questions[questionIndex] ?? null);

  const elapsedSinceStart = Date.now() - startMs;
  const asyncGhostProgress =
    mode === "async"
      ? Math.min(Math.floor(elapsedSinceStart / 3500), totalQuestions)
      : opponentProgress;

  const playerPercent = totalQuestions
    ? Math.min((questionIndex / totalQuestions) * 100, 100)
    : 0;
  const opponentPercent = totalQuestions
    ? Math.min(
        ((mode === "async" ? asyncGhostProgress : opponentProgress) /
          totalQuestions) *
          100,
        100,
      )
    : 0;

  const finishMatch = (resolvedWinner: "player" | "opponent") => {
    setStatus("finished");
    setWinner(resolvedWinner);
  };

  const showFeedback = (text: string, tone: "good" | "bad") => {
    setFeedback({ text, tone });
    window.setTimeout(() => {
      setFeedback(null);
    }, 550);
  };

  const handleAnswer = async (selectedOption: string) => {
    if (!currentQuestion || status !== "playing" || isSubmitting) {
      return;
    }

    spendEnergy();

    const responseTime = Date.now() - questionStartedAt;
    const speedBonus = Math.max(0, 50 - Math.floor(responseTime / 45));

    if (mode === "live") {
      if (!matchId) {
        return;
      }

      const isCorrect = selectedOption === currentQuestion.correctOption;

      if (isCorrect) {
        setPlayerCorrect((previous) => previous + 1);
        setScore((previous) => previous + 100 + speedBonus);
        showFeedback(`Correct +${100 + speedBonus} pts`, "good");
      } else {
        showFeedback("Wrong answer", "bad");
      }

      const nextIndex = questionIndex + 1;
      setQuestionIndex(nextIndex);
      setQuestionStartedAt(Date.now());

      // Submit to database in the background without blocking the UI
      void fetch(`/api/flip-cards/match/${matchId}/answer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerId,
          questionId: currentQuestion.id,
          selectedOption,
          responseMs: responseTime,
        }),
      }).then(async (res) => {
        if (!res.ok) return;
        const answerData = (await res.json()) as {
          status?: "active" | "finished";
          winnerId?: string | null;
        };

        if (answerData.status === "finished") {
          finishMatch(
            answerData.winnerId === livePayload?.me.id ? "player" : "opponent",
          );
        }
      });

      return;
    }

    const isCorrect = selectedOption === currentQuestion.correctOption;
    if (isCorrect) {
      setPlayerCorrect((previous) => previous + 1);
      setScore((previous) => previous + 100 + speedBonus);
      showFeedback(`Correct +${100 + speedBonus} pts`, "good");
    } else {
      showFeedback("Wrong answer", "bad");
    }

    const nextIndex = questionIndex + 1;
    if (nextIndex >= totalQuestions) {
      const asyncWinner =
        nextIndex <= asyncGhostProgress ? "opponent" : "player";
      finishMatch(asyncWinner);
      setQuestionIndex(nextIndex);
    } else {
      setQuestionStartedAt(Date.now());
      setQuestionIndex(nextIndex);
    }
  };

  const restartMatch = () => {
    router.push("/games/choose-one-multiplayer");
  };

  const backToPregame = () => {
    router.push("/games/choose-one-multiplayer");
  };

  const rivalName =
    mode === "live"
      ? (livePayload?.opponent?.name ?? opponentName)
      : "Leaderboard Ghost";
  const rivalAvatar =
    mode === "live"
      ? (livePayload?.opponent?.avatar ?? opponentAvatar)
      : DEFAULT_OPPONENT_AVATAR;

  if (countdownValue !== null) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/95 text-white font-sans">
        <div className="text-center animate-pulse">
          <span className="text-xs uppercase tracking-widest text-emerald-400 font-extrabold">
            Get Ready
          </span>
          <h1 className="mt-4 text-9xl font-black tracking-tight text-white transition-all duration-300 transform scale-110">
            {countdownValue}
          </h1>
        </div>
      </div>
    );
  }

  return (
    <GamePage
      name={
        mode === "live"
          ? "Choose One Multiplayer Match"
          : "Choose One Score Rush"
      }
      description={
        mode === "live"
          ? "Both players race through a shared set of prompts. First player to reach 10 correct answers wins."
          : "Answer quickly for timing bonus and push your score onto the online board."
      }
      bgImage="flip_cards.png"
    >
      <div className="w-full max-w-4xl rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/40">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600 dark:text-zinc-300">
          <p>
            Language:{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {LANG_LABELS[speak]} → {LANG_LABELS[learning]}
            </span>
          </p>
          <p className="text-xs">Level {level} (preselected)</p>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-300">
          <p>Score: {score} pts</p>
          <p>
            Accuracy: {playerCorrect}/{Math.max(questionIndex, 1)}
          </p>
        </div>

        <div className="mt-4">
          <div className="relative h-4 rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-emerald-300/40"
              style={{ width: "100%" }}
            />
            <img
              src={playerAvatar}
              alt={playerName}
              className="absolute top-1/2 h-10 w-10 -translate-y-1/2 rounded-full border-2 border-emerald-500 object-cover transition-all duration-300"
              style={{ left: `calc(${playerPercent}% - 20px)` }}
            />
            <img
              src={rivalAvatar}
              alt={rivalName}
              className="absolute top-1/2 h-10 w-10 -translate-y-1/2 rounded-full border-2 border-blue-500 object-cover transition-all duration-300"
              style={{ left: `calc(${opponentPercent}% - 20px)` }}
            />
          </div>
          <div className="mt-8 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-300">
            <p>
              {playerName}: {Math.min(questionIndex, totalQuestions)}/
              {totalQuestions}
            </p>
            <p>
              {rivalName}:{" "}
              {Math.min(
                mode === "async" ? asyncGhostProgress : opponentProgress,
                totalQuestions,
              )}
              /{totalQuestions}
            </p>
          </div>
        </div>
      </div>

      {status === "playing" && currentQuestion ? (
        <div className="relative w-full max-w-4xl rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="text-sm text-zinc-600 dark:text-zinc-300 pr-24">
            Question {questionIndex + 1}/{totalQuestions}
          </div>

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
                className="rounded-xl border border-zinc-300 px-4 py-3 text-left font-medium text-zinc-800 transition hover:border-emerald-500 hover:bg-emerald-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => void handleAnswer(option)}
                disabled={isSubmitting}
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
        <div className="w-full max-w-4xl rounded-2xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm uppercase tracking-wide text-zinc-500">
            Match finished
          </p>
          <h2 className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            {winner === "player"
              ? "You won the race!"
              : `${rivalName} won this round`}
          </h2>
          <p className="mt-3 text-zinc-600 dark:text-zinc-300">
            Final score: {playerName} {playerCorrect}/{totalQuestions} -{" "}
            {rivalName} {opponentCorrect}/{totalQuestions}
          </p>
          <p className="mt-2 text-sm text-zinc-500">Total points: {score}</p>

          {mode === "async" && !isSignedIn && (
            <div className="mx-auto mt-5 max-w-md rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-800/40 dark:bg-blue-950/20">
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                That was your free Score Rush!
              </p>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                Sign in to save your scores and keep climbing the leaderboard.
              </p>
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/login?callbackUrl=${encodeURIComponent("/")}`,
                  )
                }
                className="mt-3 w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
              >
                Sign in to keep playing
              </button>
            </div>
          )}

          {mode === "async" && asyncLeaderboard.length > 0 && (
            <div className="mx-auto mt-5 max-w-md rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-left dark:border-zinc-700 dark:bg-zinc-800/40">
              <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
                Top Score Rush Players
              </p>
              {asyncLeaderboard.slice(0, 5).map((entry, index) => (
                <p
                  key={`${entry.name}-${index}`}
                  className="text-sm text-zinc-700 dark:text-zinc-200"
                >
                  #{index + 1} {entry.name} - {entry.score} pts -{" "}
                  {Math.round(entry.timeMs / 1000)}s
                </p>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              className="rounded-xl bg-emerald-600 px-5 py-2 font-semibold text-white transition hover:bg-emerald-500"
              onClick={restartMatch}
            >
              Play Again
            </button>
            <button
              className="rounded-xl border border-zinc-300 px-5 py-2 font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              onClick={backToPregame}
            >
              Back to lobby
            </button>
          </div>
        </div>
      )}
    </GamePage>
  );
}
