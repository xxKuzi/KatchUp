"use client";

/**
 * The free round a signed-out visitor gets before being asked to sign up.
 *
 * One of Three rather than Score Rush: it asks a fixed ten questions off the
 * level the visitor just claimed and scores them out of those ten, which is
 * what makes the claim checkable (see `correctSelfReportedLevel`). A timed run
 * scores on speed as much as on knowledge, so a slow-but-right beginner and a
 * fast-but-wrong one come out the same — nothing to grade a claim against.
 *
 * The languages and level are not in the link: the round reads them from the
 * stored choice, the same as every other game, so there is one place they live.
 */
const ONBOARDING_PARAM = "onboarding";

export const ONBOARDING_ROUND_HREF = `/games/one-of-three?${ONBOARDING_PARAM}=1`;

/** Where "Continue playing" goes once the free round is spent. */
export const ONBOARDING_SIGN_UP_HREF = `/login?callbackUrl=${encodeURIComponent(
  "/games/one-of-three",
)}`;

export function isOnboardingRound(params: {
  get: (key: string) => string | null;
}): boolean {
  return params.get(ONBOARDING_PARAM) === "1";
}
