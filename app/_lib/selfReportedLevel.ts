"use client";

import { isCefrLevel, type CefrLevel } from "./languages";

const SELF_REPORT_KEY = "katchup-self-reported-level-v1";

/**
 * The starting points the picker offers, easiest first.
 *
 * Corrections move along *this* list rather than all five CEFR bands, so the
 * value always survives a round trip through the picker: a correction to B2
 * would land on a band the picker has no button for, and reopening it would
 * silently round the choice back to something else.
 */
export const SELF_REPORT_BANDS: readonly CefrLevel[] = ["A1", "A2", "B1", "C1"];

/**
 * How well you have to do to keep the level you claimed. The same bar the
 * lesson itself passes at — a round you passed is not evidence you overstated
 * where you were starting from.
 */
const CLAIM_HELD_PERCENT = 70;

/**
 * At or below this, one band back isn't enough — almost nothing came back right.
 * Kept deliberately low: a bad round is a thin thing to move someone two bands
 * on, and the correction is meant to nudge an overshoot rather than to re-sort
 * the player. Anywhere between here and the pass bar costs a single band.
 */
const CLAIM_BADLY_OFF_PERCENT = 20;

/**
 * What a signed-out visitor said their level was, or null if they never said.
 *
 * Only matters before there's an account: once you sign in, the level comes
 * from the words you've actually mastered and this is ignored.
 */
export function readSelfReportedLevel(): CefrLevel | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(SELF_REPORT_KEY);
  return isCefrLevel(raw) ? raw : null;
}

export function saveSelfReportedLevel(level: CefrLevel): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SELF_REPORT_KEY, level);
}

/**
 * The level a claim is worth once a round has tested it.
 *
 * Players are asked how much of the language they already have, and some of
 * them aim high — the answer costs nothing to give and the flattering one is
 * right there. A round of that level's own vocabulary is the cheapest possible
 * check on it, so a claim the round didn't back up gets walked back one band —
 * and only a round where practically nothing came back right costs two, which
 * is as far as this ever moves anyone.
 *
 * Deliberately one-directional: it never promotes. Acing the round only proves
 * the claim was *at least* right, because the round is built from the claimed
 * level's words and contains nothing harder — so a perfect ten would be
 * evidence of a ceiling nobody tested. Guessing upward from it would strand a
 * beginner in vocabulary they can't read, which is the failure this exists to
 * prevent, pointed the other way.
 */
export function correctSelfReportedLevel(
  claimed: CefrLevel,
  scorePercent: number,
): CefrLevel {
  const claimedIndex = SELF_REPORT_BANDS.indexOf(claimed);

  if (claimedIndex < 0 || scorePercent >= CLAIM_HELD_PERCENT) {
    return claimed;
  }

  const drop = scorePercent <= CLAIM_BADLY_OFF_PERCENT ? 2 : 1;
  return SELF_REPORT_BANDS[Math.max(0, claimedIndex - drop)];
}

export interface SelfReportCorrection {
  claimed: CefrLevel;
  corrected: CefrLevel;
  /** False when the round backed the claim up and nothing moved. */
  changed: boolean;
}

/**
 * Grades the stored claim against a finished round and writes back whatever it
 * turned out to be worth, so the next round — and the picker, when it reopens —
 * starts from the corrected level rather than the claimed one.
 *
 * Returns null when there is no claim on file to correct.
 */
export function applySelfReportCorrection(
  scorePercent: number,
): SelfReportCorrection | null {
  const claimed = readSelfReportedLevel();

  if (!claimed) {
    return null;
  }

  const corrected = correctSelfReportedLevel(claimed, scorePercent);

  if (corrected !== claimed) {
    saveSelfReportedLevel(corrected);
  }

  return { claimed, corrected, changed: corrected !== claimed };
}
