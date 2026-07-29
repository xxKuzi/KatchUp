"use client";

import { useState } from "react";
import { useSession } from "@/lib/auth-client";

/**
 * Whether there is an account behind this page, with one loss ignored.
 *
 * The session is refetched every time the tab comes back into view, and that
 * request runs at the worst possible moment: a phone waking up, a laptop coming
 * off sleep, the network not yet back. When it fails the client has no session
 * to show and reports "unauthenticated", which is indistinguishable from having
 * signed out — and the onboarding prompt believed it, so a signed-in player
 * returning to the app was met with the setup dialog and no way past it.
 *
 * So a drop after a session has once resolved is read as not knowing rather
 * than as a visitor. That cannot strand anyone: signing out for real is
 * `signOut({ callbackUrl: "/" })`, a full page load, which takes this memory
 * with it.
 */
export interface SignedInState {
  /** An account is known to be behind this page. */
  signedIn: boolean;
  /** Not known either way yet — decide nothing on this. */
  resolving: boolean;
}

export function useSignedIn(): SignedInState {
  const { data: session, status } = useSession();
  const [wasSignedIn, setWasSignedIn] = useState(false);
  const authenticated = status === "authenticated" && Boolean(session?.user?.id);

  // Recorded during render rather than in an effect: the very next render is
  // where it may be needed, and a render with the answer still missing is the
  // one that would show the setup dialog over a signed-in player.
  if (authenticated && !wasSignedIn) {
    setWasSignedIn(true);
  }

  if (authenticated) {
    return { signedIn: true, resolving: false };
  }

  if (status === "loading") {
    return { signedIn: false, resolving: true };
  }

  return { signedIn: false, resolving: wasSignedIn };
}
