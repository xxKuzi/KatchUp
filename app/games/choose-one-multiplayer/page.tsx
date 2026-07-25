"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import GamePage from "../_components/GamePage";
import { LANG_LABELS, type CefrLevel } from "@/app/_lib/languages";
import { useLanguagePair } from "@/app/_lib/useLanguagePair";
import { useLearningLevel } from "@/app/_lib/useLearningLevel";
import { hasAnonPlaysRemaining } from "../_lib/anonPlayGate";
import { getPlayerProfile, PlayerProfile } from "./_lib/playerProfile";
import { useSession } from "@/lib/auth-client";
import { pusherClient } from "@/lib/realtime/pusher-client";

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

const ChooseOneMultiplayerPage = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const isSignedIn = Boolean(session?.user?.id);
  const { speak, learning } = useLanguagePair();

  const [mode, setMode] = useState<MatchMode>("live");
  const [matchState, setMatchState] = useState<MatchState>("idle");
  const [matchSettings, setMatchSettings] = useState<"fair" | "personal">("fair");
  const [searchPulse, setSearchPulse] = useState(0);
  const [opponent, setOpponent] = useState<OpponentPreview>(
    DEFAULT_OPPONENTS[0],
  );
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [matchStartAt, setMatchStartAt] = useState<number | null>(null);
  const autoStartedMatchId = useRef<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [topAsyncPlayers, setTopAsyncPlayers] = useState<
    Array<{ name: string; score: number; timeMs: number }>
  >([]);
  const [recentMatches, setRecentMatches] = useState<MatchHistoryEntry[]>([]);
  const learningLevel = useLearningLevel(learning);
  const level: CefrLevel =
    learningLevel && learningLevel.label !== "C2"
      ? (learningLevel.label as CefrLevel)
      : "A1";
  const isHydrated = learningLevel !== null;

  useEffect(() => {
    setProfile(getPlayerProfile());

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlMode = params.get("mode");
      if (urlMode === "async" || urlMode === "live") {
        setMode(urlMode as MatchMode);
      }
    }

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
          `/api/flip-cards/async-score?language=${learning}&level=${level}`,
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
  }, [learning, level]);

  const applyMatchFound = (found: {
    matchId: string;
    opponent?: OpponentPreview;
    matchStartAt?: number;
  }) => {
    setMatchId(found.matchId);
    if (found.opponent) {
      setOpponent(found.opponent);
    }
    if (found.matchStartAt) {
      setMatchStartAt(found.matchStartAt);
    }
    setMatchState("found");
  };

  // Instant push: the server notifies the opponent the moment a match is
  // created, so the waiting player doesn't have to wait on the ~1s poll below.
  useEffect(() => {
    const userId = session?.user?.id;
    const client = pusherClient;
    if (mode !== "live" || matchState !== "searching" || !userId || !client) {
      return;
    }

    const channel = client.subscribe(`user-${userId}`);
    const handler = (data: {
      matchId: string;
      opponent?: { userId: string; name: string; avatar: string };
      startAt?: number;
    }) => {
      applyMatchFound({
        matchId: data.matchId,
        opponent: data.opponent,
        matchStartAt: data.startAt,
      });
    };
    channel.bind("match-found", handler);

    return () => {
      channel.unbind("match-found", handler);
      client.unsubscribe(`user-${userId}`);
    };
  }, [matchState, mode, session?.user?.id]);

  useEffect(() => {
    if (mode !== "live" || matchState !== "searching" || !profile) {
      return;
    }

    const pulseInterval = window.setInterval(() => {
      setSearchPulse((previous) => (previous + 1) % 4);
    }, 420);

    // Polling fallback in case the Pusher push above is missed/delayed.
    const pollInterval = window.setInterval(async () => {
      try {
        const response = await fetch(
          `/api/flip-cards/matchmaking/status?playerId=${profile.id}&language=${learning}&level=${level}`,
        );

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          status: "matched" | "waiting" | "idle";
          matchId?: string;
          opponent?: OpponentPreview;
          matchStartAt?: number;
        };

        if (data.status === "matched" && data.matchId) {
          applyMatchFound({
            matchId: data.matchId,
            opponent: data.opponent,
            matchStartAt: data.matchStartAt,
          });
        }
      } catch {
        // Keep polling to recover from transient errors.
      }
    }, 850);

    return () => {
      window.clearInterval(pulseInterval);
      window.clearInterval(pollInterval);
    };
  }, [learning, level, matchState, mode, profile]);

  const startFindingOpponent = async () => {
    if (matchState === "searching" || !profile) {
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
          language: learning,
          nativeLang: speak,
          level,
          mode: matchSettings,
        }),
      });

      if (!response.ok) {
        throw new Error("Join failed");
      }

      const data = (await response.json()) as {
        status: "waiting" | "matched";
        matchId?: string;
        opponent?: OpponentPreview;
        matchStartAt?: number;
      };

      if (data.status === "matched" && data.matchId) {
        applyMatchFound({
          matchId: data.matchId,
          opponent: data.opponent,
          matchStartAt: data.matchStartAt,
        });
      }
    } catch {
      setSearchError("Matchmaking is unavailable right now. Try again.");
      setMatchState("idle");
    }
  };

  const startLiveMatch = () => {
    const params = new URLSearchParams({
      speak,
      learning,
      level,
      mode: "live",
      settingsMode: matchSettings,
      playerId: profile?.id ?? "player-local",
      playerName: profile?.name ?? "You",
      playerAvatar: profile?.avatar ?? "https://i.pravatar.cc/100?img=12",
      opponent: opponent.name,
      opponentAvatar: opponent.avatar,
    });

    if (matchId) {
      params.set("matchId", matchId);
    }
    if (matchStartAt) {
      params.set("startAt", String(matchStartAt));
    }

    router.push(`/games/choose-one-multiplayer/play?${params.toString()}`);
  };

  // Both players should land on the play screen without relying on each of
  // them individually clicking "Start Match" at their own pace - otherwise
  // one side can sit on the countdown far longer than the other.
  useEffect(() => {
    if (matchState !== "found" || !matchId) {
      return;
    }
    if (autoStartedMatchId.current === matchId) {
      return;
    }
    autoStartedMatchId.current = matchId;

    const timeoutId = window.setTimeout(() => {
      startLiveMatch();
    }, 600);

    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchState, matchId]);

  const startAsyncMatch = () => {
    if (!isSignedIn && !hasAnonPlaysRemaining()) {
      router.push(`/login?callbackUrl=${encodeURIComponent("/")}`);
      return;
    }

    const params = new URLSearchParams({
      speak,
      learning,
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
              {LANG_LABELS[speak]} → {LANG_LABELS[learning]}
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

        {mode === "live" && (
          <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-xs uppercase tracking-wide text-zinc-500 font-semibold mb-2">
              Matchmaking Mode
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setMatchSettings("fair")}
                className={`flex-1 flex flex-col items-center justify-center rounded-xl border p-3 text-center transition ${
                  matchSettings === "fair"
                    ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 ring-2 ring-emerald-500/20"
                    : "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 hover:border-zinc-300"
                }`}
              >
                <span className="text-sm font-bold">Fair Mode</span>
                <span className="text-xxs text-zinc-500 mt-0.5">Same words for both players</span>
              </button>
              <button
                onClick={() => setMatchSettings("personal")}
                className={`flex-1 flex flex-col items-center justify-center rounded-xl border p-3 text-center transition ${
                  matchSettings === "personal"
                    ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 ring-2 ring-emerald-500/20"
                    : "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 hover:border-zinc-300"
                }`}
              >
                <span className="text-sm font-bold">Personalized Mode</span>
                <span className="text-xxs text-zinc-500 mt-0.5">Asymmetric custom/recent vocabulary</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex w-full max-w-3xl flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        {mode === "live" ? (
          <>
            {matchState === "idle" && (
              <button
                onClick={() => void startFindingOpponent()}
                className="w-full py-4 px-6 flex flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-950/10 dark:hover:bg-emerald-950/20 transition hover:-translate-y-0.5"
              >
                <span className="text-xl font-bold text-emerald-800 dark:text-emerald-300">
                  Start Live Duel
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                  Match with a live opponent instantly and race to finish translating words.
                </span>
              </button>
            )}

            {matchState === "searching" && (
              <div className="w-full max-w-md text-center py-4">
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                  Searching opponent{".".repeat(searchPulse)}
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${25 + searchPulse * 25}%` }}
                  />
                </div>
                <button
                  onClick={() => setMatchState("idle")}
                  className="mt-6 rounded-xl border border-zinc-200 bg-white px-6 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
                >
                  Cancel Matchmaking
                </button>
              </div>
            )}

            {matchState === "found" && (
              <div className="flex w-full max-w-md flex-col items-center gap-4 text-center py-4">
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
          </>
        ) : (
          <button
            onClick={startAsyncMatch}
            className="w-full py-4 px-6 flex flex-col items-center justify-center rounded-2xl border border-blue-200 bg-blue-50/50 hover:bg-blue-50 dark:border-blue-800/40 dark:bg-blue-950/10 dark:hover:bg-blue-950/20 transition hover:-translate-y-0.5"
          >
            <span className="text-xl font-bold text-blue-800 dark:text-blue-300">
              {isSignedIn || hasAnonPlaysRemaining()
                ? "Start Score Rush"
                : "Sign in to keep playing Score Rush"}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
              {isSignedIn || hasAnonPlaysRemaining()
                ? "Climb async leaderboard rankings by matching words as fast as possible."
                : "You've used your free Score Rush round. Sign in to keep climbing the leaderboard."}
            </span>
          </button>
        )}

        {searchError && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {searchError}
          </p>
        )}
      </div>

      <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900 mt-2">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
          Leaderboard (Score Rush)
        </p>
        <div className="space-y-1.5 text-xs text-zinc-600 dark:text-zinc-300">
          {topAsyncPlayers.length === 0 ? (
            <p className="text-zinc-500 italic">No entries yet for this level.</p>
          ) : (
            topAsyncPlayers.slice(0, 3).map((entry, index) => (
              <p key={`${entry.name}-${index}`}>
                #{index + 1} {entry.name} - {entry.score} pts -{" "}
                {Math.round(entry.timeMs / 1000)}s
              </p>
            ))
          )}
        </div>
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
