import type { Lang } from "@/app/_lib/languages";
import { getEffectiveMasteredCount } from "@/app/api/decks/_lib/levelProgress";
import { hasAnyWordStatsForLanguage } from "@/app/api/decks/_lib/spacedRepetition";

/**
 * Whether this account may still be placed in this language. Read before the
 * result is recorded, since recording it is what closes it.
 *
 * Asked of the floor row's existence rather than its value: a placement onto A1
 * is worth no head start at all, and a test that left nothing behind would be
 * one the learner is handed again every time they open the app.
 */
export async function placementOpen(
  userId: string,
  learning: Lang,
): Promise<boolean> {
  const { placed } = await getEffectiveMasteredCount(userId, learning);

  if (placed) {
    return false;
  }

  return !(await hasAnyWordStatsForLanguage(userId, learning));
}
