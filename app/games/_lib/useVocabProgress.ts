"use client";

import { useCallback, useEffect, useRef } from "react";
import { useSession } from "@/lib/auth-client";
import { useLanguagePair } from "@/app/_lib/useLanguagePair";
import type { Lang } from "@/app/_lib/languages";

interface BufferedAttempt {
  conceptId: string;
  correct: boolean;
  steps?: number;
}

/**
 * Records answers from the games played without a deck.
 *
 * These rounds draw straight from the corpus, and every card already carries the
 * concept id it came from — the identity was in the client's hands all along and
 * simply thrown away, so playing from the games hub taught the app nothing.
 *
 * Shaped like `useDeckSession.recordResult(id, correct, steps)` on purpose, so a
 * game's call site reads the same whichever path it is on.
 *
 * Answers are buffered and flushed at the end of the round rather than sent one
 * at a time: a thirty-card round would otherwise be thirty requests, and on the
 * HTTP driver the round trip is the whole cost.
 *
 * Pass the pair the round was actually drawn with when the game does not use the
 * player's stored one — Score Rush takes its languages from the URL, and Flip
 * Cards has a switcher. Recording those under the stored pair would file the
 * words against a language the player never played.
 */
export function useVocabProgress(pair?: { speak: Lang; learning: Lang }) {
  const { data: session } = useSession();
  const stored = useLanguagePair();
  const speak = pair?.speak ?? stored.speak;
  const learning = pair?.learning ?? stored.learning;
  const userId = session?.user?.id ?? null;

  // The pair is held with the buffer, not read at send time: a player who
  // switches language mid-round would otherwise have the words they answered
  // before the switch filed under the language they switched *to*.
  const buffer = useRef<{
    speak: Lang;
    learning: Lang;
    attempts: Map<string, BufferedAttempt>;
  }>({ speak, learning, attempts: new Map() });

  const send = useCallback(
    (
      nativeLang: Lang,
      foreignLang: Lang,
      attempts: BufferedAttempt[],
      keepalive: boolean,
    ) => {
      if (!userId || attempts.length === 0 || nativeLang === foreignLang) {
        return;
      }

      void fetch("/api/vocab/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nativeLang, foreignLang, attempts }),
        // Players navigate away the moment a round ends, which would otherwise
        // cancel the request in flight.
        keepalive,
      }).catch(() => {
        // Non-fatal: a lost round of practice is not worth interrupting play
        // for, and signed-out players get a 401 they are meant to ignore.
      });
    },
    [userId],
  );

  const flush = useCallback(
    (keepalive = false) => {
      const { speak: bufferedSpeak, learning: bufferedLearning, attempts } =
        buffer.current;
      buffer.current = { speak, learning, attempts: new Map() };
      send(bufferedSpeak, bufferedLearning, [...attempts.values()], keepalive);
    },
    [send, speak, learning],
  );

  // The unmount flush must see the latest languages without re-running (and so
  // firing) every time they change.
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const record = useCallback(
    (conceptId: string | null | undefined, correct: boolean, steps?: number) => {
      if (!conceptId) {
        return;
      }

      // Switching language starts a new buffer, and the old one goes out under
      // the language it was played in.
      if (
        buffer.current.speak !== speak ||
        buffer.current.learning !== learning
      ) {
        const previous = buffer.current;
        buffer.current = { speak, learning, attempts: new Map() };
        send(
          previous.speak,
          previous.learning,
          [...previous.attempts.values()],
          false,
        );
      }

      // One entry per word per round. A game like Score Rush recycles its pool
      // until the clock runs out, and forty repeats of one word should not read
      // as forty practices. A wrong answer sticks: getting it right later in the
      // same round does not undo having needed the reminder.
      const existing = buffer.current.attempts.get(conceptId);
      if (existing && (existing.correct === correct || !correct)) {
        return;
      }
      buffer.current.attempts.set(conceptId, { conceptId, correct, steps });
    },
    [send, speak, learning],
  );

  useEffect(() => {
    return () => flushRef.current(true);
  }, []);

  return { record, flush };
}
