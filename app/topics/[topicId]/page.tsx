"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/app/_lib/languageContext";
import { useAuthState } from "@/app/_lib/auth";
import FeatureGate from "@/app/_components/FeatureGate";
import DeckProgress from "@/app/_components/DeckProgress";
import {
  DeckProgressSummary,
  fetchDeckLevelProgress,
} from "@/app/games/_lib/deckSessionClient";
import {
  ascendTopic,
  completeTopicLevel,
  getLevelsForTopic,
  loadTopicsState,
  saveTopicsState,
  TOPICS,
  topicTitle,
  topicDescription,
  useTopicsState,
} from "../_lib/topicsProgress";

/**
 * A level is finished once every word in it has been answered right at least
 * once. Mastery (`known`, three correct in a row) is the tier above and is
 * earned by coming back to the topic, not by replaying one level three times.
 */
function isLevelCleared(progress: DeckProgressSummary): boolean {
  return progress.total > 0 && progress.cleared >= progress.total;
}

export default function TopicDetailPage() {
  const params = useParams<{ topicId: string }>();
  const router = useRouter();
  const topicId = params.topicId;

  const { t, language, learningLanguage } = useLanguage();
  const { isReady, isSignedIn } = useAuthState();
  const [deckId, setDeckId] = useState<string | null>(null);
  const [levelProgress, setLevelProgress] = useState<
    DeckProgressSummary[] | null
  >(null);
  const state = useTopicsState(language);

  const topic = useMemo(
    () => TOPICS.find((item) => item.id === topicId) ?? null,
    [topicId],
  );

  // Resolve the DB topic deck for (topicKey, foreignLang) so levels can link
  // with a real deck ID and use DB words + spaced-repetition tracking.
  const foreignLang = learningLanguage;
  const fetchDeckId = useCallback(async () => {
    if (!topic) return;
    try {
      const res = await fetch(
        `/api/decks/topic-lookup?topicKey=${encodeURIComponent(topic.id)}&foreignLang=${encodeURIComponent(foreignLang)}`,
      );
      if (res.ok) {
        const data = (await res.json()) as { deckId: string };
        setDeckId(data.deckId);
      }
    } catch {
      // silently fall back to non-deck mode
    }
  }, [topic, foreignLang]);

  useEffect(() => {
    if (isSignedIn) {
      void fetchDeckId();
    }
  }, [isSignedIn, fetchDeckId]);

  // How many of each level's words are actually mastered. A level used to read
  // "Done" as soon as its cards had been swiped through once, which said Done at
  // 3 of 6 words learned; these counts are what the cards report now.
  useEffect(() => {
    if (!deckId) {
      return;
    }

    let cancelled = false;
    fetchDeckLevelProgress(deckId)
      .then((levels) => {
        if (!cancelled) {
          setLevelProgress(levels);
        }
      })
      .catch(() => {
        // Non-critical: the cards fall back to the stored played/not-played flag.
      });

    return () => {
      cancelled = true;
    };
  }, [deckId]);

  // Keys and Ascend still run off the stored `completedLevels`, so a level the
  // server says is cleared gets recorded here — including one cleared in another
  // browser, which this page would otherwise never hear about.
  //
  // Additive on purpose: levels wrongly marked done by the old "played once"
  // rule stay recorded, because clearing them would revoke keys already spent.
  // They no longer read as Done, since the badge now follows these counts.
  useEffect(() => {
    if (!topic || !levelProgress) {
      return;
    }

    let next = loadTopicsState(language);
    let changed = false;

    levelProgress.forEach((progress, index) => {
      if (!isLevelCleared(progress)) {
        return;
      }
      const result = completeTopicLevel(next, topic.id, index + 1);
      if (result.nextState !== next) {
        next = result.nextState;
        changed = true;
      }
    });

    if (changed) {
      saveTopicsState(language, next);
    }
  }, [language, levelProgress, topic]);

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

  const name = topicTitle(topic, learningLanguage, language);
  const topicProgress = state.topicProgress[topic.id];
  const levels = getLevelsForTopic(state, topic.id);
  const completedAll = Boolean(topicProgress?.isCompleted);
  const ascended = Boolean(topicProgress?.isAscended);

  const clearedCount = levelProgress
    ? levelProgress.filter(isLevelCleared).length
    : (topicProgress?.completedLevels.length ?? 0);

  // One bar for the whole pack: the five level windows added back together.
  const topicTotals = levelProgress?.reduce(
    (totals, progress) => ({
      total: totals.total + progress.total,
      cleared: totals.cleared + progress.cleared,
      known: totals.known + progress.known,
    }),
    { total: 0, cleared: 0, known: 0 },
  );

  // Ascending is the last thing there is to do on a finished pack, so it hands
  // the player back to the topic list — with `completedTopic` set, which is what
  // makes the card celebrate and points them at the pack their key unlocks.
  const handleAscend = () => {
    saveTopicsState(language, ascendTopic(state, topic.id));
    router.push(`/topics?completedTopic=${encodeURIComponent(topic.id)}`);
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
              {name.learning}
            </h1>
            {name.native && (
              <p className="mt-1 text-lg font-semibold text-slate-500 dark:text-slate-400">
                {name.native}
              </p>
            )}
            <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
              {topicDescription(topic, language)}
            </p>
            <p className="mt-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
              {t("topics.progress", "Progress")}: {clearedCount}/5
            </p>

            {/* Every word of the pack in one bar: solid is learned for good,
                pale is met at least once — which is what finishes a level. */}
            {topicTotals && topicTotals.total > 0 && (
              <div className="mt-4 max-w-md">
                <p className="flex items-baseline justify-between gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  <span>
                    {topicTotals.cleared} / {topicTotals.total}{" "}
                    {t("topics.met", "met")}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {topicTotals.known} {t("topics.learned", "learned")}
                  </span>
                </p>
                <DeckProgress
                  className="mt-2"
                  known={topicTotals.known}
                  cleared={topicTotals.cleared}
                  total={topicTotals.total}
                  showLabel={false}
                />
              </div>
            )}
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            {levels.map((levelData) => {
              // When we have a resolved DB deck, route through the deck path so
              // the game uses real seeded words and records spaced-repetition
              // stats. Falls back to the old topicId path otherwise.
              const gameBase =
                levelData.mode === "flip-cards"
                  ? "/games/flip-cards"
                  : "/games/one-of-three";

              const gameHref = deckId
                ? `${gameBase}?deck=${deckId}&topicId=${encodeURIComponent(topic.id)}&level=${levelData.level}`
                : `${gameBase}?topicId=${encodeURIComponent(topic.id)}&level=${levelData.level}`;

              // The server's word counts decide what the card says whenever we
              // have them; the stored flag is only the fallback for a signed-out
              // view or a topic whose deck could not be resolved.
              const progress = levelProgress?.[levelData.level - 1] ?? null;
              const cleared = progress
                ? isLevelCleared(progress)
                : levelData.completed;
              const started = progress
                ? progress.cleared > 0 || levelData.completed
                : false;

              const badgeLabel = cleared
                ? t("topics.done", "Done")
                : progress && started
                  ? `${progress.cleared} / ${progress.total}`
                  : t("topics.pending", "Pending");

              const playLabel = cleared
                ? t("topics.practiceAgain", "Practice again")
                : started
                  ? t("topics.continue", "Continue")
                  : t("topics.play", "Play");

              const completedBadgeClass = cleared
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
                      {badgeLabel}
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
                      {playLabel}
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
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={ascended}
                  onClick={handleAscend}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-500"
                >
                  {ascended
                    ? t("topics.ascended", "Ascended")
                    : t("topics.ascend", "Ascend this pack")}
                </button>

                {/* Clearing the ladder only means every word was met once. This
                    is where met turns into learned: a finish round over the
                    whole pack, weighted to the words that were missed. */}
                {deckId && (
                  <Link
                    href={`/games/flip-cards?deck=${deckId}&mode=finish`}
                    className="rounded-lg border border-amber-400 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/50"
                  >
                    {t("topics.reviewTopic", "Review this topic")}
                  </Link>
                )}
              </div>
            </section>
          )}
        </div>
      </FeatureGate>
    </div>
  );
}
