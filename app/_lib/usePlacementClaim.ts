"use client";

import { useEffect, useRef } from "react";
import { useSession } from "@/lib/auth-client";
import { notifyOnboardingChanged } from "./onboardingEvents";
import { clearStoredPlacement, readStoredPlacement } from "./placement";
import { notifyLevelChanged } from "./useLearningLevel";

/**
 * Spends a placement sat before signing up on the account that now exists.
 *
 * Runs on the first render after the session resolves to signed-in, wherever in
 * the app that happens — the ticket is the only thing a visitor's test left
 * behind, and losing it would mean asking a new player to sit the same test
 * twice, once for nothing.
 *
 * The ticket is dropped once the attempt settles, however it settles. A rejected
 * one is a ticket the account is already past, and keeping it would mean
 * retrying it on every page load forever; a failed request is worth no more,
 * because a ticket nobody can spend is one the rest of the app is waiting on.
 * Losing one costs a retake, and the retake is still there — nothing was
 * recorded against the account, so the placement never closed.
 */
export function usePlacementClaim(): void {
  const { data: session, status } = useSession();
  const claiming = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id || claiming.current) {
      return;
    }

    const stored = readStoredPlacement();

    if (!stored) {
      return;
    }

    claiming.current = true;

    fetch("/api/decks/level/placement/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket: stored.ticket }),
    })
      .catch(() => {
        // Nothing to do differently: the ticket goes either way, and what the
        // account is actually standing on gets re-read below.
      })
      .finally(() => {
        clearStoredPlacement();
        claiming.current = false;
        notifyOnboardingChanged();
        notifyLevelChanged();
      });
  }, [status, session?.user?.id]);
}
