"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  DeckSession,
  fetchSession,
  postAttempts,
  setWordKnown,
} from "../_lib/deckSessionClient";

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
  /**
   * Records one answer (fire-and-forget upsert to the server). `steps` weights
   * how far a correct answer moves the streak toward known; 1 by default.
   */
  recordResult: (deckWordId: string, correct: boolean, steps?: number) => void;
  /** Marks a word known/unknown immediately. */
  markKnown: (deckWordId: string, known?: boolean) => void;
  /** Reload the session (e.g. to start a fresh round or switch mode). */
  reload: () => void;
}

/**
 * Loads a spaced-repetition session for a deck and streams answer results back
 * to the server. Pass deckId = null to stay idle (e.g. non-deck game modes).
 */
export function useDeckSession(
  deckId: string | null,
  mode: "practice" | "finish" = "practice",
  /** Topic level to scope the round to; omit for the whole deck. */
  level?: number,
): UseDeckSession {
  const [status, setStatus] = useState<DeckSessionStatus>(
    deckId ? "loading" : "idle",
  );
  const [session, setSession] = useState<DeckSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // Track pending writes so we don't fire before the deck is confirmed.
  const deckIdRef = useRef<string | null>(deckId);
  useEffect(() => {
    deckIdRef.current = deckId;
  }, [deckId]);

  useEffect(() => {
    // deckId is derived from the URL and stable per game session; the idle
    // state is set via the initial useState value, not here.
    if (!deckId) {
      return;
    }

    let cancelled = false;

    fetchSession(deckId, { mode, level })
      .then((result) => {
        if (cancelled) return;
        setSession(result);
        setStatus(result.words.length === 0 ? "empty" : "ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setStatus("unauthorized");
        } else if (err instanceof ApiError && err.status === 404) {
          setStatus("notfound");
        } else {
          setStatus("error");
          setError(err instanceof Error ? err.message : "Failed to load deck");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [deckId, mode, level, nonce]);

  const recordResult = useCallback(
    (deckWordId: string, correct: boolean, steps?: number) => {
      const id = deckIdRef.current;
      if (!id) return;
      // Fire-and-forget: the UI shouldn't block on stat persistence.
      void postAttempts(id, [{ deckWordId, correct, steps }]).catch(() => {});
    },
    [],
  );

  const markKnown = useCallback(
    (deckWordId: string, known = true) => {
      const id = deckIdRef.current;
      if (!id) return;
      void setWordKnown(id, deckWordId, known).catch(() => {});
    },
    [],
  );

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return { status, session, error, recordResult, markKnown, reload };
}
