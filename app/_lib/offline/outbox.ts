"use client";

/**
 * Draining the outbox.
 *
 * Every answer given offline is written durably before it is sent, batched per
 * deck when it goes, and deleted only once the server has confirmed it. The
 * confirmation is safe to lose: each attempt carries an idempotency key minted
 * when the answer happened, so redelivering a batch whose response never arrived
 * counts nothing twice.
 */

import type { WordStatSummary } from "../sessionSelection";
import {
  countOutbox,
  deleteOutboxEntries,
  listOutbox,
  updateOutboxEntries,
  getOfflineDeck,
  putOfflineDeck,
  type OutboxEntry,
} from "./db";
import { notifyOfflineDecksChanged } from "./offlineDecks";

/** Fired after every drain, successful or not, so the UI can re-read status. */
export const OUTBOX_CHANGED = "katchup:outbox-changed";

/** Answers per request. Big enough to be one round, small enough to retry cheaply. */
const BATCH_SIZE = 50;

/**
 * After this many failed deliveries an entry stops being retried on its own and
 * is reported as failed instead. It is kept, not dropped — the user's answers
 * are theirs, and a manual retry may still land them.
 */
const MAX_TRIES = 6;

export interface SyncStatus {
  pending: number;
  failed: number;
  syncing: boolean;
  lastSyncedAt: number | null;
  lastError: string | null;
}

let syncing = false;
let lastSyncedAt: number | null = null;
let lastError: string | null = null;

function announce(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OUTBOX_CHANGED));
  }
}

export async function readSyncStatus(accountKey: string): Promise<SyncStatus> {
  let pending = 0;
  let failed = 0;
  try {
    const entries = await listOutbox(accountKey);
    pending = entries.length;
    failed = entries.filter((entry) => entry.tries >= MAX_TRIES).length;
  } catch {
    // An unreadable outbox is reported as empty rather than as an error the
    // user can do nothing about.
  }

  return { pending, failed, syncing, lastSyncedAt, lastError };
}

export async function countPending(accountKey: string): Promise<number> {
  try {
    return await countOutbox(accountKey);
  } catch {
    return 0;
  }
}

function groupByDeck(entries: OutboxEntry[]): Map<string, OutboxEntry[]> {
  const groups = new Map<string, OutboxEntry[]>();
  for (const entry of entries) {
    const bucket = groups.get(entry.deckId);
    if (bucket) {
      bucket.push(entry);
    } else {
      groups.set(entry.deckId, [entry]);
    }
  }
  return groups;
}

class SyncFailure extends Error {
  /** Whether retrying this entry later could plausibly work. */
  retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.retryable = retryable;
  }
}

