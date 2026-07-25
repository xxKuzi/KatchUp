"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GamePage from "../_components/GamePage";
import { LANG_LABELS, type CefrLevel } from "@/app/_lib/languages";
import { useLanguagePair } from "@/app/_lib/useLanguagePair";
import { useLearningLevel } from "@/app/_lib/useLearningLevel";
import { getPlayerProfile, PlayerProfile } from "../choose-one-multiplayer/_lib/playerProfile";

const RUN_HISTORY_KEY = "katchup-score-rush-history-v1";

interface RunHistoryEntry {
  createdAt: number;
  score: number;
  correct: number;
}

const ScoreRushPage = () => {
  const router = useRouter();
  const { speak, learning } = useLanguagePair();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [topPlayers, setTopPlayers] = useState<
    Array<{ name: string; score: number; timeMs: number }>
  >([]);
  const [recentRuns, setRecentRuns] = useState<RunHistoryEntry[]>([]);

  // Derived from how many words you've actually mastered in the target
  // language; null while loading or signed out, in which case we start at A1.
  const learningLevel = useLearningLevel(learning);
  const level: CefrLevel =
    learningLevel && learningLevel.label !== "C2"
      ? (learningLevel.label as CefrLevel)
      : "A1";
  const isHydrated = learningLevel !== null;

  useEffect(() => {
    setProfile(getPlayerProfile());

    try {
      const stored = window.localStorage.getItem(RUN_HISTORY_KEY);
      const parsed = stored ? (JSON.parse(stored) as RunHistoryEntry[]) : [];
      setRecentRuns(parsed.slice(0, 4));
    } catch {
      setRecentRuns([]);
    }
  }, []);

  useEffect(() => {
    const loadLeaderboard = async () => {
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

        setTopPlayers(data.leaderboard ?? []);
      } catch {
        // Ignore non-critical leaderboard fetch errors.
      }
    };

    void loadLeaderboard();
  }, [learning, level]);

  const startRun = () => {
    const params = new URLSearchParams({
      speak,
      learning,
      level,
      playerId: profile?.id ?? "player-local",
      playerName: profile?.name ?? "You",
      playerAvatar: profile?.avatar ?? "https://i.pravatar.cc/100?img=12",
    });

    router.push(`/games/score-rush/play?${params.toString()}`);
  };

  return (
    <GamePage
      name="Score Rush"
      description="You've got 30 seconds. Answer as many translations correctly as you can and climb the leaderboard."
      bgImage="one_of_three.png"
    >
      <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-800/40">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          30 Second Challenge
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Solo speed run. Every correct answer scores points, with a bonus for
          speed. When the clock hits zero, your score is submitted to the
          leaderboard.
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
      </div>

      <div className="flex w-full max-w-3xl flex-col items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <button
          onClick={startRun}
          className="w-full py-4 px-6 flex flex-col items-center justify-center rounded-2xl border border-blue-200 bg-blue-50/50 hover:bg-blue-50 dark:border-blue-800/40 dark:bg-blue-950/10 dark:hover:bg-blue-950/20 transition hover:-translate-y-0.5"
        >
          <span className="text-xl font-bold text-blue-800 dark:text-blue-300">
            Start Score Rush
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
            30 seconds on the clock. Answer as fast and accurately as you can.
          </span>
        </button>
      </div>

      <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900 mt-2">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
          Leaderboard
        </p>
        <div className="space-y-1.5 text-xs text-zinc-600 dark:text-zinc-300">
          {topPlayers.length === 0 ? (
            <p className="text-zinc-500 italic">No entries yet for this level.</p>
          ) : (
            topPlayers.slice(0, 5).map((entry, index) => (
              <p key={`${entry.name}-${index}`}>
                #{index + 1} {entry.name} - {entry.score} pts
              </p>
            ))
          )}
        </div>
      </div>

      <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Recent Runs
        </p>
        <div className="mt-3 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
          {recentRuns.length === 0 ? (
            <p>No runs yet.</p>
          ) : (
            recentRuns.map((entry, index) => (
              <p key={`${entry.createdAt}-${index}`}>
                {entry.score} pts - {entry.correct} correct
              </p>
            ))
          )}
        </div>
      </div>
    </GamePage>
  );
};

export default ScoreRushPage;
