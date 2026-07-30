"use client";

/**
 * Offline custom decks: downloading them, practising them without a network,
 * and keeping the local copy honest until the outbox drains.
 *
 * Rounds are chosen here by the same `chooseSessionWords` the server uses, off a
 * local copy of the same stats, so a deck practised on a plane serves the same
 * words in the same order of priority as one practised at a desk.
 */

import {
  applyAttemptToStat,
  applyKnownToStat,
  buildSummary,
  chooseSessionWords,
  levelWindow,
  type DeckProgressSummary,
  type SessionMode,
  type WordStatSummary,
} from "../sessionSelection";
import {
  deleteOfflineDeck,
  enqueueOutbox,
  getOfflineDeck,
  isOfflineStorageAvailable,
  listOfflineDecks,
  putOfflineDeck,
  type OfflineDeckRecord,
  type OfflineDeckWord,
} from "./db";

export { isOfflineStorageAvailable };

/** Fired whenever a deck is downloaded, removed, or its local stats move. */
export const OFFLINE_DECKS_CHANGED = "katchup:offline-decks-changed";

export function notifyOfflineDecksChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OFFLINE_DECKS_CHANGED));
  }
}

interface SnapshotWord extends OfflineDeckWord {
  stat: WordStatSummary | null;
}

interface DeckSnapshot {
  deckId: string;
  deckName: string;
  nativeLang: string;
  foreignLang: string;
  words: SnapshotWord[];
  generatedAt: string;
}

export interface OfflineSessionWord
  extends Omit<OfflineDeckWord, "article"> {
  article: string | null;
  stat: WordStatSummary | null;
}

/**
 * Fills in the article a snapshot downloaded before articles existed has no
 * field for. Stored optional so those records stay valid without a store
 * version bump; every consumer wants a definite null.
 */
export function withStoredArticle<T extends OfflineDeckWord>(
  word: T,
): Omit<T, "article"> & { article: string | null } {
  return { ...word, article: word.article ?? null };
}

export interface OfflineSession {
  deckId: string;
  deckName: string;
  nativeLang: string;
  foreignLang: string;
  mode: SessionMode;
  level: number | null;
  words: OfflineSessionWord[];
  summary: DeckProgressSummary;
  /** Marks the round as served from this device rather than from the server. */
  fromOffline: true;
}

/**
 * Mints an id that survives a retry.
 *
 * `crypto.randomUUID` where it exists; the fallback is only reached on http
 * origins in old browsers, which cannot install the app anyway.
 */
function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Downloads a deck and its stats for offline use, replacing any earlier copy.
 *
 * Deliberately a full replace: the server is the authority on a word's history,
 * and a download is the moment its answer is taken. Local stats moved by an
 * unsynced round are preserved on top, so downloading again mid-flight doesn't
 * lose answers the outbox hasn't delivered yet.
 */
export async function downloadDeckForOffline(
  accountKey: string,
  deckId: string,
): Promise<OfflineDeckRecord> {
  const response = await fetch(`/api/decks/${deckId}/offline`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? "Sign in to download this deck."
        : response.status === 404
          ? "This deck is no longer available."
          : `Download failed (${response.status})`,
    );
  }

  const data = (await response.json()) as { snapshot: DeckSnapshot };
  const snapshot = data.snapshot;

  const stats: Record<string, WordStatSummary | null> = {};
  for (const word of snapshot.words) {
    stats[word.id] = word.stat ?? null;
  }

  const now = Date.now();
  const record: OfflineDeckRecord = {
    key: `${accountKey}:${deckId}`,
    accountKey,
    deckId: snapshot.deckId,
    name: snapshot.deckName,
    nativeLang: snapshot.nativeLang,
    foreignLang: snapshot.foreignLang,
    words: snapshot.words.map(
      ({ id, conceptId, native, foreign, article, orderIndex }) => ({
        id,
        conceptId,
        native,
        foreign,
        article,
        orderIndex,
      }),
    ),
    stats,
    downloadedAt: now,
    lastSyncedAt: now,
  };

  await putOfflineDeck(record);
  notifyOfflineDecksChanged();
  return record;
}

export async function removeOfflineDeck(
  accountKey: string,
  deckId: string,
): Promise<void> {
  await deleteOfflineDeck(accountKey, deckId);
  notifyOfflineDecksChanged();
}

