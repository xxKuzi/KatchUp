"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Crown, History, Medal, Target, Trophy } from "lucide-react";
import GamePage from "../_components/GamePage";
import { type CefrLevel } from "@/app/_lib/languages";
import { useLanguagePair } from "@/app/_lib/useLanguagePair";
import { useLearningLevel } from "@/app/_lib/useLearningLevel";
import {
  getPlayerProfile,
  PlayerProfile,
} from "../live-duel/_lib/playerProfile";
import { useDuelNickname } from "../live-duel/_lib/useDuelNickname";
import { useSession } from "@/lib/auth-client";

const LEADERBOARD_CACHE_PREFIX = "katchup-score-rush-leaderboard-v3";
const RECENT_RUNS_CACHE_PREFIX = "katchup-score-rush-recent-v2";

interface RunHistoryEntry {
  id: string;
  createdAt: string;
  score: number;
  correct: number;
}

interface LeaderboardEntry {
  userId: string;
  name: string;
  score: number;
  timeMs: number;
  rank: number;
}

interface LeaderboardPayload {
  leaderboard: LeaderboardEntry[];
  currentPlayer: LeaderboardEntry | null;
}

function RecentRunsSkeleton() {
  return (
    <div
      className="grid gap-2 sm:grid-cols-2"
      aria-label="Loading recent runs"
      role="status"
    >
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="h-[5.25rem] animate-pulse rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
        />
      ))}
    </div>
  );
}

