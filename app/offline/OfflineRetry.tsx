"use client";

import { useEffect, useRef } from "react";
import { useOnlineStatus } from "../_lib/offline/useOffline";

/**
 * Retry button for the offline page. Reloads on demand, and reloads itself once
 * the browser reports the connection is back — the page is a dead end otherwise
 * until someone thinks to refresh.
 */
export default function OfflineRetry() {
  const online = useOnlineStatus();
  const wasOffline = useRef(false);

  // Only on the *transition* back online. Reloading whenever `online` is true
  // would loop forever for anyone who reaches this page with a connection — the
  // reload would just be served this same page again.
  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (wasOffline.current) {
      window.location.reload();
    }
  }, [online]);

  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
    >
      {online ? "Try again" : "Waiting for a connection…"}
    </button>
  );
}
