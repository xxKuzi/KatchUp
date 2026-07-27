"use client";

import type { CefrLevel, Lang } from "@/app/_lib/languages";
import { getPlayerProfile } from "../live-duel/_lib/playerProfile";

/**
 * The link into a Score Rush run.
 *
 * Two places start a run — the setup modal, and the shortcut that skips it for
 * players who have already answered its questions — and the run only picks up
 * the right words and the right name on the leaderboard if both spell the
 * params the same way.
 */
export function scoreRushHref({
  speak,
  learning,
  level,
}: {
  speak: Lang;
  learning: Lang;
  level: CefrLevel;
}): string {
  const profile = getPlayerProfile();
  const params = new URLSearchParams({
    speak,
    learning,
    level,
    playerId: profile.id,
    playerName: profile.name,
    playerAvatar: profile.avatar,
  });

  return `/games/score-rush/play?${params.toString()}`;
}
