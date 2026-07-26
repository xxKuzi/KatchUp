"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useLanguage } from "@/app/_lib/languageContext";
import KeyEarnedPopup from "@/app/topics/_components/KeyEarnedPopup";
import {
  completeTopicLevel,
  loadTopicsState,
  markKeyCelebrated,
  saveTopicsState,
  TOPICS,
  topicTitle,
  useTopicsSnapshot,
} from "@/app/topics/_lib/topicsProgress";

/**
 * The button the results screen sends the player back to the pack with once the
 * pack is finished. It is the way out of a pack that is done, so it stops
 * looking like the plain dark "Back to topic" and takes the gold the key screen
 * uses — with a sheen running across it so it reads as the thing to press.
 */
export const PACK_COMPLETE_BUTTON_CLASS =
  "relative overflow-hidden rounded-xl bg-linear-to-r from-amber-400 via-orange-400 to-rose-400 px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_30px_rgba(251,146,60,0.45)] transition hover:brightness-110 dark:from-amber-500 dark:via-orange-500 dark:to-rose-500";

interface PackKeyCelebrationProps {
  /** Pack the round belonged to. */
  topicId: string;
  /** Level just cleared — the one that finished the pack. */
  level: number;
  /** The pack's deck, so the popup can offer the review round. */
  deckId: string;
}

/**
 * Hands the key over the moment the pack is finished.
 *
 * The pack page has always been where the key was announced, which meant
 * clearing the fifth level ended on an ordinary results screen and the player
 * only heard about it after navigating back. This is the same popup, shown one
 * screen earlier — it marks the key celebrated on dismiss, so the pack page
 * doesn't announce it a second time.
 */
export default function PackKeyCelebration({
  topicId,
  level,
  deckId,
}: PackKeyCelebrationProps) {
  const router = useRouter();
  const { language, learningLanguage } = useLanguage();
  const { state } = useTopicsSnapshot(language);

  // The pack page records cleared levels off the server's word counts, and it
  // is what the key is derived from — so the level that just finished has to be
  // written here, or the popup would open on a key the ladder doesn't have yet.
  // Idempotent: a level already recorded leaves the state untouched.
  useEffect(() => {
    const stored = loadTopicsState(language);
    const { nextState } = completeTopicLevel(stored, topicId, level);
    if (nextState !== stored) {
      saveTopicsState(language, nextState);
    }
  }, [language, level, topicId]);

  const topicName = useMemo(() => {
    const topic = TOPICS.find((item) => item.id === topicId);
    return topic ? topicTitle(topic, learningLanguage, language).learning : "";
  }, [topicId, learningLanguage, language]);

  const celebrated = () => {
    saveTopicsState(
      language,
      markKeyCelebrated(loadTopicsState(language), topicId),
    );
  };

  // Spending the key is the point of earning one, so the popup can hand the
  // player straight to the pack list — `completedTopic` is what makes the card
  // there celebrate.
  const goSpendKey = () => {
    celebrated();
    router.push(`/topics?completedTopic=${encodeURIComponent(topicId)}`);
  };

  return (
    <KeyEarnedPopup
      topicName={topicName}
      // The pack just finished, so there is a key whatever the ladder says: the
      // count is derived from finished packs, and a sync that landed before the
      // round's last answer reached the server would otherwise say "Keys: 0" on
      // the very screen handing one over. The key itself is the server's to
      // grant — this is only what the popup shows.
      keys={Math.max(state.keys, 1)}
      onClose={celebrated}
      onSpend={goSpendKey}
      reviewHref={
        deckId
          ? `/games/flip-cards?deck=${deckId}&mode=finish&topicId=${encodeURIComponent(
              topicId,
            )}&legendary=1`
          : null
      }
    />
  );
}
