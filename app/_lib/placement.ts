"use client";

import { isCefrLevel, normalizeLang, type CefrLevel, type Lang } from "./languages";

/**
 * A placement test sat before there was an account to put it on.
 *
 * Kept here only until the visitor signs in, at which point the ticket is spent
 * against `/api/decks/level/placement/claim` and this is cleared. The band and
 * level in it are for showing back to the learner; the ticket is the only part
 * the server will take, since it is the only part the browser cannot have
 * written itself.
 */

const PLACEMENT_KEY = "katchup-placement-v1";

export interface StoredPlacement {
  learning: Lang;
  band: CefrLevel;
  level: number;
  /** The server's signed verdict, redeemed once an account exists. */
  ticket: string;
}

export function readStoredPlacement(): StoredPlacement | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(PLACEMENT_KEY);

  if (!raw) {
    return null;
  }

  try {
    const data = JSON.parse(raw) as Partial<StoredPlacement>;
    const learning = normalizeLang(data.learning);
    const level = Number(data.level);

    if (
      !learning ||
      !isCefrLevel(data.band) ||
      typeof data.ticket !== "string" ||
      !Number.isFinite(level)
    ) {
      return null;
    }

    return { learning, band: data.band, level, ticket: data.ticket };
  } catch {
    return null;
  }
}

export function saveStoredPlacement(placement: StoredPlacement): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PLACEMENT_KEY, JSON.stringify(placement));
}

export function clearStoredPlacement(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(PLACEMENT_KEY);
}
