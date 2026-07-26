"use client";

import { useSyncExternalStore } from "react";
import type { Lang } from "@/app/_lib/languages";
import type { DeckProgressSummary } from "@/app/games/_lib/deckSessionClient";

/**
 * Last-seen deck id and level counts for a topic, kept in localStorage.
 *
 * The topic page needs two round trips before it can draw a level card — resolve
 * the deck, then read its counts — so coming back from a round meant watching
 * the cards load in all over again. This paints the numbers you left with, then
 * the fetch overwrites them. The server stays the source of truth; the cache
 * only decides what is on screen for the first few hundred milliseconds.
 */
export interface CachedTopicProgress {
  deckId: string;
  levels: DeckProgressSummary[];
}

const CACHE_KEY = "katchup-topic-level-progress-v1";

function getKey(topicId: string, foreignLang: Lang): string {
  return `${CACHE_KEY}:${topicId}:${foreignLang}`;
}

function isSummary(value: unknown): value is DeckProgressSummary {
  const summary = value as Partial<DeckProgressSummary> | null;
  return (
    typeof summary?.total === "number" &&
    typeof summary.known === "number" &&
    typeof summary.cleared === "number"
  );
}

function parse(raw: string | null): CachedTopicProgress | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<CachedTopicProgress>;
    // A cache written before `cleared` existed would render every level as
    // untouched, so anything not matching the current shape is ignored.
    if (
      typeof parsed.deckId !== "string" ||
      !Array.isArray(parsed.levels) ||
      !parsed.levels.every(isSummary)
    ) {
      return null;
    }

    return { deckId: parsed.deckId, levels: parsed.levels };
  } catch {
    return null;
  }
}

export function writeTopicProgressCache(
  topicId: string,
  foreignLang: Lang,
  value: CachedTopicProgress,
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      getKey(topicId, foreignLang),
      JSON.stringify(value),
    );
  } catch {
    // A full or blocked storage only costs the head start, so carry on.
  }

  listeners.forEach((listener) => listener());
}

// --- Reading the cache during render ------------------------------------------
//
// Read straight into render and the server would send "no cache" while the
// client rendered the stored numbers — a hydration mismatch. Reading it in an
// effect instead costs a frame of empty cards, which is the flash this cache
// exists to remove. useSyncExternalStore is the supported way out, and is how
// `topicsProgress` reads its own localStorage.

const listeners = new Set<() => void>();

/** Parsed per raw string: a fresh object each read would loop forever. */
let snapshotCache: {
  key: string;
  raw: string | null;
  value: CachedTopicProgress | null;
} | null = null;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getSnapshot(key: string): CachedTopicProgress | null {
  const raw = window.localStorage.getItem(key);

  if (snapshotCache && snapshotCache.key === key && snapshotCache.raw === raw) {
    return snapshotCache.value;
  }

  const value = parse(raw);
  snapshotCache = { key, raw, value };
  return value;
}

/** What this topic showed last time, or null on a first visit. */
export function useCachedTopicProgress(
  topicId: string,
  foreignLang: Lang,
): CachedTopicProgress | null {
  const key = getKey(topicId, foreignLang);

  return useSyncExternalStore(
    subscribe,
    () => getSnapshot(key),
    () => null,
  );
}
