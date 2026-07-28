"use client";

import { useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { accountKeyFromSession } from "../_lib/offline/account";
import {
  clearAllOfflineData,
  isOfflineStorageAvailable,
  readMeta,
  writeMeta,
} from "../_lib/offline/db";
import { notifyOfflineDecksChanged } from "../_lib/offline/offlineDecks";
import { useSyncOnReconnect } from "../_lib/offline/useOffline";

const ACCOUNT_META_KEY = "accountKey";

/**
 * The two things offline data needs doing to it on every page, wherever the
 * user happens to be: making sure it belongs to whoever is signed in, and
 * pushing whatever is queued as soon as there is a network.
 *
 * Renders nothing.
 */
export default function OfflineDataGuard() {
  const { data: session, status } = useSession();

  useSyncOnReconnect();

  useEffect(() => {
    if (status === "loading" || !isOfflineStorageAvailable()) {
      return;
    }

    const accountKey = accountKeyFromSession(session);

    let cancelled = false;
    void (async () => {
      try {
        const stored = await readMeta<string>(ACCOUNT_META_KEY);
        if (cancelled) {
          return;
        }

        // Signed out, or signed in as somebody else. Either way the decks and
        // the queued answers on this device are not this session's to see.
        // Unsynced work is lost — which beats handing it to the next account.
        if (stored && stored !== accountKey) {
          await clearAllOfflineData();
          notifyOfflineDecksChanged();
        }

        if (accountKey && stored !== accountKey) {
          await writeMeta(ACCOUNT_META_KEY, accountKey);
        }
      } catch {
        // Storage unavailable (private mode, quota, a blocked upgrade). Nothing
        // was written, so there is nothing to clean up.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, status]);

  return null;
}
