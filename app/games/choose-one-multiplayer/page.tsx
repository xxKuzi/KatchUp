"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import GamePage from "../_components/GamePage";
import { useLearningProgress } from "../_hooks/useLearningProgress";
import { SupportedLanguage } from "../_lib/learning/types";
import { getPlayerProfile, PlayerProfile } from "./_lib/playerProfile";

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  german: "German",
  spanish: "Spanish",
};

const DEFAULT_OPPONENTS = [
  { name: "Luna87", avatar: "https://i.pravatar.cc/100?img=34" },
  { name: "MikaSprint", avatar: "https://i.pravatar.cc/100?img=47" },
  { name: "WordWizard", avatar: "https://i.pravatar.cc/100?img=15" },
  { name: "LexiDash", avatar: "https://i.pravatar.cc/100?img=49" },
  { name: "PabloPulse", avatar: "https://i.pravatar.cc/100?img=66" },
];

const MATCH_HISTORY_KEY = "katchup-choose-one-multi-history-v1";

type MatchState = "idle" | "searching" | "found";
type MatchMode = "live" | "async";

interface OpponentPreview {
  name: string;
  avatar: string;
}

interface MatchHistoryEntry {
  createdAt: number;
  mode: MatchMode;
  score: number;
  winner: "player" | "opponent" | null;
}

function levelFromLecture(lecture: number): "A1" | "A2" | "B1" | "B2" | "C1" {
  if (lecture <= 2) {
    return "A1";
  }
  if (lecture <= 4) {
    return "A2";
  }
  if (lecture <= 6) {
    return "B1";
  }
  if (lecture <= 8) {
    return "B2";
  }
  return "C1";
}

function getPreferredLanguage(): SupportedLanguage {
  try {
    const germanRaw = window.localStorage.getItem(
      "katchup-learning-progress-v1-german",
    );
    const spanishRaw = window.localStorage.getItem(
      "katchup-learning-progress-v1-spanish",
    );

    const germanLecture = germanRaw
      ? ((JSON.parse(germanRaw) as { currentLecture?: number })
          .currentLecture ?? 1)
      : 1;
    const spanishLecture = spanishRaw
      ? ((JSON.parse(spanishRaw) as { currentLecture?: number })
          .currentLecture ?? 1)
      : 1;

    return spanishLecture > germanLecture ? "spanish" : "german";
  } catch {
    return "german";
  }
}

