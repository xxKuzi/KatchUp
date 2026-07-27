import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { LANGS, type Lang } from "@/app/_lib/languages";
import { levelProgressFromMasteredCount } from "@/app/_lib/level";
import { getEffectiveMasteredCount } from "../_lib/levelProgress";

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

  const languages = await Promise.all(
    LANGS.map(async (learning: Lang) => {
      const { masteredCount, knownWords, wordFloor } =
        await getEffectiveMasteredCount(userId, learning);
      const progress = levelProgressFromMasteredCount(masteredCount);

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
        started: masteredCount > 0 || knownWords > 0,
      };
    }),
  );

  return NextResponse.json(
    { languages },
    { headers: { "Cache-Control": "no-store" } },
  );
}
