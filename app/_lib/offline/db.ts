"use client";

/**
 * The IndexedDB behind offline decks.
 *
 * Hand-rolled rather than pulling in `idb`: three stores and a handful of
 * request wrappers is less code than the dependency, and it keeps the offline
 * feature from adding anything to the bundle everyone downloads.
 *
 * Everything here is account-scoped by key prefix. A device is shared far more
 * often than a browser profile is, and one account's downloaded decks must never
 * be readable — or practisable — by the next person who signs in.
 */

import type { WordStatSummary } from "../sessionSelection";

const DB_NAME = "katchup-offline";
// Bump alongside any change to the stores or indexes below.
const DB_VERSION = 1;

export const DECK_STORE = "decks";
export const OUTBOX_STORE = "outbox";
export const META_STORE = "meta";

export interface OfflineDeckWord {
  id: string;
  conceptId: string | null;
  native: string;
  foreign: string;
  /**
   * Optional so snapshots written before articles existed stay valid and the
   * store version does not have to move — an old record simply has no article
   * and renders bare.
   */
  article?: string | null;
  orderIndex: number;
}

/** One downloaded deck: its content, its stats, and when both were fetched. */
export interface OfflineDeckRecord {
  /** `${accountKey}:${deckId}` — the primary key. */
  key: string;
  accountKey: string;
  deckId: string;
  name: string;
  nativeLang: string;
  foreignLang: string;
  words: OfflineDeckWord[];
  /** Practice history per deck word, as it stood at the last download or sync. */
  stats: Record<string, WordStatSummary | null>;
  downloadedAt: number;
  /** Last time server truth was pulled down or local writes were confirmed. */
  lastSyncedAt: number | null;
}

export type OutboxKind = "attempt" | "known";

/**
 * One durable local write, waiting for a network.
 *
 * `idempotencyKey` is minted here, at the moment the answer happens, and never
 * changes across retries — that is what lets the server drop a duplicate rather
 * than count an answer twice when a request succeeds but its response is lost.
 */
export interface OutboxEntry {
  id?: number;
  accountKey: string;
  deckId: string;
  kind: OutboxKind;
  idempotencyKey: string;
  deckWordId: string;
  correct?: boolean;
  steps?: number;
  known?: boolean;
  createdAt: number;
  /** How many sync attempts this entry has survived. */
  tries: number;
  lastError: string | null;
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function isOfflineStorageAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(DECK_STORE)) {
        const decks = db.createObjectStore(DECK_STORE, { keyPath: "key" });
        decks.createIndex("accountKey", "accountKey", { unique: false });
      }

      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        const outbox = db.createObjectStore(OUTBOX_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        outbox.createIndex("accountKey", "accountKey", { unique: false });
        // Drained oldest-first, so an answer and the correction that follows it
        // reach the server in the order they were given.
        outbox.createIndex("createdAt", "createdAt", { unique: false });
      }

      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      // Another tab upgrading the schema would otherwise block forever.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("IndexedDB upgrade blocked by another tab"));
  });

  // A failed open must not poison every later call — private-mode browsers
  // reject once and then work fine after a reload.
  dbPromise = opening.catch((error: unknown) => {
    dbPromise = null;
    throw error;
  });

  return dbPromise;
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
  const db = await openDb();
  const tx = db.transaction(storeName, mode);
  const store = tx.objectStore(storeName);
  const result = await run(store);

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

  return result;
}

export function deckKey(accountKey: string, deckId: string): string {
  return `${accountKey}:${deckId}`;
}

// --- decks -----------------------------------------------------------------

export async function putOfflineDeck(record: OfflineDeckRecord): Promise<void> {
  await withStore(DECK_STORE, "readwrite", (store) => {
    store.put(record);
  });
}

export async function getOfflineDeck(
  accountKey: string,
  deckId: string,
): Promise<OfflineDeckRecord | null> {
  const record = await withStore(DECK_STORE, "readonly", (store) =>
    promisify<OfflineDeckRecord | undefined>(
      store.get(deckKey(accountKey, deckId)),
    ),
  );
  // The key is account-scoped, but check the field too: a stale record written
  // under an older key scheme must not leak across accounts.
  return record && record.accountKey === accountKey ? record : null;
}

export async function listOfflineDecks(
  accountKey: string,
): Promise<OfflineDeckRecord[]> {
  return withStore(DECK_STORE, "readonly", (store) =>
    promisify<OfflineDeckRecord[]>(
      store.index("accountKey").getAll(accountKey),
    ),
  );
}

export async function deleteOfflineDeck(
  accountKey: string,
  deckId: string,
): Promise<void> {
  await withStore(DECK_STORE, "readwrite", (store) => {
    store.delete(deckKey(accountKey, deckId));
  });
}

// --- outbox ----------------------------------------------------------------

export async function enqueueOutbox(entry: OutboxEntry): Promise<number> {
  return withStore(OUTBOX_STORE, "readwrite", (store) =>
    promisify<IDBValidKey>(store.add(entry)).then(Number),
  );
}

export async function listOutbox(
  accountKey: string,
  limit?: number,
): Promise<OutboxEntry[]> {
  const all = await withStore(OUTBOX_STORE, "readonly", (store) =>
    promisify<OutboxEntry[]>(store.index("accountKey").getAll(accountKey)),
  );
  all.sort((a, b) => a.createdAt - b.createdAt || (a.id ?? 0) - (b.id ?? 0));
  return typeof limit === "number" ? all.slice(0, limit) : all;
}

export async function countOutbox(accountKey: string): Promise<number> {
  return withStore(OUTBOX_STORE, "readonly", (store) =>
    promisify<number>(store.index("accountKey").count(accountKey)),
  );
}

export async function deleteOutboxEntries(ids: number[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  await withStore(OUTBOX_STORE, "readwrite", (store) => {
    for (const id of ids) {
      store.delete(id);
    }
  });
}

export async function updateOutboxEntries(
  entries: OutboxEntry[],
): Promise<void> {
  if (entries.length === 0) {
    return;
  }
  await withStore(OUTBOX_STORE, "readwrite", (store) => {
    for (const entry of entries) {
      store.put(entry);
    }
  });
}

// --- meta ------------------------------------------------------------------

interface MetaRow {
  key: string;
  value: unknown;
}

export async function readMeta<T>(key: string): Promise<T | null> {
  const row = await withStore(META_STORE, "readonly", (store) =>
    promisify<MetaRow | undefined>(store.get(key)),
  );
  return row ? (row.value as T) : null;
}

export async function writeMeta(key: string, value: unknown): Promise<void> {
  await withStore(META_STORE, "readwrite", (store) => {
    store.put({ key, value });
  });
}

/**
 * Wipes everything: called on sign-out and whenever the signed-in account is
 * not the one the stored data belongs to. Unsynced answers are lost, which is
 * the right trade — the alternative is showing them to whoever signs in next.
 */
export async function clearAllOfflineData(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([DECK_STORE, OUTBOX_STORE, META_STORE], "readwrite");
  tx.objectStore(DECK_STORE).clear();
  tx.objectStore(OUTBOX_STORE).clear();
  tx.objectStore(META_STORE).clear();

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
