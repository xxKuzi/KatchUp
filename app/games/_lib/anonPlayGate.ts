"use client";

const ANON_PLAYS_KEY = "katchup-anon-score-rush-plays-v1";

export const ANON_FREE_PLAYS = 1;

export function getAnonPlaysUsed(): number {
  if (typeof window === "undefined") {
    return 0;
  }

  const raw = window.localStorage.getItem(ANON_PLAYS_KEY);
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) ? value : 0;
}

export function hasAnonPlaysRemaining(): boolean {
  return getAnonPlaysUsed() < ANON_FREE_PLAYS;
}

export function recordAnonPlayUsed(): number {
  if (typeof window === "undefined") {
    return 0;
  }

  const next = getAnonPlaysUsed() + 1;
  window.localStorage.setItem(ANON_PLAYS_KEY, String(next));
  return next;
}
