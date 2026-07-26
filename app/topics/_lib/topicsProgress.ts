"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Lang } from "@/app/_lib/languages";
import {
  createDefaultState,
  normalizeState,
  type TopicsState,
} from "./topicsModel";

// The ladder's rules live in `topicsModel`, which the API route shares. This
// file is the browser side of it: a localStorage copy that renders instantly and
// works offline, kept in step with the account's copy in Postgres.
export * from "./topicsModel";

const STORAGE_KEY = "katchup-topics-state-v1";

function getStorageKey(language: Lang): string {
  return `${STORAGE_KEY}-${language}`;
}

export function loadTopicsState(language: Lang): TopicsState {
  if (typeof window === "undefined") {
    return createDefaultState();
  }

  const raw = window.localStorage.getItem(getStorageKey(language));

  if (!raw) {
    const initial = createDefaultState();
    saveTopicsState(language, initial);
    return initial;
  }

  try {
    return normalizeState(JSON.parse(raw) as unknown);
  } catch {
    const initial = createDefaultState();
    saveTopicsState(language, initial);
    return initial;
  }
}

function writeLocal(language: Lang, state: TopicsState): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getStorageKey(language), JSON.stringify(state));
  listeners.forEach((listener) => listener());
}

export function saveTopicsState(language: Lang, state: TopicsState): void {
  writeLocal(language, state);
  // The screen has already moved on; the account catches up a moment later.
  schedulePush(language);
}

// --- Keeping the account's copy in step ---------------------------------------
//
// Progress used to live only in localStorage, so signing in on another device
// showed a brand new player: no keys, no unlocked packs, no crowns. It lives in
// `user_topic_progress` now, and the account is the authority: cleared levels are
// counted from the word stats, the crown comes off a graded round, and this copy
// is the fast local mirror of both. What a browser still owns — which packs it
// spent keys on, whether the key popup has been seen — rides up on each write.

const PUSH_DELAY_MS = 400;
const pushTimers = new Map<Lang, number>();
/** Languages whose sync is in flight, so a reply never triggers its own push. */
const syncing = new Set<Lang>();
/**
 * The language being learned, remembered from the last screen that knew it.
 * The server needs it to find the packs' decks and count cleared levels; a push
 * from a game round only knows the UI language, so it rides along from here.
 */
let lastForeignLang: Lang | null = null;

async function exchange(
  language: Lang,
  state: TopicsState,
): Promise<TopicsState | null> {
  try {
    const res = await fetch("/api/topics/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, foreignLang: lastForeignLang, state }),
    });

    if (!res.ok) {
      // Signed out, offline, or a server hiccup: the local copy stands and the
      // next write tries again.
      return null;
    }

    const data = (await res.json()) as { state: unknown };
    return normalizeState(data.state);
  } catch {
    return null;
  }
}

/**
 * Sends the local ladder up and takes the account's back down. Safe to call as
 * often as you like — it is the same call whether it's the first load of the day
 * or the write after a single swipe.
 *
 * What comes back **replaces** what is here rather than being merged into it.
 * The reply is already the account's view of everything this browser reported,
 * and only the account can say whether a pack is finished or crowned — merging
 * would let a stale local crown climb back up after one was taken away.
 */
export async function syncTopicsState(language: Lang): Promise<void> {
  if (typeof window === "undefined" || syncing.has(language)) {
    return;
  }

  syncing.add(language);
  try {
    const local = loadTopicsState(language);
    const server = await exchange(language, local);

    // Only touch storage when something actually differs, so a sync on a quiet
    // page doesn't wake every subscriber for nothing.
    if (server && JSON.stringify(server) !== JSON.stringify(local)) {
      writeLocal(language, server);
    }
  } finally {
    syncing.delete(language);
  }
}

function schedulePush(language: Lang): void {
  if (typeof window === "undefined" || syncing.has(language)) {
    return;
  }

  const pending = pushTimers.get(language);
  if (pending) {
    window.clearTimeout(pending);
  }

  // Debounced: finishing a level writes progress a few times in a row, and one
  // request at the end of that carries all of it.
  pushTimers.set(
    language,
    window.setTimeout(() => {
      pushTimers.delete(language);
      void syncTopicsState(language);
    }, PUSH_DELAY_MS),
  );
}

/**
 * Pulls the account's ladder into this browser on mount, and again whenever the
 * tab comes back to the foreground — the cheap way to notice a level cleared on
 * a phone while this page sat open.
 */
export function useTopicsSync(
  language: Lang,
  /** The language being learned — resolves the packs' decks server-side. */
  foreignLang: Lang,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    lastForeignLang = foreignLang;
    void syncTopicsState(language);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void syncTopicsState(language);
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [enabled, foreignLang, language]);
}

/**
 * Submits a finished review round for grading and returns whether it took the
 * crown. The verdicts are counted on the server against the pack's own words —
 * the browser reports what happened, it does not decide the outcome.
 */
export async function submitLegendaryRound(input: {
  language: Lang;
  foreignLang: Lang;
  topicId: string;
  results: { deckWordId: string; correct: boolean }[];
}): Promise<boolean> {
  try {
    const res = await fetch("/api/topics/legendary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      return false;
    }

    const data = (await res.json()) as { passed: boolean; state: unknown };
    writeLocal(input.language, normalizeState(data.state));
    return data.passed;
  } catch {
    // Offline: the round still counted toward the words, and the crown can be
    // taken on the next one.
    return false;
  }
}

// --- Reading the state during render -----------------------------------------
//
// Progress lives in localStorage, which the server can't see, so reading it
// straight into render made the server send `keys: 0` while the client rendered
// the real number — a hydration mismatch. useSyncExternalStore is the supported
// way out: React renders the server snapshot (defaults) through hydration, then
// swaps in the stored one, and every write notifies each subscriber so two topic
// views never drift apart.

const listeners = new Set<() => void>();

/** The parsed state, memoised per raw string so the snapshot is referentially
 * stable — returning a fresh object each read would loop forever. */
let snapshotCache: { key: string; raw: string | null; value: TopicsState } | null =
  null;

const SERVER_SNAPSHOT = createDefaultState();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab writing the same key counts as a change too.
  window.addEventListener("storage", listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getSnapshot(language: Lang): TopicsState {
  const key = getStorageKey(language);
  const raw = window.localStorage.getItem(key);

  if (snapshotCache && snapshotCache.key === key && snapshotCache.raw === raw) {
    return snapshotCache.value;
  }

  let value: TopicsState;
  try {
    value = raw ? normalizeState(JSON.parse(raw) as unknown) : createDefaultState();
  } catch {
    value = createDefaultState();
  }

  snapshotCache = { key, raw, value };
  return value;
}

/** Topic progress for `language`, kept in sync with every write to it. */
export function useTopicsState(language: Lang): TopicsState {
  return useSyncExternalStore(
    subscribe,
    () => getSnapshot(language),
    () => SERVER_SNAPSHOT,
  );
}

/**
 * True once the client has taken over.
 *
 * For the handful of bits that can only be known in the browser (a query param
 * read at mount, say) — render them behind this so the hydration pass still
 * matches the server.
 */
export function useHasMounted(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

function subscribeNever(): () => void {
  return () => {};
}
