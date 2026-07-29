"use client";

import { useCallback, useEffect, useState } from "react";
import { readChosenLanguagePair } from "./languageContext";
import { subscribeToOnboardingChanges } from "./onboardingEvents";
import { readStoredPlacement } from "./placement";
import { useSignedIn } from "./useSignedIn";
import type { Lang } from "./languages";

/**
 * What setting up is still owed before anyone can play.
 *
 * Two questions, in order: which pair, and where in it do they start. The first
 * only the learner can answer and the browser is the only place it lives. The
 * second is the placement test, and whether it has been sat is a fact about the
 * account, not about this browser — so for a signed-in player it is asked of the
 * server. Reading it locally would send someone who cleared their storage, or
 * who signed in on a second device, back through a test their account has
 * already recorded and the server would refuse.
 */

export type OnboardingState =
  /** Not known yet — the session or the standing is still in flight. */
  | "loading"
  /** No pair has ever been chosen. */
  | "needsSetup"
  /** Pair chosen, but this language has never been placed. */
  | "needsPlacement"
  /** Nothing owed. */
  | "ready";

export interface OnboardingStatus {
  state: OnboardingState;
  pair: { speak: Lang; learning: Lang } | null;
  signedIn: boolean;
}

export function useOnboardingStatus(): OnboardingStatus {
  const { signedIn, resolving } = useSignedIn();
  const [status, setStatus] = useState<OnboardingStatus>({
    state: "loading",
    pair: null,
    signedIn: false,
  });
  const [token, setToken] = useState(0);

  const reload = useCallback(() => setToken((value) => value + 1), []);

  useEffect(() => subscribeToOnboardingChanges(reload), [reload]);

  useEffect(() => {
    // Acting on a not-yet-known session would put a signed-in player through the
    // visitor's flow for as long as the session takes to resolve — and a session
    // dropped by a failed refocus refetch is exactly that, not-yet-known rather
    // than signed out. See `useSignedIn`.
    if (resolving) {
      setStatus({ state: "loading", pair: null, signedIn: false });
      return;
    }

    const pair = readChosenLanguagePair();

    if (!pair) {
      setStatus({ state: "needsSetup", pair: null, signedIn });
      return;
    }

    if (!signedIn) {
      // A visitor's placement is whatever is sitting in their browser, and it
      // is only good for the language it was sat in: switching to another one
      // is a language nobody has been placed in.
      const stored = readStoredPlacement();
      setStatus({
        state: stored?.learning === pair.learning ? "ready" : "needsPlacement",
        pair,
        signedIn,
      });
      return;
    }

    // A ticket still on file the moment after signing in is a placement on its
    // way onto this account, and the server has not heard about it yet. Asking
    // now would get "never placed" back and throw the prompt over someone who
    // sat the test minutes ago. `usePlacementClaim` spends it and announces it,
    // which brings this round again with an answer worth having.
    if (readStoredPlacement()?.learning === pair.learning) {
      setStatus({ state: "loading", pair, signedIn });
      return;
    }

    let cancelled = false;
    setStatus({ state: "loading", pair, signedIn });

    fetch("/api/decks/languages")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Standing request failed (${res.status})`);
        }
        return res.json() as Promise<{
          languages?: { learning: Lang; canBePlaced?: boolean }[];
        }>;
      })
      .then((body) => {
        if (cancelled) {
          return;
        }

        const standing = body.languages?.find(
          (entry) => entry.learning === pair.learning,
        );

        setStatus({
          state: standing?.canBePlaced === false ? "ready" : "needsPlacement",
          pair,
          signedIn,
        });
      })
      .catch(() => {
        // A failed lookup is not evidence of anything, and this prompt cannot be
        // dismissed — locking a player out of their own account behind a
        // question the server could not answer is the worse of the two failures.
        if (!cancelled) {
          setStatus({ state: "ready", pair, signedIn });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [resolving, signedIn, token]);

  return status;
}
