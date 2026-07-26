"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
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

/**
 * How old a stored ladder may be before it stops being worth drawing.
 *
 * Two months of playing on a phone and then opening the site on a laptop that
 * last saw the ladder in spring would paint that spring — no keys, nothing
 * cleared — for the second it takes the account's copy to arrive. A wrong
 * number correcting itself reads worse than a spinner, so past this age the
 * screen waits for the sync instead. The stored copy is still kept and still
 * pushed up; this only decides what is on screen in the meantime.
 */
export const TOPICS_STATE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** What actually sits in localStorage: the ladder plus when it was written. */
interface StoredTopics {
  savedAt: number;
  state: TopicsState;
}

function getStorageKey(language: Lang): string {
  return `${STORAGE_KEY}-${language}`;
}

function parseStored(raw: string | null): StoredTopics | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredTopics> | null;

    if (parsed && typeof parsed.savedAt === "number" && parsed.state) {
      return { savedAt: parsed.savedAt, state: normalizeState(parsed.state) };
    }

    // Written before the envelope existed, so its age is unknown. Anything
    // still carrying the bare shape has been sitting there since before this
    // release — old by definition, so it is dated to the epoch.
    return { savedAt: 0, state: normalizeState(parsed) };
  } catch {
    return null;
  }
}

/**
 * The stored ladder, whatever its age.
 *
 * Age is a rendering question, never a storage one: this is what every write
 * builds on and what the sync pushes up, so a browser that has been offline for
 * a week still gets its progress to the account rather than having it dropped.
 */
export function loadTopicsState(language: Lang): TopicsState {
  if (typeof window === "undefined") {
    return createDefaultState();
  }

  const stored = parseStored(window.localStorage.getItem(getStorageKey(language)));

  if (!stored) {
    const initial = createDefaultState();
    saveTopicsState(language, initial);
    return initial;
  }

  return stored.state;
}

function writeLocal(
  language: Lang,
  state: TopicsState,
  savedAt: number = Date.now(),
): void {
  if (typeof window === "undefined") {
    return;
  }

  const payload: StoredTopics = { savedAt, state };
  window.localStorage.setItem(getStorageKey(language), JSON.stringify(payload));
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
/**
 * The sync in flight per language, so a reply never triggers its own push — and
 * so a second caller awaits the running one instead of starting a second round
 * trip or, worse, resolving before the first has answered.
 */
const inFlight = new Map<Lang, Promise<void>>();
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
export function syncTopicsState(language: Lang): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  const pending = inFlight.get(language);
  if (pending) {
    return pending;
  }

  const run = (async () => {
    const local = loadTopicsState(language);
    const server = await exchange(language, local);

    if (!server) {
      // Signed out, offline, or a hiccup: the local copy stands, however old it
      // is, and the next write tries again.
      return;
    }

    if (JSON.stringify(server) !== JSON.stringify(local)) {
      writeLocal(language, server);
      return;
    }

    // Same ladder, but the account has just vouched for it — restamping is what
    // stops a copy that happens to be correct from being treated as too old to
    // draw. The write is skipped when the stamp is already recent, so a sync on
    // a quiet page doesn't wake every subscriber for nothing.
    const stored = parseStored(
      window.localStorage.getItem(getStorageKey(language)),
    );
    if (!stored || Date.now() - stored.savedAt > STAMP_REFRESH_MS) {
      writeLocal(language, local);
    }
  })();

  const tracked = run.finally(() => {
    inFlight.delete(language);
  });
  inFlight.set(language, tracked);

  return tracked;
}

/**
 * How stale a stamp may get before a confirming sync rewrites it. Well under
 * `TOPICS_STATE_MAX_AGE_MS`, so a tab left open overnight is restamped long
 * before it would start reading as too old, without writing on every sync.
 */
const STAMP_REFRESH_MS = 60 * 60 * 1000;

function schedulePush(language: Lang): void {
  if (typeof window === "undefined" || inFlight.has(language)) {
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
): {
  /**
   * True once the first pull has come back — or failed, or was never going to
   * run. Screens waiting on a too-old local copy show it again at that point:
   * offline, month-old numbers still beat a spinner that never stops.
   */
  settled: boolean;
} {
  // Which pull has come back, rather than a bare flag: switching language starts
  // a new one, and `settled` then reads false again without an effect having to
  // reset it.
  const pullKey = `${language}:${foreignLang}`;
  const [settledKey, setSettledKey] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    lastForeignLang = foreignLang;
    void syncTopicsState(language).finally(() => {
      if (!cancelled) {
        setSettledKey(pullKey);
      }
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void syncTopicsState(language);
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, foreignLang, language, pullKey]);

  // Nothing to wait for when the sync is off — signed out, the local copy is
  // the only copy there will ever be.
  return { settled: !enabled || settledKey === pullKey };
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

interface TopicsSnapshot {
  state: TopicsState;
  /**
   * True when the stored copy is older than `TOPICS_STATE_MAX_AGE_MS` — the
   * screen should wait for the account's copy rather than draw this one.
   *
   * Decided when the raw string is parsed, so it does not flip on its own in a
   * tab left open past the cut-off. The sync restamps such a tab well before
   * then, and a page that has been open that long is being re-read anyway.
   */
  isStale: boolean;
}

/** The parsed state, memoised per raw string so the snapshot is referentially
 * stable — returning a fresh object each read would loop forever. */
let snapshotCache: {
  key: string;
  raw: string | null;
  value: TopicsSnapshot;
} | null = null;

const SERVER_SNAPSHOT: TopicsSnapshot = {
  state: createDefaultState(),
  // The server has no storage to judge; hydration renders defaults either way,
  // and the real answer arrives with the first client snapshot.
  isStale: false,
};

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab writing the same key counts as a change too.
  window.addEventListener("storage", listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getSnapshot(language: Lang): TopicsSnapshot {
  const key = getStorageKey(language);
  const raw = window.localStorage.getItem(key);

  if (snapshotCache && snapshotCache.key === key && snapshotCache.raw === raw) {
    return snapshotCache.value;
  }

  const stored = parseStored(raw);
  const value: TopicsSnapshot = stored
    ? {
        state: stored.state,
        isStale: Date.now() - stored.savedAt > TOPICS_STATE_MAX_AGE_MS,
      }
    : { state: createDefaultState(), isStale: false };

  snapshotCache = { key, raw, value };
  return value;
}

/** Topic progress for `language`, kept in sync with every write to it. */
export function useTopicsSnapshot(language: Lang): TopicsSnapshot {
  return useSyncExternalStore(
    subscribe,
    () => getSnapshot(language),
    () => SERVER_SNAPSHOT,
  );
}

/** Just the ladder, for the screens that don't care how old it is. */
export function useTopicsState(language: Lang): TopicsState {
  return useTopicsSnapshot(language).state;
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
