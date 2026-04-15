"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GamePage from "../../_components/GamePage";
import { SupportedLanguage } from "../../_lib/learning/types";
import { getAllWords } from "../../_lib/learning/wordDatabase";
import { pusherClient } from "@/lib/realtime/pusher-client";

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
const MATCH_HISTORY_KEY = "katchup-flip-cards-history-v1";

interface LiveMatchPayload {
  match: {
    id: string;
    status: "active" | "finished";
    winnerId: string | null;
    totalQuestions: number;
    language: SupportedLanguage;
    level: string;
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
}

interface AsyncLeaderboardRow {
  name: string;
  avatar: string;
  score: number;
  correct: number;
  timeMs: number;
}

function isSupportedLanguage(value: string | null): value is SupportedLanguage {
  return value === "german" || value === "spanish";
}

function shuffleArray<T>(items: T[]): T[] {
  const cloned = [...items];
  for (let i = cloned.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }
  return cloned;
}

function buildQuestions(language: SupportedLanguage): MatchQuestion[] {
  const words = shuffleArray(getAllWords(language)).slice(0, 10);

  return words.map((word) => {
    const wrongOptions = shuffleArray(
      getAllWords(language)
        .filter((candidate) => candidate.id !== word.id)
        .map((candidate) => candidate.native),
    ).slice(0, 3);

    const options = shuffleArray([...wrongOptions, word.native]);

    return {
      id: word.id,
      prompt: word.foreign,
      options,
      correctOption: word.native,
    };
  });
}

export default function FlipCardsPlayPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const language = isSupportedLanguage(searchParams.get("language"))
    ? (searchParams.get("language") as SupportedLanguage)
    : "german";
  const mode =
    searchParams.get("mode") === "async"
      ? ("async" as MatchMode)
      : ("live" as MatchMode);
  const level = searchParams.get("level") ?? "A1";
  const playerId = searchParams.get("playerId") ?? "player-local";
  const playerName = searchParams.get("playerName") ?? "You";
  const playerAvatar =
    searchParams.get("playerAvatar") ?? DEFAULT_PLAYER_AVATAR;
  const matchId = searchParams.get("matchId") ?? "";
  const opponentName = searchParams.get("opponent") ?? "OnlineRival";
  const opponentAvatar =
    searchParams.get("opponentAvatar") ?? DEFAULT_OPPONENT_AVATAR;

  const [questions, setQuestions] = useState<MatchQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [playerCorrect, setPlayerCorrect] = useState(0);
  const [opponentProgress, setOpponentProgress] = useState(0);
  const [opponentCorrect, setOpponentCorrect] = useState(0);
  const [livePayload, setLivePayload] = useState<LiveMatchPayload | null>(null);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState<MatchStatus>("playing");
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
      setOpponentProgress(payload.opponent?.progress ?? 0);
      setOpponentCorrect(payload.opponent?.correct ?? 0);
      setQuestionIndex(payload.me.progress);
      setPlayerCorrect(payload.me.correct);

      if (payload.match.status === "finished") {
        setStatus("finished");
        setWinner(payload.match.winnerId === playerId ? "player" : "opponent");
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

    if (mode === "async") {
      setQuestions(buildQuestions(language));
      setLivePayload(null);
    }
  }, [language, mode]);

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
            language,
            level,
            score,
            correct: playerCorrect,
            timeMs: elapsed,
          }),
        });

        const leaderboardResponse = await fetch(
          `/api/flip-cards/async-score?language=${language}&level=${level}`,
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
            language,
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
    language,
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
          language,
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
    language,
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
      ? (livePayload?.nextQuestion ?? null)
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
    }, 650);
  };

  const handleAnswer = async (selectedOption: string) => {
    if (!currentQuestion || status !== "playing" || isSubmitting) {
      return;
    }

    const responseTime = Date.now() - questionStartedAt;
    const speedBonus = Math.max(0, 50 - Math.floor(responseTime / 45));

    if (mode === "live") {
      if (!matchId) {
        return;
      }

      setIsSubmitting(true);

      try {
        const answerResponse = await fetch(
          `/api/flip-cards/match/${matchId}/answer`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              playerId,
              questionId: currentQuestion.id,
              selectedOption,
            }),
          },
        );

        const answerData = (await answerResponse.json()) as {
          ok?: boolean;
          isCorrect?: boolean;
          status?: "active" | "finished";
          winnerId?: string | null;
          error?: string;
        };

        if (!answerResponse.ok || !answerData.ok) {
          setLoadError(answerData.error ?? "Answer submission failed.");
          setIsSubmitting(false);
          return;
        }

        if (answerData.isCorrect) {
          setScore((previous) => previous + 100 + speedBonus);
          showFeedback(`Correct +${100 + speedBonus} pts`, "good");
        } else {
          showFeedback("Wrong answer", "bad");
        }

        setQuestionStartedAt(Date.now());

        if (answerData.status === "finished") {
          finishMatch(answerData.winnerId === playerId ? "player" : "opponent");
        }
      } catch {
        setLoadError("Network error while submitting answer.");
      } finally {
        setIsSubmitting(false);
      }

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
      return;
    }

    setQuestionStartedAt(Date.now());
    setQuestionIndex(nextIndex);
  };

  const restartMatch = () => {
    router.push("/games/flip-cards");
  };

  const backToPregame = () => {
    router.push("/games/flip-cards");
  };

  const rivalName =
    mode === "live"
      ? (livePayload?.opponent?.name ?? opponentName)
      : "Leaderboard Ghost";
  const rivalAvatar =
    mode === "live"
      ? (livePayload?.opponent?.avatar ?? opponentAvatar)
      : DEFAULT_OPPONENT_AVATAR;

  return (
    <GamePage
      name={mode === "live" ? "Flip Cards Match" : "Flip Cards Score Rush"}
      description={
        mode === "live"
          ? "Both players race through the same 10 questions in different order. First to finish takes the win."
          : "Answer quickly for timing bonus and push your score onto the online board."
      }
      bgImage="flip_cards.png"
    >
      <div className="w-full max-w-4xl rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/40">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600 dark:text-zinc-300">
          <p>
            Language:{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {language}
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
        <div className="w-full max-w-4xl rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between gap-2 text-sm text-zinc-600 dark:text-zinc-300">
            <p>
              Question {questionIndex + 1}/{totalQuestions}
            </p>
            <p>
              {mode === "live"
                ? `${rivalName} is solving now`
                : "Ghost pace updates every second"}
            </p>
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
            <p
              className={`mt-4 text-sm font-semibold ${
                feedback.tone === "good" ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {feedback.text}
            </p>
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