async function postAttemptBatch(
  deckId: string,
  entries: OutboxEntry[],
): Promise<void> {
  const response = await fetch(`/api/decks/${deckId}/attempts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      attempts: entries.map((entry) => ({
        deckWordId: entry.deckWordId,
        correct: entry.correct === true,
        steps: entry.steps,
        idempotencyKey: entry.idempotencyKey,
      })),
    }),
  });

  if (response.ok) {
    return;
  }

  // A deck that no longer exists will never accept these answers; keeping them
  // would mean a "pending sync" badge that can never clear.
  throw new SyncFailure(
    `Sync failed (${response.status})`,
    response.status !== 404 && response.status !== 400,
  );
}

async function postKnown(deckId: string, entry: OutboxEntry): Promise<void> {
  const response = await fetch(`/api/decks/${deckId}/known`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deckWordId: entry.deckWordId,
      known: entry.known !== false,
    }),
  });

  if (response.ok) {
    return;
  }

  throw new SyncFailure(
    `Sync failed (${response.status})`,
    response.status !== 404 && response.status !== 400,
  );
}

/**
 * After a deck's queue drains, pull the server's version of its stats back
 * down. The local copy has been moved by `applyAttemptToStat`, which is a
 * faithful but separate implementation; this is what keeps the two from drifting
 * over a long offline stretch.
 */
async function refreshDeckStats(
  accountKey: string,
  deckId: string,
): Promise<void> {
  const response = await fetch(`/api/decks/${deckId}/offline`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    return;
  }

  const data = (await response.json()) as {
    snapshot: { words: { id: string; stat: WordStatSummary | null }[] };
  };

  const record = await getOfflineDeck(accountKey, deckId);
  if (!record) {
    return;
  }

  const stats: Record<string, WordStatSummary | null> = {};
  for (const word of data.snapshot.words) {
    stats[word.id] = word.stat ?? null;
  }

  record.stats = stats;
  record.lastSyncedAt = Date.now();
  await putOfflineDeck(record);
  notifyOfflineDecksChanged();
}

/**
 * Sends everything queued for this account.
 *
 * Returns the status afterwards. Safe to call often and from anywhere — a drain
 * already in flight is not started twice.
 */
export async function syncOutbox(accountKey: string): Promise<SyncStatus> {
  if (syncing) {
    return readSyncStatus(accountKey);
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return readSyncStatus(accountKey);
  }

  syncing = true;
  announce();

  try {
    let entries: OutboxEntry[];
    try {
      entries = await listOutbox(accountKey);
    } catch {
      return readSyncStatus(accountKey);
    }

    // Entries already given up on are only retried when the user asks; a drain
    // triggered by coming online must not hammer a write that keeps failing.
    const sendable = entries.filter((entry) => entry.tries < MAX_TRIES);
    if (sendable.length === 0) {
      lastError = entries.length > 0 ? lastError : null;
      return readSyncStatus(accountKey);
    }

    lastError = null;
    const drainedDecks = new Set<string>();

    for (const [deckId, deckEntries] of groupByDeck(sendable)) {
      const attempts = deckEntries.filter((entry) => entry.kind === "attempt");
      const knowns = deckEntries.filter((entry) => entry.kind === "known");

      // Attempts go in batches; a whole batch either lands or is retried whole,
      // which the idempotency keys make harmless.
      for (let i = 0; i < attempts.length; i += BATCH_SIZE) {
        const batch = attempts.slice(i, i + BATCH_SIZE);
        try {
          await postAttemptBatch(deckId, batch);
          await deleteOutboxEntries(
            batch.map((entry) => entry.id!).filter((id) => id !== undefined),
          );
          drainedDecks.add(deckId);
        } catch (error) {
          await recordFailure(batch, error);
          // Stop this deck here: later answers for the same words must not
          // overtake the ones still queued in front of them.
          break;
        }
      }

      for (const entry of knowns) {
        try {
          await postKnown(deckId, entry);
          if (entry.id !== undefined) {
            await deleteOutboxEntries([entry.id]);
          }
          drainedDecks.add(deckId);
        } catch (error) {
          await recordFailure([entry], error);
          break;
        }
      }
    }

    // Only decks that actually sent something need their stats re-read.
    for (const deckId of drainedDecks) {
      const remaining = (await listOutbox(accountKey)).some(
        (entry) => entry.deckId === deckId,
      );
      if (!remaining) {
        await refreshDeckStats(accountKey, deckId).catch(() => {});
      }
    }

    lastSyncedAt = Date.now();
    return readSyncStatus(accountKey);
  } finally {
    syncing = false;
    announce();
  }
}

async function recordFailure(
  entries: OutboxEntry[],
  error: unknown,
): Promise<void> {
  const message =
    error instanceof Error ? error.message : "Could not reach the server";
  const retryable = !(error instanceof SyncFailure) || error.retryable;

  lastError = message;

  if (!retryable) {
    // The server will never take these. Dropping them is the only way the
    // pending count can ever reach zero.
    await deleteOutboxEntries(
      entries.map((entry) => entry.id!).filter((id) => id !== undefined),
    );
    return;
  }

  await updateOutboxEntries(
    entries.map((entry) => ({
      ...entry,
      tries: entry.tries + 1,
      lastError: message,
    })),
  );
}

/**
 * How long answers pile up before a drain goes out.
 *
 * A round is a burst of answers a couple of seconds apart, and one request per
 * answer would be both wasteful and slower than the round. Waiting this long
 * turns a ten-word round into roughly one request without the player ever
 * noticing the delay — the answer is already durable on disk by then.
 */
const SYNC_DEBOUNCE_MS = 1500;

let syncTimer: ReturnType<typeof setTimeout> | null = null;

/** Queues a drain for shortly from now, collapsing repeated calls into one. */
export function scheduleSync(accountKey: string): void {
  if (typeof window === "undefined") {
    return;
  }
  if (syncTimer) {
    clearTimeout(syncTimer);
  }
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void syncOutbox(accountKey).catch(() => {});
  }, SYNC_DEBOUNCE_MS);
}

/**
 * Sends whatever is queued right now, without waiting out the debounce. For the
 * end of a round, where the player is about to look at a progress bar.
 */
export function flushSync(accountKey: string): Promise<SyncStatus> {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  return syncOutbox(accountKey);
}

/** Clears the give-up counters so a manual retry actually tries again. */
export async function retryFailed(accountKey: string): Promise<SyncStatus> {
  try {
    const entries = await listOutbox(accountKey);
    const failed = entries.filter((entry) => entry.tries >= MAX_TRIES);
    if (failed.length > 0) {
      await updateOutboxEntries(
        failed.map((entry) => ({ ...entry, tries: 0, lastError: null })),
      );
    }
  } catch {
    // Nothing to reset.
  }
  return syncOutbox(accountKey);
}