const ScoreRushPage = () => {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const { speak, learning } = useLanguagePair();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [topPlayers, setTopPlayers] = useState<LeaderboardEntry[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<LeaderboardEntry | null>(
    null,
  );
  const [recentRuns, setRecentRuns] = useState<RunHistoryEntry[]>([]);
  const [recentRunsCacheScope, setRecentRunsCacheScope] = useState<
    string | null
  >(null);
  const getNickname = useDuelNickname(profile?.name ?? "You");

  // Derived from how many words you've actually mastered in the target
  // language; null while loading or signed out, in which case we start easy.
  const learningLevel = useLearningLevel(learning);
  // The player sees a level number; the word pool still needs a difficulty.
  const level: CefrLevel = learningLevel?.wordDifficulty ?? "A1";
  const accountCacheId = session?.user?.email?.trim().toLowerCase() ?? null;
  const recentRunsScope = `${accountCacheId ?? "anonymous"}:${learning}:${level}`;
  const recentRunsCacheKey = accountCacheId
    ? `${RECENT_RUNS_CACHE_PREFIX}:${recentRunsScope}`
    : null;
  const recentRunsReady = recentRunsCacheScope === recentRunsScope;

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) {
        setProfile(getPlayerProfile());
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (sessionStatus === "loading") {
      return;
    }

    const leaderboardCacheKey = `${LEADERBOARD_CACHE_PREFIX}:${accountCacheId ?? "anonymous"}:${learning}`;
    let cancelled = false;
    let hasCachedRecentRuns = false;

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      try {
        const cachedLeaderboard =
          window.localStorage.getItem(leaderboardCacheKey);
        if (cachedLeaderboard) {
          const parsed = JSON.parse(cachedLeaderboard) as LeaderboardPayload;
          if (Array.isArray(parsed.leaderboard)) {
            setTopPlayers(parsed.leaderboard);
            setCurrentPlayer(parsed.currentPlayer ?? null);
          }
        } else {
          setTopPlayers([]);
          setCurrentPlayer(null);
        }
      } catch {
        // A missing or invalid cache should never prevent a fresh request.
      }

      try {
        const cachedRecentRuns = recentRunsCacheKey
          ? window.localStorage.getItem(recentRunsCacheKey)
          : null;
        if (cachedRecentRuns) {
          const parsed = JSON.parse(cachedRecentRuns) as RunHistoryEntry[];
          if (Array.isArray(parsed)) {
            hasCachedRecentRuns = true;
            setRecentRuns(parsed.slice(0, 4));
            setRecentRunsCacheScope(recentRunsScope);
          }
        } else {
          setRecentRuns([]);
        }
      } catch {
        setRecentRuns([]);
      }
    });

    const loadLeaderboard = async () => {
      try {
        const response = await fetch(
          `/api/flip-cards/async-score?language=${learning}&level=${level}`,
        );
        if (!response.ok) {
          if (!cancelled && !hasCachedRecentRuns) {
            setRecentRuns([]);
            setRecentRunsCacheScope(recentRunsScope);
          }
          return;
        }

        const data = (await response.json()) as LeaderboardPayload & {
          recentRuns: RunHistoryEntry[];
        };

        if (cancelled) {
          return;
        }

        const leaderboard = data.leaderboard ?? [];
        setTopPlayers(leaderboard);
        setCurrentPlayer(data.currentPlayer ?? null);
        const latestRuns = (data.recentRuns ?? []).slice(0, 4);
        setRecentRuns(latestRuns);
        setRecentRunsCacheScope(recentRunsScope);

        try {
          window.localStorage.setItem(
            leaderboardCacheKey,
            JSON.stringify({
              leaderboard,
              currentPlayer: data.currentPlayer ?? null,
            } satisfies LeaderboardPayload),
          );
          if (recentRunsCacheKey) {
            window.localStorage.setItem(
              recentRunsCacheKey,
              JSON.stringify(latestRuns),
            );
          }
        } catch {
          // The live result is still usable when storage is unavailable.
        }
      } catch {
        // Keep showing the cached board when the refresh fails.
        if (!cancelled && !hasCachedRecentRuns) {
          setRecentRuns([]);
          setRecentRunsCacheScope(recentRunsScope);
        }
      }
    };

    void loadLeaderboard();

    return () => {
      cancelled = true;
    };
  }, [
    accountCacheId,
    learning,
    level,
    recentRunsCacheKey,
    recentRunsScope,
    sessionStatus,
  ]);

  const startRun = () => {
    const params = new URLSearchParams({
      speak,
      learning,
      level,
      playerId: profile?.id ?? "player-local",
      playerName: getNickname(),
      playerAvatar: profile?.avatar ?? "https://i.pravatar.cc/100?img=12",
    });

    router.push(`/games/score-rush/play?${params.toString()}`);
  };

  const displayedPlayers = currentPlayer
    ? [
        ...topPlayers
          .filter((entry) => entry.userId !== currentPlayer.userId)
          .slice(0, 4),
        currentPlayer,
      ]
    : topPlayers.slice(0, 5);

  return (
    <GamePage
      name="Score Rush"
      description="You've got 30 seconds. Answer as many translations correctly as you can and climb the leaderboard."
      bgImage="score_rush.webp"
      heroFirst
    >
      <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-800/40">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
            <Clock3 className="size-6" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              30 Second Challenge
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Answer fast, build your score, and take your place on the
              leaderboard. Every correct answer counts.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex w-full max-w-md flex-col items-center gap-3 sm:mt-8">
        <button
          type="button"
          onClick={startRun}
          className="w-full cursor-pointer rounded-xl border-2 border-solid border-transparent bg-red-700 px-8 py-4 text-lg font-bold text-white shadow-sm transition hover:border-dashed hover:border-white hover:bg-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          aria-label="Start a 30 second Score Rush"
        >
          Start Score Rush
        </button>
        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
          30 seconds on the clock. Answer as fast and accurately as you can.
        </p>
      </div>

      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <span className="flex size-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
            <History className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100">
              Recent Runs
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Your latest attempts
            </p>
          </div>
        </div>

        <div className="p-3" aria-busy={!recentRunsReady}>
          <Suspense fallback={<RecentRunsSkeleton />}>
            {!recentRunsReady ? (
              <RecentRunsSkeleton />
            ) : recentRuns.length === 0 ? (
              <div className="flex flex-col items-center px-4 py-8 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
                  <Target className="size-6" aria-hidden="true" />
                </span>
                <p className="mt-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                  No runs yet
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Your results will appear here after your first rush.
                </p>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {recentRuns.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-2xl font-black tabular-nums text-zinc-900 dark:text-white">
                          {entry.score}
                          <span className="ml-1 text-xs font-bold uppercase tracking-wide text-zinc-400">
                            pts
                          </span>
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          <Target className="size-3.5" aria-hidden="true" />
                          {entry.correct} correct
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400 shadow-sm dark:bg-zinc-900 dark:text-zinc-500">
                        {index === 0 ? "Latest" : `Run ${index + 1}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Suspense>
        </div>
      </div>

      <div className="mt-3 w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300">
              <Trophy className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100">
                Leaderboard
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Today&apos;s fastest minds
              </p>
            </div>
          </div>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            Top 4 + You
          </span>
        </div>

        <div className="min-h-[19.5rem] p-3">
          {displayedPlayers.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-8 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
                <Medal className="size-6" aria-hidden="true" />
              </span>
              <p className="mt-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                The board is wide open
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Finish a run and set the score to beat.
              </p>
            </div>
          ) : (
            displayedPlayers.map((entry) => {
              const isCurrentPlayer = currentPlayer?.userId === entry.userId;

              return (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 ${
                    isCurrentPlayer
                      ? "border border-blue-200 bg-blue-50 dark:border-blue-800/60 dark:bg-blue-950/30"
                      : entry.rank === 1
                        ? "bg-amber-50 dark:bg-amber-950/20"
                        : "odd:bg-zinc-50 dark:odd:bg-zinc-800/40"
                  }`}
                >
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                      isCurrentPlayer
                        ? "bg-blue-600 text-white"
                        : entry.rank === 1
                          ? "bg-amber-400 text-amber-950"
                          : entry.rank === 2
                            ? "bg-zinc-300 text-zinc-700 dark:bg-zinc-600 dark:text-zinc-100"
                            : entry.rank === 3
                              ? "bg-orange-200 text-orange-800 dark:bg-orange-900/60 dark:text-orange-200"
                              : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {entry.rank === 1 && !isCurrentPlayer ? (
                      <Crown
                        className="size-5 fill-current"
                        aria-label="First place"
                      />
                    ) : (
                      entry.rank
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                    {entry.name}
                    {isCurrentPlayer && (
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                        You
                      </span>
                    )}
                  </span>
                  <span className="text-right">
                    <span className="block text-base font-black tabular-nums text-blue-600 dark:text-blue-400">
                      {entry.score}
                    </span>
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                      points
                    </span>
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </GamePage>
  );
};

export default ScoreRushPage;