const ChooseOneMultiplayerPage = () => {
  const router = useRouter();
  const [language, setLanguage] = useState<SupportedLanguage>("german");
  const [mode, setMode] = useState<MatchMode>("live");
  const [matchState, setMatchState] = useState<MatchState>("idle");
  const [searchPulse, setSearchPulse] = useState(0);
  const [opponent, setOpponent] = useState<OpponentPreview>(
    DEFAULT_OPPONENTS[0],
  );
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [topAsyncPlayers, setTopAsyncPlayers] = useState<
    Array<{ name: string; score: number; timeMs: number }>
  >([]);
  const [recentMatches, setRecentMatches] = useState<MatchHistoryEntry[]>([]);
  const { progress, isHydrated } = useLearningProgress(language);

  const level = useMemo(
    () => levelFromLecture(progress.currentLecture),
    [progress.currentLecture],
  );

  useEffect(() => {
    setLanguage(getPreferredLanguage());
    setProfile(getPlayerProfile());

    try {
      const stored = window.localStorage.getItem(MATCH_HISTORY_KEY);
      const parsed = stored ? (JSON.parse(stored) as MatchHistoryEntry[]) : [];
      setRecentMatches(parsed.slice(0, 4));
    } catch {
      setRecentMatches([]);
    }
  }, []);

  useEffect(() => {
    const loadAsyncLeaderboard = async () => {
      try {
        const response = await fetch(
          `/api/flip-cards/async-score?language=${language}&level=${level}`,
        );
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          leaderboard: Array<{ name: string; score: number; timeMs: number }>;
        };

        setTopAsyncPlayers(data.leaderboard ?? []);
      } catch {
        // Ignore non-critical leaderboard fetch errors.
      }
    };

    void loadAsyncLeaderboard();
  }, [language, level]);

  useEffect(() => {
    if (mode !== "live" || matchState !== "searching" || !profile) {
      return;
    }

    const pulseInterval = window.setInterval(() => {
      setSearchPulse((previous) => (previous + 1) % 4);
    }, 420);

    const pollInterval = window.setInterval(async () => {
      try {
        const response = await fetch(
          `/api/flip-cards/matchmaking/status?playerId=${profile.id}&language=${language}&level=${level}`,
        );

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          status: "matched" | "waiting" | "idle";
          matchId?: string;
          opponent?: OpponentPreview;
        };

        if (data.status === "matched" && data.matchId) {
          setMatchId(data.matchId);
          if (data.opponent) {
            setOpponent(data.opponent);
          }
          setMatchState("found");
        }
      } catch {
        // Keep polling to recover from transient errors.
      }
    }, 850);

    return () => {
      window.clearInterval(pulseInterval);
      window.clearInterval(pollInterval);
    };
  }, [language, level, matchState, mode, profile]);

  const startFindingOpponent = async () => {
    if (mode !== "live" || matchState === "searching" || !profile) {
      return;
    }

    setSearchError(null);
    setSearchPulse(0);
    setMatchState("searching");

    try {
      const response = await fetch("/api/flip-cards/matchmaking/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerId: profile.id,
          name: profile.name,
          avatar: profile.avatar,
          language,
          level,
        }),
      });

      if (!response.ok) {
        throw new Error("Join failed");
      }

      const data = (await response.json()) as {
        status: "waiting" | "matched";
        matchId?: string;
        opponent?: OpponentPreview;
      };

      if (data.status === "matched" && data.matchId) {
        setMatchId(data.matchId);
        if (data.opponent) {
          setOpponent(data.opponent);
        }
        setMatchState("found");
      }
    } catch {
      setSearchError("Matchmaking is unavailable right now. Try again.");
      setMatchState("idle");
    }
  };

  const startLiveMatch = () => {
    const params = new URLSearchParams({
      language,
      level,
      mode: "live",
      playerId: profile?.id ?? "player-local",
      playerName: profile?.name ?? "You",
      playerAvatar: profile?.avatar ?? "https://i.pravatar.cc/100?img=12",
      opponent: opponent.name,
      opponentAvatar: opponent.avatar,
    });

    if (matchId) {
      params.set("matchId", matchId);
    }

    router.push(`/games/choose-one-multiplayer/play?${params.toString()}`);
  };

  const startAsyncMatch = () => {
    const params = new URLSearchParams({
      language,
      level,
      mode: "async",
      playerId: profile?.id ?? "player-local",
      playerName: profile?.name ?? "You",
      playerAvatar: profile?.avatar ?? "https://i.pravatar.cc/100?img=12",
    });

    router.push(`/games/choose-one-multiplayer/play?${params.toString()}`);
  };

  return (
    <GamePage
      name="Choose One Multiplayer"
      description="Race another player live: you both get the same 10 word prompts and pick the correct translation. First to finish wins."
      bgImage="flip_cards.png"
    >
      <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-800/40">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Online Match Setup
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Compete live against another player or climb async score rankings.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Language
            </p>
            <p className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {LANGUAGE_LABELS[language]}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Preselected level
            </p>
            <p className="mt-1 text-sm font-medium text-zinc-600 dark:text-zinc-300">
              {isHydrated ? `${level} (auto from your progress)` : "Loading..."}
            </p>
          </div>
        </div>
      </div>

      <div className="flex w-full max-w-3xl flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex w-full flex-wrap items-center justify-center gap-2">
          <button
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
              mode === "live"
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400"
            }`}
            onClick={() => {
              setMode("live");
              setMatchState("idle");
            }}
          >
            Live Duel
          </button>
          <button
            className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
              mode === "async"
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400"
            }`}
            onClick={() => {
              setMode("async");
              setMatchState("idle");
            }}
          >
            Score Rush (Async)
          </button>
        </div>

        {mode === "live" && (
          <>
            {matchState === "idle" && (
              <button
                className="rounded-xl bg-emerald-600 px-8 py-3 text-base font-semibold text-white shadow transition hover:-translate-y-0.5 hover:bg-emerald-500"
                onClick={() => void startFindingOpponent()}
              >
                Play Online
              </button>
            )}

            {matchState === "searching" && (
              <div className="w-full max-w-md text-center">
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                  Searching opponent{".".repeat(searchPulse)}
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${25 + searchPulse * 25}%` }}
                  />
                </div>
              </div>
            )}

            {matchState === "found" && (
              <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
                <div className="relative">
                  <img
                    src={opponent.avatar}
                    alt={opponent.name}
                    className="h-16 w-16 animate-pulse rounded-full border-2 border-emerald-400 object-cover"
                  />
                  <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white bg-emerald-500" />
                </div>
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Opponent found: {opponent.name}
                </p>
                <button
                  className="rounded-xl bg-zinc-900 px-8 py-3 text-base font-semibold text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  onClick={startLiveMatch}
                >
                  Start Match
                </button>
              </div>
            )}

            {searchError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {searchError}
              </p>
            )}
          </>
        )}

        {mode === "async" && (
          <div className="w-full max-w-xl rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/40">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
              Submit your best score and race leaderboard ranking by speed and
              accuracy.
            </p>
            <div className="mt-3 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
              {topAsyncPlayers.length === 0 ? (
                <p>No entries yet for this level.</p>
              ) : (
                topAsyncPlayers.slice(0, 3).map((entry, index) => (
                  <p key={`${entry.name}-${index}`}>
                    #{index + 1} {entry.name} - {entry.score} pts -{" "}
                    {Math.round(entry.timeMs / 1000)}s
                  </p>
                ))
              )}
            </div>
            <button
              className="mt-4 rounded-xl bg-blue-600 px-8 py-3 text-base font-semibold text-white transition hover:bg-blue-500"
              onClick={startAsyncMatch}
            >
              Start Score Rush
            </button>
          </div>
        )}
      </div>

      <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Recent Matches
        </p>
        <div className="mt-3 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
          {recentMatches.length === 0 ? (
            <p>No match history yet.</p>
          ) : (
            recentMatches.map((entry, index) => (
              <p key={`${entry.createdAt}-${index}`}>
                {entry.mode === "live" ? "Live" : "Async"} - {entry.score} pts -{" "}
                {entry.winner === "player" ? "Win" : "Loss"}
              </p>
            ))
          )}
        </div>
      </div>
    </GamePage>
  );
};

export default ChooseOneMultiplayerPage;
