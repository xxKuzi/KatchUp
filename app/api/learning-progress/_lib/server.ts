import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { userWordProgress } from "@/db/schema";
import type { Lang } from "@/app/_lib/languages";

export interface WordProgressUpdate {
  wordId: string;
  isUnlocked: boolean;
  isMastered: boolean;
  streak?: number;
}

export interface WordProgressSnapshot {
  unlockedWordIds: string[];
  masteredWordIds: string[];
  wordStreaks: Record<string, number>;
}

export async function fetchWordProgress(
  userId: string,
  language: Lang,
): Promise<WordProgressSnapshot> {
  const rows = await db
    .select({
      wordId: userWordProgress.wordId,
      isUnlocked: userWordProgress.isUnlocked,
      isMastered: userWordProgress.isMastered,
      streak: userWordProgress.streak,
    })
    .from(userWordProgress)
    .where(
      and(
        eq(userWordProgress.userId, userId),
        eq(userWordProgress.language, language),
      ),
    );

  const wordStreaks: Record<string, number> = {};
  for (const row of rows) {
    wordStreaks[row.wordId] = row.streak;
  }

  return {
    unlockedWordIds: rows
      .filter((row) => row.isUnlocked)
      .map((row) => row.wordId),
    masteredWordIds: rows
      .filter((row) => row.isMastered)
      .map((row) => row.wordId),
    wordStreaks,
  };
}

export async function syncWordProgress(
  userId: string,
  language: Lang,
  updates: WordProgressUpdate[],
): Promise<void> {
  if (updates.length === 0) {
    return;
  }

  const deduped = new Map<string, WordProgressUpdate>();
  for (const update of updates) {
    deduped.set(update.wordId, update);
  }

  await db
    .insert(userWordProgress)
    .values(
      Array.from(deduped.values()).map((update) => ({
        userId,
        language,
        wordId: update.wordId,
        isUnlocked: update.isUnlocked,
        isMastered: update.isMastered,
        streak: update.streak ?? (update.isMastered ? 3 : 0),
      })),
    )
    .onConflictDoUpdate({
      target: [userWordProgress.userId, userWordProgress.wordId],
      set: {
        isUnlocked: sql`excluded.is_unlocked`,
        isMastered: sql`excluded.is_mastered`,
        streak: sql`excluded.streak`,
        updatedAt: sql`now()`,
      },
    });
}
