"use client";

/**
 * Broadcast whenever something that decides what setting up still owes has
 * changed: the pair was chosen or switched, the placement test was sat, or a
 * visitor's ticket was spent on an account.
 *
 * A module of its own so the pieces that fire it — the language context among
 * them — do not have to import the hook that listens, which imports them back.
 */
const ONBOARDING_CHANGED_EVENT = "katchup:onboarding-changed";

export function notifyOnboardingChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ONBOARDING_CHANGED_EVENT));
  }
}

export function subscribeToOnboardingChanges(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(ONBOARDING_CHANGED_EVENT, listener);
  return () => window.removeEventListener(ONBOARDING_CHANGED_EVENT, listener);
}
