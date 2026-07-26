import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { userLevelProgress } from "@/db/schema";
import { normalizeLang } from "@/app/_lib/languages";
import { countKnownWordsForLanguage } from "./spacedRepetition";

/**
 * Level is normally "how many words you've mastered", but the level test lets a
 * learner skip ahead without grinding those words out one by one. The skip is
 * stored as a floor rather than by faking word rows, so the two sources stay
 * honest: study still counts, and the floor only ever pulls the number up.
 */
export async function getEffectiveMasteredCount(
  userId: string,
  language: string,
): Promise<{ masteredCount: number; wordFloor: number; knownWords: number }> {
  const canonical = normalizeLang(language) ?? language.toLowerCase();

  const [knownWords, [floorRow]] = await Promise.all([
    countKnownWordsForLanguage(userId, language),
    db
      .select({ wordFloor: userLevelProgress.wordFloor })
      .from(userLevelProgress)
      .where(
        and(
          eq(userLevelProgress.userId, userId),
          eq(userLevelProgress.language, canonical),
        ),
      )
      .limit(1),
  ]);

  const wordFloor = Number(floorRow?.wordFloor ?? 0);

  return {
    masteredCount: Math.max(knownWords, wordFloor),
    wordFloor,
    knownWords,
  };
}

/** Raises the stored floor. Never lowers it — a passed test can't be undone. */
export async function raiseWordFloor(
  userId: string,
  language: string,
  wordFloor: number,
): Promise<number> {
  const canonical = normalizeLang(language) ?? language.toLowerCase();
  const safeFloor = Math.max(0, Math.floor(wordFloor));

  const [row] = await db
    .insert(userLevelProgress)
    .values({ userId, language: canonical, wordFloor: safeFloor })
    .onConflictDoUpdate({
      target: [userLevelProgress.userId, userLevelProgress.language],
      set: {
        wordFloor: sql`greatest(${userLevelProgress.wordFloor}, ${safeFloor})`,
        updatedAt: new Date(),
      },
    })
    .returning({ wordFloor: userLevelProgress.wordFloor });

  return Number(row?.wordFloor ?? safeFloor);
}
