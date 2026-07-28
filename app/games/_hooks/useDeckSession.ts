"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  DeckSession,
  fetchSession,
  postAttempts,
  setWordKnown,
} from "../_lib/deckSessionClient";
import { useAccountKey } from "@/app/_lib/offline/useOffline";
import {
  isOfflineStorageAvailable,
  queueAttempt,
  queueKnown,
  readOfflineSession,
} from "@/app/_lib/offline/offlineDecks";
import { flushSync, scheduleSync } from "@/app/_lib/offline/outbox";

export type DeckSessionStatus =
  | "idle"
  | "loading"
  | "ready"
  | "unauthorized"
  | "notfound"
  | "empty"
  | "error";

export interface UseDeckSession {
  status: DeckSessionStatus;
  session: DeckSession | null;
  error: string | null;
  /** True when this round was built from a deck downloaded to this device. */
  offline: boolean;
  /**
   * Records one answer. The answer is written to a durable local queue first and
   * delivered to the server shortly after, so a dropped connection — or a tab
   * closed on one — no longer loses it. `steps` weights how far a correct answer
   * moves the streak toward known; 1 by default.
   */
  recordResult: (deckWordId: string, correct: boolean, steps?: number) => void;
  /** Marks a word known/unknown immediately. */
  markKnown: (deckWordId: string, known?: boolean) => void;
  /** Pushes everything queued now — for the end of a round. */
  flush: () => void;
  /** Reload the session (e.g. to start a fresh round or switch mode). */
  reload: () => void;
}

/**
 * Loads a spaced-repetition session for a deck and streams answer results back
 * to the server. Pass deckId = null to stay idle (e.g. non-deck game modes).
 *
 * A deck downloaded for offline use is served from this device, whether or not
 * there is a network: the rounds are chosen by the same shared module the server
 * uses, off a local copy of the same stats. Everything else goes to the API.
 */
export function useDeckSession(
  deckId: string | null,
  mode: "practice" | "finish" = "practice",
  /** Topic level to scope the round to; omit for the whole deck. */
  level?: number,
  /** How many words to draw; omit for the mode's default. */
  size?: number,
): UseDeckSession {
  const [status, setStatus] = useState<DeckSessionStatus>(
    deckId ? "loading" : "idle",
  );
  const [session, setSession] = useState<DeckSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [nonce, setNonce] = useState(0);

  const accountKey = useAccountKey();

  // Track pending writes so we don't fire before the deck is confirmed.
  const deckIdRef = useRef<string | null>(deckId);
  useEffect(() => {
    deckIdRef.current = deckId;
  }, [deckId]);

  const accountKeyRef = useRef<string | null>(accountKey);
  useEffect(() => {
    accountKeyRef.current = accountKey;
  }, [accountKey]);

  useEffect(() => {
    // deckId is derived from the URL and stable per game session; the idle
    // state is set via the initial useState value, not here.
    if (!deckId) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      // The downloaded copy first and unconditionally. Preferring the network
      // when one happens to be up would mean the same deck served different
      // rounds depending on the signal, and would silently drop the local stats
      // an unsynced round has already moved.
      if (accountKey && isOfflineStorageAvailable()) {
        try {
          const local = await readOfflineSession(accountKey, deckId, {
            mode,
            level,
            size,
          });
          if (cancelled) {
            return;
          }
          if (local) {
            setOffline(true);
            setSession(local);
            setStatus(local.words.length === 0 ? "empty" : "ready");
            return;
          }
        } catch {
          // Unreadable local copy: fall through to the network.
        }
      }

      setOffline(false);
      try {
        const result = await fetchSession(deckId, { mode, level, size });
        if (cancelled) return;
        setSession(result);
        setStatus(result.words.length === 0 ? "empty" : "ready");
      } catch (err: unknown) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setStatus("unauthorized");
        } else if (err instanceof ApiError && err.status === 404) {
          setStatus("notfound");
        } else {
          setStatus("error");
          setError(err instanceof Error ? err.message : "Failed to load deck");
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [accountKey, deckId, mode, level, size, nonce]);

  const recordResult = useCallback(
    (deckWordId: string, correct: boolean, steps?: number) => {
      const id = deckIdRef.current;
      if (!id) return;

      const account = accountKeyRef.current;
      if (account && isOfflineStorageAvailable()) {
        // Durable first, network second. The drain is debounced so a round of
        // ten answers goes out as roughly one request.
        void queueAttempt(account, id, deckWordId, correct, steps)
          .then(() => scheduleSync(account))
          .catch(() => {
            // Storage refused the write; better a lost answer than a lost round.
            void postAttempts(id, [{ deckWordId, correct, steps }]).catch(
              () => {},
            );
          });
        return;
      }

      // Signed out, or a browser with no IndexedDB. Nothing durable is possible.
      void postAttempts(id, [{ deckWordId, correct, steps }]).catch(() => {});
    },
    [],
  );

  const markKnown = useCallback((deckWordId: string, known = true) => {
    const id = deckIdRef.current;
    if (!id) return;

    const account = accountKeyRef.current;
    if (account && isOfflineStorageAvailable()) {
      void queueKnown(account, id, deckWordId, known)
        .then(() => scheduleSync(account))
        .catch(() => {
          void setWordKnown(id, deckWordId, known).catch(() => {});
        });
      return;
    }

    void setWordKnown(id, deckWordId, known).catch(() => {});
  }, []);

  const flush = useCallback(() => {
    const account = accountKeyRef.current;
    if (account && isOfflineStorageAvailable()) {
      void flushSync(account).catch(() => {});
    }
  }, []);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return {
    status,
    session,
    error,
    offline,
    recordResult,
    markKnown,
    flush,
    reload,
  };
}
