"use client";

import { useAuthState } from "@/app/_lib/auth";
import { useLanguage } from "@/app/_lib/languageContext";
import FeatureGate from "@/app/_components/FeatureGate";
import {
  loadTopicsState,
  saveTopicsState,
  TOPICS,
  unlockTopic,
} from "./_lib/topicsProgress";
import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import TopicCard from "./_components/TopicCard";

export default function TopicsPage() {
  const { t, language } = useLanguage();
  const { isSignedIn, isReady } = useAuthState();
  const [refreshToken, setRefreshToken] = useState(0);
  const [lastCompletedTopic, setLastCompletedTopic] = useState<string | null>(
    () => {
      if (typeof window === "undefined") {
        return null;
      }

      const params = new URLSearchParams(window.location.search);
      const completed = params.get("completedTopic");
      return completed && TOPICS.some((topic) => topic.id === completed)
        ? completed
        : null;
    },
  );

  const state = useMemo(() => {
    void refreshToken;
    return loadTopicsState(language);
  }, [language, refreshToken]);

  useEffect(() => {
    if (lastCompletedTopic) {
      window.history.replaceState({}, "", "/topics");
      const timeout = window.setTimeout(
        () => setLastCompletedTopic(null),
        3200,
      );
      return () => {
        window.clearTimeout(timeout);
      };
    }

    return undefined;
  }, [lastCompletedTopic]);

  const canUseTopics = isReady && isSignedIn;

  const topicCards = useMemo(() => {
    return TOPICS.map((topic) => {
      const progress = state.topicProgress[topic.id];
      const levelCount = progress?.completedLevels.length ?? 0;
      const unlocked = state.unlockedTopicIds.includes(topic.id);
      const justCompleted = lastCompletedTopic === topic.id;

      return {
        topic,
        levelCount,
        unlocked,
        justCompleted,
        ascended: Boolean(progress?.isAscended),
      };
    });
  }, [lastCompletedTopic, state]);

  const handleUnlock = (topicId: string) => {
    const next = unlockTopic(state, topicId);
    saveTopicsState(language, next);
    setRefreshToken((value) => value + 1);
  };

  return (
    <div className="min-h-screen bg-background px-6 pb-24 pt-6 text-foreground sm:px-12">
      <FeatureGate
        isAllowed={canUseTopics}
        message={t(
          "authGate.topics",
          "Track your topic progress and unlock packs with keys. Sign in to continue.",
        )}
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
          <section className="first-section-static-glow rounded-2xl border border-slate-200 bg-white/90 p-6 dark:border-slate-800 dark:bg-slate-950/70 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              {t("topics.badge", "Learning Packs")}
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100 sm:text-4xl">
              {t("topics.title", "Choose a Topic")}
            </h1>
            <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
              {t(
                "topics.subtitle",
                "Five topics, each with five levels. Finish a topic to earn a key and unlock the next one.",
              )}
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
              <Sparkles size={16} />
              {t("topics.keys", "Keys")}: {state.keys}
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {topicCards.map(
              ({ topic, levelCount, unlocked, justCompleted, ascended }) => {
                return (
                  <TopicCard
                    key={topic.id}
                    topic={topic}
                    title={`${topic.icon} ${topic.names[language]}`}
                    description={topic.descriptions[language]}
                    levelCount={levelCount}
                    unlocked={unlocked}
                    justCompleted={justCompleted}
                    ascended={ascended}
                    href={`/topics/${topic.id}`}
                    onUnlock={() => handleUnlock(topic.id)}
                    canUnlock={state.keys > 0}
                  />
                );
              },
            )}
          </section>
        </div>
      </FeatureGate>
    </div>
  );
}
