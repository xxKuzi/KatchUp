"use client";

import type { DeckMeta } from "./deckSessionClient";

/**
 * A local mirror of the deck list, per language pair.
 *
 * /my-decks used to sit on "Loading…" on every visit, including the ones where
 * nothing had changed since the last. The list is small and cheap to keep, so
 * the page paints from here first and the request that follows only corrects
 * it — counts move as you practise, so the copy is shown, never trusted.
 */

const CACHE_KEY = "katchup-deck-list-v1";

/** Past this the copy is too old to be worth showing before the real list. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry {
  savedAt: number;
  decks: DeckMeta[];
}

type Cache = Record<string, CacheEntry>;

function pairKey(nativeLang: string, foreignLang: string): string {
  return `${nativeLang.trim().toLowerCase()}->${foreignLang.trim().toLowerCase()}`;
}

function readCache(): Cache {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const stored = window.localStorage.getItem(CACHE_KEY);
    const parsed = stored ? (JSON.parse(stored) as Cache) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeCache(cache: Cache): void {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // A blocked or full localStorage just means no cache this time.
  }
}

/** The last list seen for this pair, or null if there isn't a usable one. */
export function readCachedDecks(
  nativeLang: string,
  foreignLang: string,
): DeckMeta[] | null {
  const entry = readCache()[pairKey(nativeLang, foreignLang)];
  if (!entry || !Array.isArray(entry.decks)) {
    return null;
  }
  if (Date.now() - entry.savedAt > MAX_AGE_MS) {
    return null;
  }
  return entry.decks;
}

export function writeCachedDecks(
  nativeLang: string,
  foreignLang: string,
  decks: DeckMeta[],
): void {
  if (typeof window === "undefined") {
    return;
  }
  const cache = readCache();
  cache[pairKey(nativeLang, foreignLang)] = { savedAt: Date.now(), decks };
  writeCache(cache);
}

/**
 * Drops every pair's copy. Called when a deck is created, edited or deleted,
 * and when a request comes back unauthorized — one account's decks must never
 * paint for the next one.
 */
export function clearCachedDecks(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    // Nothing to recover: the entries age out on their own.
  }
}
