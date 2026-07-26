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
import { useAuthState } from "@/app/_lib/auth";
import { recordAnonPlayUsed } from "../../_lib/anonPlayGate";

interface MatchQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctOption: string;
}

type MatchStatus = "playing" | "finished";
type MatchMode = "live" | "bot";
// A live duel can end with nobody ahead - an abandoned match that neither
// player ever answered resolves to a draw rather than a loss.
type MatchWinner = "player" | "opponent" | "draw" | null;

const DEFAULT_PLAYER_AVATAR = "https://i.pravatar.cc/100?img=12";
const DEFAULT_OPPONENT_AVATAR = "https://i.pravatar.cc/100?img=34";
const BOT_NAME = "KatchUp Bot";
const BOT_AVATAR = "https://i.pravatar.cc/100?img=68";
// How long the bot "thinks" before clearing each prompt.
const BOT_MS_PER_QUESTION = 3500;
// The bot race is to a number of *correct* answers, so the player needs more
// prompts than that to have room to get some wrong.
const BOT_TARGET_CORRECT = 10;
const BOT_QUESTION_COUNT = 30;
// How long a wrong answer stays on screen with the right one highlighted.
const WRONG_ANSWER_REVEAL_MS = 2000;
const MATCH_HISTORY_KEY = "katchup-choose-one-multi-history-v1";

interface LiveMatchPayload {
  match: {
    id: string;
    status: "active" | "finished";
    winnerId: string | null;
    totalQuestions: number;
    targetCorrect: number;
    language: Lang;
    level: string;
    // Null until both players have accepted the duel.
    startAt: number | null;
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
  const { isSignedIn } = useAuthState();

  // `language` is the pre-migration param name, still honoured so older links
  // and in-flight navigations resolve to a sensible pair.
  const speak = normalizeLang(searchParams.get("speak")) ?? "en";
  const learning =
    normalizeLang(searchParams.get("learning")) ??
    normalizeLang(searchParams.get("language")) ??
    "de";
  // `async` is the pre-rename param for what is now the bot duel, kept so
  // older links still land on the right game.
  const modeParam = searchParams.get("mode");
  const mode: MatchMode =
    modeParam === "bot" || modeParam === "async" ? "bot" : "live";
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
    mode === "bot"
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

  const [winner, setWinner] = useState<MatchWinner>(null);
  const [feedback, setFeedback] = useState<{
    text: string;
    tone: "good" | "bad";
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [botClockMs, setBotClockMs] = useState<number>(() => Date.now());
  // Set while a wrong answer is held on screen with the correct option shown.
  const [reveal, setReveal] = useState<{
    selected: string;
    correct: string;
  } | null>(null);
  const revealTimeout = useRef<number | null>(null);
  // Bumped by "Play again" to run the whole setup effect again.
  const [roundKey, setRoundKey] = useState(0);
  // True once this player has hit the target and is only waiting for the
  // server to confirm the result. Without it the board flashed the next
  // question for the round-trip before the win screen appeared.
  const [awaitingResult, setAwaitingResult] = useState(false);
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isMatchGone, setIsMatchGone] = useState(false);
  const botResultRecorded = useRef(false);
  // The answer response can arrive before a sync has populated `livePayload`,
  // so the winner check needs an id that's available as soon as we know it.
  const myUserId = useRef<string | null>(null);

  const totalQuestions =
    mode === "live"
      ? (livePayload?.match.totalQuestions ?? BOT_QUESTION_COUNT)
      : questions.length;

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
        // A match that no longer exists (or that this player isn't part of)
        // will never load - keep the player out of an endless retry loop and
        // send them back to the lobby instead.
        if (response.status === 404 || response.status === 403) {
          setIsMatchGone(true);
          setLoadError("This duel is no longer available.");
          return;
        }
        setLoadError("Could not load live match state.");
        return;
      }

