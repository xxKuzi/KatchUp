import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { LANGS, type Lang } from "@/app/_lib/languages";
import { levelProgressFromMasteredCount } from "@/app/_lib/level";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { userLevelProgress, userWordStats } from "@/db/schema";

/**
 * Every language this account could be learning, and where it stands in each.
 *
 * Level has always been per learning language — the word floor and the stats it
 * is read against are both keyed that way — so learning German and Czech at once
 * already worked. What was missing was any way to see it: one pair is active at a
 * time, and the only way to find out where the other stood was to switch to it.
 *
 * `started` is the same question the placement test asks: a language nothing has
 * been earned in yet is one that can still be placed.
 *
 * GET /api/decks/languages
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Run only 2 queries instead of 8 queries
  const [wordStats, progresses] = await Promise.all([
    db
      .select({
        foreignLang: userWordStats.foreignLang,
        count: sql<number>`count(distinct coalesce(${userWordStats.conceptId}::text, ${userWordStats.foreignKey}))::int`,
      })
      .from(userWordStats)
      .where(
        and(
          eq(userWordStats.userId, userId),
          eq(userWordStats.known, true),
        ),
      )
      .groupBy(userWordStats.foreignLang),
    db
      .select({
        language: userLevelProgress.language,
        wordFloor: userLevelProgress.wordFloor,
      })
      .from(userLevelProgress)
      .where(eq(userLevelProgress.userId, userId)),
  ]);

  const statsMap = new Map<string, number>();
  for (const row of wordStats) {
    if (row.foreignLang) {
      statsMap.set(row.foreignLang, row.count);
    }
  }

  const progressMap = new Map<string, { wordFloor: number; placed: boolean }>();
  for (const row of progresses) {
    progressMap.set(row.language, {
      wordFloor: row.wordFloor,
      placed: true,
    });
  }

  const languages = LANGS.map((learning: Lang) => {
    const knownWords = statsMap.get(learning) ?? 0;
    const progressInfo = progressMap.get(learning);
    const wordFloor = progressInfo?.wordFloor ?? 0;
    const placed = progressInfo?.placed ?? false;

    const masteredCount = Math.max(knownWords, wordFloor);
    const progress = levelProgressFromMasteredCount(masteredCount);
    const started = masteredCount > 0 || knownWords > 0;

    return {
      learning,
      level: progress.level,
      band: progress.band.band,
      levelsIntoBand: progress.band.levelsIntoBand,
      masteredCount,
      knownWords,
      // A head start from a placement or a level test, as opposed to words
      // actually learned. Worth distinguishing: it is why a brand-new C1
      // account shows thousands of words and no learned ones.
      wordFloor,
      started,
      // The same question the placement route asks itself, answered here so
      // the client can find out whether a language still owes a test without
      // starting one to be told no. A placement onto A1 leaves `started`
      // false — it is worth no words — so the floor row has to be read too,
      // or that learner is sent back to the same test forever.
      canBePlaced: !placed && !started,
    };
  });

  return NextResponse.json(
    { languages },
    { headers: { "Cache-Control": "no-store" } },
  );
}
