"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { useSession } from "@/lib/auth-client";
import { accountKeyFromSession } from "./account";
import {
  downloadDeckForOffline,
  getOfflineDeckRecord,
  isOfflineStorageAvailable,
  listOfflineDeckIds,
  notifyOfflineDecksChanged,
  OFFLINE_DECKS_CHANGED,
  removeOfflineDeck,
} from "./offlineDecks";
import {
  OUTBOX_CHANGED,
  readSyncStatus,
  retryFailed,
  syncOutbox,
  type SyncStatus,
} from "./outbox";

/** The account whose offline data this device is allowed to read, if any. */
export function useAccountKey(): string | null {
  const { data: session } = useSession();
  return useMemo(() => accountKeyFromSession(session), [session]);
}

function subscribeToConnection(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Whether the browser currently believes it has a network.
 *
 * The server has no `navigator`, so it reports online: assuming offline there
 * would flash an offline banner into the first paint of every page.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribeToConnection,
    () => navigator.onLine,
    () => true,
  );
}

const EMPTY_STATUS: SyncStatus = {
  pending: 0,
  failed: 0,
  syncing: false,
  lastSyncedAt: null,
  lastError: null,
};

/**
 * A value read asynchronously for one scope (an account, or an account and a
 * deck), tagged with the scope it belongs to.
 *
 * The tag is what lets the hooks below switch scope without an effect that
 * clears state on the way: a value whose tag doesn't match the current scope is
 * simply not this scope's value, and reads as "not loaded yet".
 */
interface Scoped<T> {
  scope: string;
  value: T;
}

/** Pending / failed / last-synced, refreshed whenever the outbox moves. */
export function useSyncStatus(): SyncStatus & { retry: () => void } {
  const accountKey = useAccountKey();
  const enabled = Boolean(accountKey) && isOfflineStorageAvailable();
  const scope = enabled ? (accountKey as string) : "";

  const [entry, setEntry] = useState<Scoped<SyncStatus> | null>(null);

  useEffect(() => {
    if (!enabled || !accountKey) {
      return;
    }

    let cancelled = false;
    const refresh = () => {
      void readSyncStatus(accountKey).then((next) => {
        if (!cancelled) setEntry({ scope: accountKey, value: next });
      });
    };

    refresh();
    window.addEventListener(OUTBOX_CHANGED, refresh);
    window.addEventListener(OFFLINE_DECKS_CHANGED, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(OUTBOX_CHANGED, refresh);
      window.removeEventListener(OFFLINE_DECKS_CHANGED, refresh);
    };
  }, [accountKey, enabled]);

  const retry = useCallback(() => {
    if (accountKey) {
      void retryFailed(accountKey);
    }
  }, [accountKey]);

  const status = entry && entry.scope === scope ? entry.value : EMPTY_STATUS;
  return { ...status, retry };
}

export interface OfflineDeckState {
  available: boolean;
  downloadedAt: number | null;
  lastSyncedAt: number | null;
  busy: boolean;
  error: string | null;
  /** False while the first read of IndexedDB is still in flight. */
  ready: boolean;
  download: () => void;
  remove: () => void;
}

interface DeckDownloadInfo {
  downloadedAt: number;
  lastSyncedAt: number | null;
}

/** Drives the download button on one deck. */
export function useOfflineDeck(deckId: string | null): OfflineDeckState {
  const accountKey = useAccountKey();
  const online = useOnlineStatus();
  const enabled =
    Boolean(accountKey) && Boolean(deckId) && isOfflineStorageAvailable();
  const scope = enabled ? `${accountKey}:${deckId}` : "";

  const [entry, setEntry] = useState<Scoped<DeckDownloadInfo | null> | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !accountKey || !deckId) {
      return;
    }

    const key = `${accountKey}:${deckId}`;
    let cancelled = false;

    const refresh = () => {
      void getOfflineDeckRecord(accountKey, deckId).then((found) => {
        if (cancelled) return;
        setEntry({
          scope: key,
          value: found
            ? {
                downloadedAt: found.downloadedAt,
                lastSyncedAt: found.lastSyncedAt,
              }
            : null,
        });
      });
    };

    refresh();
    window.addEventListener(OFFLINE_DECKS_CHANGED, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(OFFLINE_DECKS_CHANGED, refresh);
    };
  }, [accountKey, deckId, enabled]);

  const download = useCallback(() => {
    if (!accountKey || !deckId || busy) {
      return;
    }
    if (!isOfflineStorageAvailable()) {
      setError("This browser can't store decks offline.");
      return;
    }
    if (!online) {
      setError("Connect to the internet to download this deck.");
      return;
    }

    setBusy(true);
    setError(null);
    downloadDeckForOffline(accountKey, deckId)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Download failed.");
      })
      .finally(() => setBusy(false));
  }, [accountKey, busy, deckId, online]);

  const remove = useCallback(() => {
    if (!accountKey || !deckId || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    removeOfflineDeck(accountKey, deckId)
      .catch(() => setError("Could not remove the download."))
      .finally(() => setBusy(false));
  }, [accountKey, busy, deckId]);

  const loaded = entry !== null && entry.scope === scope;
  const record = loaded ? entry.value : null;

  return {
    available: record !== null,
    downloadedAt: record?.downloadedAt ?? null,
    lastSyncedAt: record?.lastSyncedAt ?? null,
    busy,
    error,
    // Nothing to wait for when there is nowhere to store anything.
    ready: !enabled || loaded,
    download,
    remove,
  };
}

const NO_DECKS: ReadonlySet<string> = new Set();

/** Which of a list of decks are downloaded, for badging a grid of cards. */
export function useOfflineDeckIds(): ReadonlySet<string> {
  const accountKey = useAccountKey();
  const enabled = Boolean(accountKey) && isOfflineStorageAvailable();
  const scope = enabled ? (accountKey as string) : "";

  const [entry, setEntry] = useState<Scoped<Set<string>> | null>(null);

  useEffect(() => {
    if (!enabled || !accountKey) {
      return;
    }

    let cancelled = false;
    const refresh = () => {
      void listOfflineDeckIds(accountKey).then((next) => {
        if (!cancelled) setEntry({ scope: accountKey, value: next });
      });
    };

    refresh();
    window.addEventListener(OFFLINE_DECKS_CHANGED, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(OFFLINE_DECKS_CHANGED, refresh);
    };
  }, [accountKey, enabled]);

  return entry && entry.scope === scope ? entry.value : NO_DECKS;
}

/** Drains the outbox now, if there is an account and a network to drain it to. */
export function useSyncOnReconnect(): void {
  const accountKey = useAccountKey();

  useEffect(() => {
    if (!accountKey || !isOfflineStorageAvailable()) {
      return;
    }

    const drain = () => {
      void syncOutbox(accountKey).catch(() => {});
    };

    // On mount, on the connection coming back, and on returning to the tab —
    // between them these cover every way a device rejoins the network.
    drain();
    window.addEventListener("online", drain);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        drain();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("online", drain);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [accountKey]);
}

export { notifyOfflineDecksChanged };
