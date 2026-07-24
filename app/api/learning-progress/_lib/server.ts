import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { userWordProgress } from "@/db/schema";
import { SupportedLanguage } from "@/app/games/_lib/learning/types";

export interface WordProgressUpdate {
  wordId: string;
  isUnlocked: boolean;
  isMastered: boolean;
}

export interface WordProgressSnapshot {
  unlockedWordIds: string[];
  masteredWordIds: string[];
}

export async function fetchWordProgress(
  userId: string,
  language: SupportedLanguage,
): Promise<WordProgressSnapshot> {
  const rows = await db
    .select({
      wordId: userWordProgress.wordId,
      isUnlocked: userWordProgress.isUnlocked,
      isMastered: userWordProgress.isMastered,
    })
    .from(userWordProgress)
    .where(
      and(
        eq(userWordProgress.userId, userId),
        eq(userWordProgress.language, language),
      ),
    );

  return {
    unlockedWordIds: rows
      .filter((row) => row.isUnlocked)
      .map((row) => row.wordId),
    masteredWordIds: rows
      .filter((row) => row.isMastered)
      .map((row) => row.wordId),
  };
}

export async function syncWordProgress(
  userId: string,
  language: SupportedLanguage,
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
      })),
    )
    .onConflictDoUpdate({
      target: [userWordProgress.userId, userWordProgress.wordId],
      set: {
        isUnlocked: sql`excluded.is_unlocked`,
        isMastered: sql`excluded.is_mastered`,
        updatedAt: sql`now()`,
      },
    });
}
