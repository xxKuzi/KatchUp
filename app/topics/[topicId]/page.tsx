"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useLanguage } from "@/app/_lib/languageContext";
import { useAuthState } from "@/app/_lib/auth";
import FeatureGate from "@/app/_components/FeatureGate";
import {
  ascendTopic,
  getLevelsForTopic,
  loadTopicsState,
  saveTopicsState,
  TOPICS,
} from "../_lib/topicsProgress";

export default function TopicDetailPage() {
  const params = useParams<{ topicId: string }>();
  const topicId = params.topicId;

  const { t, language } = useLanguage();
  const { isReady, isSignedIn } = useAuthState();
  const [refreshToken, setRefreshToken] = useState(0);
  const state = useMemo(() => {
    void refreshToken;
    return loadTopicsState(language);
  }, [language, refreshToken]);

  const topic = useMemo(
    () => TOPICS.find((item) => item.id === topicId) ?? null,
    [topicId],
  );

  const canUseTopics = isReady && isSignedIn;

  if (!topic) {
    return (
      <div className="mx-auto mt-20 max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-950">
        <p className="text-slate-600 dark:text-slate-300">
          {t("topics.notFound", "Topic was not found.")}
        </p>
        <Link
          href="/topics"
          className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition hover:bg-blue-700"
        >
          {t("topics.back", "Back to topics")}
        </Link>
      </div>
    );
  }

  const topicProgress = state.topicProgress[topic.id];
  const levels = getLevelsForTopic(state, topic.id);
  const completedAll = Boolean(topicProgress?.isCompleted);
  const ascended = Boolean(topicProgress?.isAscended);

  const handleAscend = () => {
    const nextState = ascendTopic(state, topic.id);
    saveTopicsState(language, nextState);
    setRefreshToken((value) => value + 1);
  };

  return (
    <div className="min-h-screen bg-background px-4 pb-20 pt-6 sm:px-8">
      <FeatureGate
        isAllowed={canUseTopics}
        message={t(
          "authGate.topics",
          "Track your topic progress and unlock packs with keys. Sign in to continue.",
        )}
      >
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          <section className="first-section-static-glow rounded-2xl border border-slate-200 bg-white/90 p-6 dark:border-slate-800 dark:bg-slate-950/70 sm:p-8">
            <Link
              href="/topics"
              className="inline-flex text-sm font-medium text-blue-600 transition hover:text-blue-700 dark:text-blue-300"
            >
              ← {t("topics.back", "Back to topics")}
            </Link>
            <h1 className="mt-4 text-3xl font-bold text-slate-900 dark:text-slate-100 sm:text-4xl">
              {topic.icon} - {topic.names[language]}
            </h1>
            <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
              {topic.descriptions[language]}
            </p>
            <p className="mt-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
              {t("topics.progress", "Progress")}:{" "}
              {topicProgress?.completedLevels.length ?? 0}/5
            </p>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            {levels.map((levelData) => {
              const gameHref = `/games/one-of-three?topicId=${encodeURIComponent(topic.id)}&level=${levelData.level}`;
              const completedBadgeClass = levelData.completed
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                : "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";

              return (
                <article
                  key={levelData.level}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      {t("topics.level", "Level")} {levelData.level}
                    </h2>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${completedBadgeClass}`}
                    >
                      {levelData.completed
                        ? t("topics.done", "Done")
                        : t("topics.pending", "Pending")}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {t("topics.mode", "Mode")}:{" "}
                    {levelData.mode === "flip-cards"
                      ? t("games.flipCards")
                      : t("games.oneOfThree")}
                  </p>

                  <div className="mt-4 flex gap-2">
                    <Link
                      href={gameHref}
                      className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
                    >
                      {t("topics.play", "Play")}
                    </Link>
                  </div>
                </article>
              );
            })}
          </section>

          {completedAll && (
            <section className="rounded-2xl border border-amber-300 bg-amber-50/90 p-6 text-center shadow-sm dark:border-amber-800 dark:bg-amber-950/60">
              <h3 className="text-2xl font-bold text-amber-800 dark:text-amber-300">
                {t("topics.completedTitle", "Topic completed")}
              </h3>
              <p className="mt-2 text-sm text-amber-700 dark:text-amber-200">
                {t(
                  "topics.completedText",
                  "You earned a key. Return to topics to unlock a new pack.",
                )}
              </p>
              <button
                type="button"
                disabled={ascended}
                onClick={handleAscend}
                className="mt-4 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-500"
              >
                {ascended
                  ? t("topics.ascended", "Ascended")
                  : t("topics.ascend", "Ascend this pack")}
              </button>
            </section>
          )}
        </div>
      </FeatureGate>
    </div>
  );
}