export async function getOfflineDeckRecord(
  accountKey: string,
  deckId: string,
): Promise<OfflineDeckRecord | null> {
  if (!isOfflineStorageAvailable()) {
    return null;
  }
  try {
    return await getOfflineDeck(accountKey, deckId);
  } catch {
    return null;
  }
}

export async function listOfflineDeckIds(
  accountKey: string,
): Promise<Set<string>> {
  if (!isOfflineStorageAvailable()) {
    return new Set();
  }
  try {
    const records = await listOfflineDecks(accountKey);
    return new Set(records.map((record) => record.deckId));
  } catch {
    return new Set();
  }
}

export interface OfflineSessionOptions {
  mode?: SessionMode;
  size?: number;
  level?: number;
}

/**
 * Builds a round out of the downloaded copy. Returns null when this deck was
 * never downloaded for this account — the caller then goes to the network.
 */
export async function readOfflineSession(
  accountKey: string,
  deckId: string,
  options: OfflineSessionOptions = {},
): Promise<OfflineSession | null> {
  const record = await getOfflineDeckRecord(accountKey, deckId);
  if (!record) {
    return null;
  }

  const entries: OfflineSessionWord[] = [...record.words]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((word) => ({
      ...withStoredArticle(word),
      stat: record.stats[word.id] ?? null,
    }));

  const scoped = levelWindow(entries, options.level);

  return {
    deckId: record.deckId,
    deckName: record.name,
    nativeLang: record.nativeLang,
    foreignLang: record.foreignLang,
    mode: options.mode === "finish" ? "finish" : "practice",
    level: options.level ?? null,
    words: chooseSessionWords(scoped, {
      mode: options.mode,
      size: options.size,
    }),
    summary: buildSummary(scoped),
    fromOffline: true,
  };
}

/**
 * Writes one answer down durably, and moves the local copy of the stats if this
 * deck has one.
 *
 * Every round goes through here, not only offline ones. An answer used to be
 * posted fire-and-forget and simply lost if the request failed — a tab closed
 * on a flaky connection quietly threw away the round. It now reaches disk before
 * it reaches the network, and `syncOutbox` is what eventually delivers it.
 *
 * The deck does not have to be downloaded: the queue is keyed by deck id, so an
 * ordinary online round is queued and drained a second and a half later.
 */
export async function queueAttempt(
  accountKey: string,
  deckId: string,
  deckWordId: string,
  correct: boolean,
  steps?: number,
): Promise<void> {
  await enqueueOutbox({
    accountKey,
    deckId,
    kind: "attempt",
    idempotencyKey: newIdempotencyKey(),
    deckWordId,
    correct,
    steps,
    createdAt: Date.now(),
    tries: 0,
    lastError: null,
  });

  const record = await getOfflineDeckRecord(accountKey, deckId);
  if (record) {
    record.stats[deckWordId] = applyAttemptToStat(
      record.stats[deckWordId] ?? null,
      correct,
      steps,
    );
    await putOfflineDeck(record);
  }

  notifyOfflineDecksChanged();
}

/**
 * Marks a word known (or not), durably.
 *
 * The key rides along but the server ignores it for these: setting a word known
 * is the same write however many times it lands, unlike an attempt, which
 * accumulates.
 */
export async function queueKnown(
  accountKey: string,
  deckId: string,
  deckWordId: string,
  known: boolean,
): Promise<void> {
  await enqueueOutbox({
    accountKey,
    deckId,
    kind: "known",
    idempotencyKey: newIdempotencyKey(),
    deckWordId,
    known,
    createdAt: Date.now(),
    tries: 0,
    lastError: null,
  });

  const record = await getOfflineDeckRecord(accountKey, deckId);
  if (record) {
    record.stats[deckWordId] = applyKnownToStat(
      record.stats[deckWordId] ?? null,
      known,
    );
    await putOfflineDeck(record);
  }

  notifyOfflineDecksChanged();
}

/** Progress for a downloaded deck, without touching the network. */
export async function readOfflineProgress(
  accountKey: string,
  deckId: string,
  level?: number,
): Promise<DeckProgressSummary | null> {
  const record = await getOfflineDeckRecord(accountKey, deckId);
  if (!record) {
    return null;
  }

  const entries = [...record.words]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((word) => ({ stat: record.stats[word.id] ?? null }));

  return buildSummary(levelWindow(entries, level));
}
