"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Crown } from "lucide-react";
import { useLanguage } from "@/app/_lib/languageContext";
import { useAuthState } from "@/app/_lib/auth";
import FeatureGate from "@/app/_components/FeatureGate";
import DeckProgress from "@/app/_components/DeckProgress";
import {
  DeckProgressSummary,
  fetchDeckLevelProgress,
  LEGENDARY_PASS_PERCENT,
} from "@/app/games/_lib/deckSessionClient";
import {
  useCachedTopicProgress,
  writeTopicProgressCache,
} from "../_lib/levelProgressCache";
import {
  completeTopicLevel,
  getLevelsForTopic,
  loadTopicsState,
  markKeyCelebrated,
  saveTopicsState,
  TOPICS,
  topicTitle,
  topicDescription,
  useTopicsSync,
  useTopicsSnapshot,
} from "../_lib/topicsProgress";
import KeyEarnedPopup from "../_components/KeyEarnedPopup";

/**
 * A level is finished once every word in it has been answered right at least
 * once. Mastery (`known`, three correct in a row) is the tier above and is
 * earned by coming back to the topic, not by replaying one level three times.
 */
function isLevelCleared(progress: DeckProgressSummary): boolean {
  return progress.total > 0 && progress.cleared >= progress.total;
}

/**
 * Every word in the level learned for good — the point where practice mode has
 * nothing left to serve, so there is no round left to play.
 */
function isLevelLearned(progress: DeckProgressSummary): boolean {
  return progress.total > 0 && progress.known >= progress.total;
}