      setLoadError(null);
      const payload = (await response.json()) as LiveMatchPayload;
      myUserId.current = payload.me.id;
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
          return payload.match.startAt && payload.match.startAt > Date.now()
            ? payload.match.startAt
            : null;
        });
      } else {
        // The local index moves optimistically on each answer; if the server
        // is ahead (a submit landed that this client never saw the result of)
        // catch up rather than re-serving a question already answered.
        setQuestionIndex((previous) => Math.max(previous, payload.me.progress));
        setPlayerCorrect((previous) => Math.max(previous, payload.me.correct));
      }

      if (payload.match.status === "finished") {
        setStatus("finished");
        setWinner(
          payload.match.winnerId === null
            ? "draw"
            : payload.match.winnerId === payload.me.id
              ? "player"
              : "opponent",
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
    setAwaitingResult(false);
    setReveal(null);
    if (revealTimeout.current !== null) {
      window.clearTimeout(revealTimeout.current);
      revealTimeout.current = null;
    }
    setIsMatchGone(false);
    botResultRecorded.current = false;
    initialLoaded.current = false;
    myUserId.current = null;
    setLiveQuestions([]);

    // A live URL without a match id can never resolve - say so instead of
    // spinning on a load that will never come.
    if (mode === "live" && !matchId) {
      setIsMatchGone(true);
      setLoadError("This duel link is missing its match.");
    }

    if (mode === "bot") {
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
              .slice(0, BOT_QUESTION_COUNT)
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
  }, [speak, learning, mode, level, matchId, roundKey]);

  useEffect(() => {
    if (mode !== "live" || status !== "playing" || !matchId || isMatchGone) {
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
  }, [matchId, mode, playerId, status, isMatchGone]);

  // Leaving a live duel has to close it out server-side. An "active" match
  // nobody will ever answer again used to be handed back on the next visit to
  // the lobby, opponent and all.
  const leaveGuard = useRef<{ matchId: string; active: boolean }>({
    matchId: "",
    active: false,
  });

  useEffect(() => {
    leaveGuard.current = {
      matchId,
      active: mode === "live" && status === "playing" && !isMatchGone,
    };
  }, [matchId, mode, status, isMatchGone]);

  useEffect(() => {
    const forfeit = () => {
      const { matchId: id, active } = leaveGuard.current;
      // `initialLoaded` also keeps React's development remount from
      // forfeiting a duel before it has even loaded.
      if (!id || !active || !initialLoaded.current) {
        return;
      }
      leaveGuard.current.active = false;

      const url = `/api/flip-cards/match/${id}/leave`;
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon(url);
      } else {
        void fetch(url, { method: "POST", keepalive: true }).catch(() => {});
      }
    };

    window.addEventListener("pagehide", forfeit);
    return () => {
      window.removeEventListener("pagehide", forfeit);
      forfeit();
    };
  }, []);

  // The bot advances on wall-clock time, so the screen has to keep ticking
  // between answers - otherwise its avatar only moves when the player does,
  // and a bot that reached the finish line goes unnoticed.
  useEffect(() => {
    if (mode !== "bot" || status !== "playing" || countdownValue !== null) {
      return;
    }

    setBotClockMs(Date.now());
    const intervalId = window.setInterval(() => {
      setBotClockMs(Date.now());
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [mode, status, countdownValue]);

  useEffect(() => {
    if (mode !== "bot" || status !== "finished" || botResultRecorded.current) {
      return;
    }

    botResultRecorded.current = true;

    if (!isSignedIn) {
      recordAnonPlayUsed();
    }

    const elapsed = Date.now() - startMs;

    // Bot duels stay off the leaderboard - that board ranks Score Rush runs,
    // which are scored over a fixed 30s clock and aren't comparable to a
    // 10-question race against a scripted pace.
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
  }, [
    learning,
    level,
    mode,
    playerCorrect,
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

  // A thin word pool would otherwise set a target the player cannot reach.
  const botTarget = questions.length
    ? Math.min(BOT_TARGET_CORRECT, questions.length)
    : BOT_TARGET_CORRECT;

  const elapsedSinceStart =
    (mode === "bot" ? botClockMs : Date.now()) - startMs;
  // The bot doesn't answer anything - it just advances on a fixed clock, so
  // there's a rival to race without needing a second human.
  const rivalProgress =
    mode === "bot"
      ? Math.min(
          Math.floor(elapsedSinceStart / BOT_MS_PER_QUESTION),
          botTarget,
        )
      : opponentProgress;

  // A live duel is a race to a number of correct answers, not to the end of
  // the question list - the bars have to track the same thing the win
  // condition does or the leader shown can be the player who is behind.
  const raceTarget =
    mode === "live"
      ? (livePayload?.match.targetCorrect ?? BOT_TARGET_CORRECT)
      : botTarget;
  // Only correct answers move you up the track - guessing through the list
  // used to advance the player's avatar just as fast as answering well.
  const playerRaceValue = playerCorrect;
  const rivalRaceValue = mode === "live" ? opponentCorrect : rivalProgress;

  const playerPercent = Math.min((playerRaceValue / raceTarget) * 100, 100);
  const opponentPercent = Math.min((rivalRaceValue / raceTarget) * 100, 100);

  const finishMatch = (resolvedWinner: MatchWinner) => {
    setStatus("finished");
    setWinner(resolvedWinner);
  };

  // The bot crossing the line has to end the duel on its own; waiting for the
  // player's next answer let them keep playing a race they had already lost.
  useEffect(() => {
    if (mode !== "bot" || status !== "playing" || countdownValue !== null) {
      return;
    }
    if (rivalProgress >= botTarget) {
      finishMatch("opponent");
    }
  }, [mode, status, countdownValue, rivalProgress, botTarget]);

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
    const isCorrect = selectedOption === currentQuestion.correctOption;
    const nextIndex = questionIndex + 1;
    const nextCorrect = isCorrect ? playerCorrect + 1 : playerCorrect;

    if (isCorrect) {
      setPlayerCorrect(nextCorrect);
      setScore((previous) => previous + 100 + speedBonus);
      showFeedback(`Correct +${100 + speedBonus} pts`, "good");
    } else {
      showFeedback("Wrong answer", "bad");
    }

    if (mode === "live") {
      if (!matchId) {
        return;
      }

      // Submitted straight away, before the reveal pause below: the race is
      // scored on the server and shouldn't be slowed by a local animation.
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
      })
        .then(async (res) => {
          if (!res.ok) return;
          const answerData = (await res.json()) as {
            status?: "active" | "finished";
            winnerId?: string | null;
          };

          if (answerData.status === "finished") {
            const meId = myUserId.current ?? livePayload?.me.id ?? null;
            finishMatch(
              !answerData.winnerId
                ? "draw"
                : answerData.winnerId === meId
                  ? "player"
                  : "opponent",
            );
          }
        })
        .catch(() => {
          // The poll in syncLiveMatch reconciles progress, so a dropped
          // submit doesn't need to interrupt the player mid-race.
        });
    }

    const advance = () => {
      revealTimeout.current = null;
      setReveal(null);
      setIsSubmitting(false);
      setQuestionStartedAt(Date.now());
      setQuestionIndex(nextIndex);

      // The server decides a live duel, but the answer that reaches the target
      // has already won it - hold the board rather than showing a question the
      // player will never get to answer.
      if (mode === "live" && nextCorrect >= raceTarget) {
        setAwaitingResult(true);
        return;
      }

      if (mode === "bot") {
        if (nextCorrect >= botTarget) {
          finishMatch("player");
        } else if (nextIndex >= questions.length) {
          // Out of prompts without reaching the target - the bot takes it.
          finishMatch("opponent");
        }
      }
    };

    if (isCorrect) {
      advance();
      return;
    }

    // Hold a wrong answer on screen for a beat with the correct option marked,
    // so the player actually sees what it should have been.
    setIsSubmitting(true);
    setReveal({
      selected: selectedOption,
      correct: currentQuestion.correctOption,
    });
    revealTimeout.current = window.setTimeout(advance, WRONG_ANSWER_REVEAL_MS);
  };

  useEffect(() => {
    return () => {
      if (revealTimeout.current !== null) {
        window.clearTimeout(revealTimeout.current);
      }
    };
  }, []);

  // Safety net: reaching the target means the duel is over, so a submit whose
  // result never comes back must not leave the player on "confirming" forever.
  useEffect(() => {
    if (!awaitingResult || status !== "playing") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void syncLiveMatch().then(() => {
        setStatus((current) => {
          if (current !== "playing") {
            return current;
          }
          setWinner((previous) => previous ?? "player");
          return "finished";
        });
      });
    }, 6000);

    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingResult, status]);

  // "Play again" replays rather than just backing out: a bot duel restarts in
  // place with fresh words, and a live duel needs a new opponent, so the lobby
  // starts searching the moment it loads.
  const restartMatch = () => {
    if (mode === "bot") {
      setRoundKey((previous) => previous + 1);
      return;
    }

    // Carry the matchmaking mode back so a personalized duel replays as one.
    const params = new URLSearchParams({ autostart: "1" });
    const settingsMode = searchParams.get("settingsMode");
    if (settingsMode) {
      params.set("settingsMode", settingsMode);
    }

    router.push(`/games/choose-one-multiplayer?${params.toString()}`);
  };

  const backToPregame = () => {
    router.push("/games/choose-one-multiplayer");
  };

  const rivalName =
    mode === "live"
      ? (livePayload?.opponent?.name ?? opponentName)
      : BOT_NAME;
  const rivalAvatar =
    mode === "live"
      ? (livePayload?.opponent?.avatar ?? opponentAvatar)
      : BOT_AVATAR;

  if (countdownValue !== null) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/95 text-white font-sans">
        <div className="text-center animate-pulse">
          <span className="text-xs uppercase tracking-widest text-blue-400 font-extrabold">
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
      name={mode === "live" ? "Live Duel" : "Bot Duel"}
      description={
        mode === "live"
          ? "Both players race through a shared set of prompts. First player to reach 10 correct answers wins."
          : "Race the bot to 10 correct answers. Only right answers move you forward, so answer quickly but get them right."
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
          <p className="text-xs">Difficulty matched to your level</p>
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
              {playerName}: {Math.min(playerRaceValue, raceTarget)}/
              {raceTarget}
            </p>
            <p>
              {rivalName}: {Math.min(rivalRaceValue, raceTarget)}/{raceTarget}
            </p>
          </div>
          <p className="mt-1 text-center text-xxs text-zinc-500">
            First to {raceTarget} correct answers wins
          </p>
        </div>
      </div>

      {status === "playing" && currentQuestion && !awaitingResult ? (
        <div className="relative w-full max-w-4xl rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="text-sm text-zinc-600 dark:text-zinc-300 pr-24">
            Question {questionIndex + 1} - {playerCorrect}/{raceTarget} correct
          </div>

          <h2 className="mt-3 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            {currentQuestion.prompt}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Pick the correct translation
          </p>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {currentQuestion.options.map((option) => {
              const isCorrectOption = reveal?.correct === option;
              const isWrongPick = reveal?.selected === option;

              return (
                <button
                  key={option}
                  className={`rounded-xl border px-4 py-3 text-left font-medium transition ${
                    isCorrectOption
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : isWrongPick
                        ? "border-rose-500 bg-rose-50 text-rose-800 dark:border-rose-500 dark:bg-rose-950/40 dark:text-rose-300"
                        : "border-zinc-300 text-zinc-800 hover:border-blue-500 hover:bg-blue-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  } ${reveal && !isCorrectOption && !isWrongPick ? "opacity-60" : ""}`}
                  onClick={() => void handleAnswer(option)}
                  disabled={isSubmitting}
                >
                  {option}
                </button>
              );
            })}
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
      ) : status === "playing" ? (
        // A live duel has no question to show until its state has loaded, and
        // a player can also run out of prompts before the duel resolves.
        // Falling through to the result screen here is what made "Play" look
        // like it jumped to the end of the round.
        <div className="w-full max-w-4xl rounded-2xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-700 dark:bg-zinc-900">
          {awaitingResult ? (
            <>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {raceTarget}/{raceTarget} correct
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                Confirming the result...
              </p>
            </>
          ) : isMatchGone ? (
            <>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                This duel has ended
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                It was closed or is no longer available. Start a fresh one from
                the lobby.
              </p>
              <button
                className="mt-5 rounded-xl bg-blue-500 px-5 py-2 font-semibold text-white transition hover:bg-blue-400"
                onClick={backToPregame}
              >
                Back to lobby
              </button>
            </>
          ) : mode === "live" && questionIndex >= liveQuestions.length &&
            liveQuestions.length > 0 ? (
            <>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                You&apos;re out of prompts
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                Waiting for {rivalName} to finish...
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                Loading the duel...
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                {loadError ?? "Fetching your prompts."}
              </p>
            </>
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
              : winner === "draw"
                ? "It's a draw"
                : `${rivalName} won this round`}
          </h2>
          <p className="mt-3 text-zinc-600 dark:text-zinc-300">
            {mode === "live"
              ? `Final score: ${playerName} ${playerCorrect} correct - ${rivalName} ${opponentCorrect} correct`
              : `Final score: ${playerName} ${playerCorrect}/${raceTarget} correct - ${rivalName} reached ${Math.min(
                  rivalProgress,
                  raceTarget,
                )}/${raceTarget}`}
          </p>
          <p className="mt-2 text-sm text-zinc-500">Total points: {score}</p>

          {mode === "bot" && !isSignedIn && (
            <div className="mx-auto mt-5 max-w-md rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-800/40 dark:bg-blue-950/20">
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                That was your free bot duel!
              </p>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                Sign in to save your progress and keep duelling.
              </p>
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/login?callbackUrl=${encodeURIComponent("/")}`,
                  )
                }
                className="mt-3 w-full rounded-xl bg-blue-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-400 dark:bg-blue-500 dark:hover:bg-blue-400"
              >
                Sign in to keep playing
              </button>
            </div>
          )}


          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              className="rounded-xl bg-blue-500 px-5 py-2 font-semibold text-white transition hover:bg-blue-400"
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