export default function TopicDetailPage() {
  const params = useParams<{ topicId: string }>();
  const router = useRouter();
  const topicId = params.topicId;

  const { t, language, learningLanguage } = useLanguage();
  const { isReady, isSignedIn } = useAuthState();
  const [fetchedDeckId, setFetchedDeckId] = useState<string | null>(null);
  const [fetchedProgress, setFetchedProgress] = useState<
    DeckProgressSummary[] | null
  >(null);
  const { state, isStale } = useTopicsSnapshot(language);
  const { settled } = useTopicsSync(language, learningLanguage, isSignedIn);
  // The stored ladder is only worth drawing while it is recent. Opened on a
  // laptop after months of playing on a phone it would show that laptop's last
  // word — no levels done, no crown — until the pull lands, so those parts wait
  // for it. If the pull never answers, the stored copy is drawn anyway.
  const awaitingFreshState = isStale && !settled;

  const topic = useMemo(
    () => TOPICS.find((item) => item.id === topicId) ?? null,
    [topicId],
  );

  // Resolve the DB topic deck for (topicKey, foreignLang) so levels can link
  // with a real deck ID and use DB words + spaced-repetition tracking.
  const foreignLang = learningLanguage;

  // Both of those are two round trips away, so until they land the page shows
  // the numbers it left with rather than a set of loading skeletons — coming
  // back from a round used to mean watching the cards fill in all over again.
  const cached = useCachedTopicProgress(topicId, foreignLang);
  const deckId = fetchedDeckId ?? cached?.deckId ?? null;
  const levelProgress = fetchedProgress ?? cached?.levels ?? null;
  const fetchDeckId = useCallback(async () => {
    if (!topic) return;
    try {
      const res = await fetch(
        `/api/decks/topic-lookup?topicKey=${encodeURIComponent(topic.id)}&foreignLang=${encodeURIComponent(foreignLang)}`,
      );
      if (res.ok) {
        const data = (await res.json()) as { deckId: string };
        setFetchedDeckId(data.deckId);
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

  // How many of each level's words have been met, and how many are learned for
  // good. A level used to read "Done" as soon as its cards had been swiped
  // through once; these counts are what the cards report now.
  useEffect(() => {
    if (!deckId || !topic) {
      return;
    }

    let cancelled = false;
    fetchDeckLevelProgress(deckId)
      .then((levels) => {
        if (cancelled) {
          return;
        }
        setFetchedProgress(levels);
        writeTopicProgressCache(topic.id, foreignLang, {
          deckId,
          levels,
          savedAt: Date.now(),
        });
      })
      .catch(() => {
        // Non-critical: the cards fall back to the cache, or to the stored
        // played/not-played flag when there is nothing cached either.
      });

    return () => {
      cancelled = true;
    };
  }, [deckId, topic, foreignLang]);

  // Keys and the crown run off `completedLevels`, so a level the server says is
  // cleared gets recorded here — including one cleared in another browser, which
  // this page would otherwise never hear about. The write syncs straight back up
  // to the account.
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
  const completedAll = !awaitingFreshState && Boolean(topicProgress?.isCompleted);
  const legendary = !awaitingFreshState && Boolean(topicProgress?.isLegendary);
  // The key is granted the moment the fifth level clears, wherever that
  // happened — the popup is only how the player finds out about it. Never off a
  // ladder too old to trust: a key celebrated months ago on another device would
  // pop up again here.
  const showKeyPopup = completedAll && !topicProgress?.keyCelebrated;

  // The word counts are their own cache with its own day-long life, so they are
  // shown whenever they are there; only the fallback to the stored ladder waits.
  const clearedCount = levelProgress
    ? levelProgress.filter(isLevelCleared).length
    : awaitingFreshState
      ? null
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

  const dismissKeyPopup = () => {
    saveTopicsState(language, markKeyCelebrated(state, topic.id));
  };

  // Spending the key is the point of earning one, so the popup can hand the
  // player straight to the pack list — `completedTopic` is what makes the card
  // there celebrate.
  const goSpendKey = () => {
    saveTopicsState(language, markKeyCelebrated(state, topic.id));
    router.push(`/topics?completedTopic=${encodeURIComponent(topic.id)}`);
  };

  // The review round: everything still unlearned, hardest first, topped up to
  // thirty from the rest of the pack. Answering 85% of it right is what makes
  // the pack legendary, and it stays available afterwards — once nothing is
  // unlearned the server serves fifteen random words instead of an empty round.
  const reviewHref = deckId
    ? `/games/flip-cards?deck=${deckId}&mode=finish&topicId=${encodeURIComponent(topic.id)}&legendary=1`
    : null;

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
          <section className="first-section-static-glow rounded-2xl border border-slate-200 bg-white/90 p-6 dark:border-slate-800 dark:bg-slate-950/70 sm:p-8 min-[900px]:py-6">
            <Link
              href="/topics"
              className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 transition hover:text-blue-700 dark:text-blue-300"
            >
              {/* Bigger and bolder than the label it sits next to — at text size
                  the arrow was easy to miss under a 3xl heading. */}
              <ArrowLeft className="h-5 w-5 stroke-[2.5]" />
              {t("topics.back", "Back to topics")}
            </Link>
            {/* The title never fills the box on a wide screen, so the bar sits
                beside it there and takes the empty half. Stacked below on
                anything narrower. The 900px cut is a tablet held sideways —
                Tailwind's `lg` would have left an iPad in landscape stacked. */}
            <div className="mt-4 flex flex-col gap-6 min-[900px]:mt-3 min-[900px]:flex-row min-[900px]:items-center min-[900px]:justify-between min-[900px]:gap-10">
              <div className="min-w-0">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 sm:text-4xl">
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
              </div>

              {/* Both readings of "how far in am I" live together on the right:
                  levels done, then every word of the pack in one bar — solid is
                  learned for good, pale is met at least once, which is what
                  finishes a level. */}
              {/* Out to the side the block stands on its own, so there it
                  becomes a panel with the level count as its headline figure.
                  Untouched when stacked, where it is just two lines under the
                  description. */}
              <div className="w-full max-w-md shrink-0 min-[900px]:w-80 min-[900px]:rounded-2xl min-[900px]:border min-[900px]:border-slate-200 min-[900px]:bg-slate-50/80 min-[900px]:p-4 min-[900px]:dark:border-slate-800 min-[900px]:dark:bg-slate-900/50">
                <p className="flex items-center gap-1 text-sm font-semibold text-slate-500 dark:text-slate-400 min-[900px]:gap-2 min-[900px]:text-xs min-[900px]:uppercase min-[900px]:tracking-[0.18em]">
                  {t("topics.progress", "Progress")}:{" "}
                  <span className="min-[900px]:hidden">
                    {clearedCount === null ? (
                      <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
                    ) : (
                      clearedCount
                    )}
                    /5
                  </span>
                </p>
                <p className="hidden min-[900px]:mt-1 min-[900px]:flex min-[900px]:items-baseline min-[900px]:gap-1">
                  {clearedCount === null ? (
                    <span className="inline-block h-8 w-12 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                  ) : (
                    <span className="text-3xl font-black leading-none text-slate-900 dark:text-slate-100">
                      {clearedCount}
                    </span>
                  )}
                  <span className="text-lg font-bold text-slate-400 dark:text-slate-500">
                    /5
                  </span>
                </p>
                {topicTotals && topicTotals.total > 0 && (
                  <>
                    <p className="mt-3 flex items-baseline justify-between gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
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
                  </>
                )}
              </div>
            </div>
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
              // view or a topic whose deck could not be resolved — and it is not
              // used at all while the ladder behind it is too old to trust, since
              // a level reading "Done" and then reverting is the flicker this
              // whole thing exists to avoid.
              const progress = levelProgress?.[levelData.level - 1] ?? null;
              const unknown = !progress && awaitingFreshState;
              const cleared = progress
                ? isLevelCleared(progress)
                : !unknown && levelData.completed;
              const started = progress
                ? progress.cleared > 0 || levelData.completed
                : false;

              const badgeLabel = cleared
                ? t("topics.done", "Done")
                : progress && started
                  ? `${progress.cleared} / ${progress.total}`
                  : t("topics.pending", "Pending");

              // Finishing a level only means every word was met once, and those
              // words stay in the practice pool until they are learned — so a
              // finished level is still worth replaying. Only once all of them
              // are learned is there no round left to serve, and the button
              // retires rather than opening onto an empty round.
              const learned = progress ? isLevelLearned(progress) : false;

              const playLabel = learned
                ? t("topics.done", "Done")
                : cleared
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
                    {unknown ? (
                      <span
                        aria-busy
                        className="h-6 w-16 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800"
                      />
                    ) : (
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${completedBadgeClass}`}
                      >
                        {badgeLabel}
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {t("topics.mode", "Mode")}:{" "}
                    {levelData.mode === "flip-cards"
                      ? t("games.flipCards")
                      : t("games.oneOfThree")}
                  </p>

                  <div className="mt-4 flex gap-2">
                    {unknown ? (
                      <span
                        aria-busy
                        className="h-9 w-28 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800"
                      />
                    ) : learned ? (
                      <span
                        aria-disabled
                        className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500"
                      >
                        {playLabel}
                      </span>
                    ) : (
                      <Link
                        href={gameHref}
                        className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
                      >
                        {playLabel}
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </section>

          {completedAll && (
            <section
              className={`rounded-2xl border p-6 text-center shadow-sm ${
                legendary
                  ? "border-violet-300 bg-linear-to-br from-violet-50 via-amber-50 to-violet-100/70 dark:border-violet-800 dark:from-violet-950/70 dark:via-slate-950 dark:to-amber-950/40"
                  : "border-amber-300 bg-amber-50/90 dark:border-amber-800 dark:bg-amber-950/60"
              }`}
            >
              {legendary && (
                <span className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-violet-300 bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-violet-700 dark:border-violet-700 dark:bg-slate-950/60 dark:text-violet-300">
                  <Crown size={14} />
                  {t("topics.legendary", "Legendary")}
                </span>
              )}
              <h3
                className={`text-2xl font-bold ${legendary ? "text-violet-800 dark:text-violet-200" : "text-amber-800 dark:text-amber-300"}`}
              >
                {legendary
                  ? t("topics.legendaryTitle", "Legendary pack")
                  : t("topics.completedTitle", "Topic completed")}
              </h3>
              <p
                className={`mt-2 text-sm ${legendary ? "text-violet-700 dark:text-violet-200" : "text-amber-700 dark:text-amber-200"}`}
              >
                {legendary
                  ? t(
                      "topics.legendaryText",
                      "You cleared the review round. Come back any time to keep these words sharp.",
                    )
                  : t(
                      "topics.completedText",
                      "You earned a key. Return to topics to unlock a new pack.",
                    )}
              </p>

              {/* Clearing the ladder only means every word was met once. This is
                  where met turns into learned — and where the pack earns its
                  crown. The button stays after that: the round then refreshes
                  whatever the pack has, rather than disappearing. */}
              {reviewHref && (
                <div className="mt-4 flex flex-col items-center justify-center gap-2">
                  <Link
                    href={reviewHref}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${
                      legendary
                        ? "bg-violet-600 hover:bg-violet-700"
                        : "bg-amber-600 hover:bg-amber-700"
                    }`}
                  >
                    <Crown size={16} />
                    {t("topics.reviewTopic", "Review this topic")}
                  </Link>
                  {!legendary && (
                    <span className="text-center text-xs font-medium text-amber-700 dark:text-amber-300">
                      {t(
                        "topics.legendaryHint",
                        `30 words — score ${LEGENDARY_PASS_PERCENT}% to make this pack legendary.`,
                      )}
                    </span>
                  )}
                </div>
              )}
            </section>
          )}
        </div>

        {showKeyPopup && (
          <KeyEarnedPopup
            topicName={name.learning}
            keys={state.keys}
            onClose={dismissKeyPopup}
            onSpend={goSpendKey}
            reviewHref={reviewHref}
          />
        )}
      </FeatureGate>
    </div>
  );
}
