"use client";

import { useSyncExternalStore } from "react";
import { useLanguage } from "../_lib/languageContext";
import { useOnlineStatus, useSyncStatus } from "../_lib/offline/useOffline";

/**
 * A clock that ticks every half minute, as an external store.
 *
 * The wall clock genuinely is an external system: reading `Date.now()` during
 * render would make the component return a different thing on every re-render
 * of the same props. Rounded to the tick so repeated reads inside one render
 * pass agree with each other.
 */
const TICK_MS = 30_000;

function subscribeToClock(onChange: () => void): () => void {
  const timer = setInterval(onChange, TICK_MS);
  return () => clearInterval(timer);
}

function readClock(): number {
  return Math.floor(Date.now() / TICK_MS) * TICK_MS;
}

/** "3 minutes ago" for a timestamp, or null when there isn't one. */
function useRelativeTime(timestamp: number | null): string | null {
  const now = useSyncExternalStore(subscribeToClock, readClock, () => 0);

  if (timestamp === null || now === 0) {
    return null;
  }

  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/**
 * What the device still owes the server, and when it last paid up.
 *
 * Deliberately quiet when there is nothing to say: an app that permanently
 * displays "Synced" is an app that has trained you not to read the badge, so
 * the "Last synced" line only appears once something has actually been synced
 * this session.
 */
export default function SyncStatusBadge({
  className = "",
}: {
  className?: string;
}) {
  const { t } = useLanguage();
  const online = useOnlineStatus();
  const { pending, failed, syncing, lastSyncedAt, retry } = useSyncStatus();
  const lastSynced = useRelativeTime(lastSyncedAt);

  const nothingToShow = pending === 0 && failed === 0 && !lastSynced && online;
  if (nothingToShow) {
    return null;
  }

  if (failed > 0) {
    return (
      <span
        role="status"
        className={`inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-950/60 dark:text-red-300 ${className}`}
      >
        <span aria-hidden="true">⚠</span>
        {t("offline.syncFailed", "Sync failed")} ({failed})
        <button
          type="button"
          onClick={retry}
          className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white transition hover:bg-red-700"
        >
          {t("offline.retry", "Retry")}
        </button>
      </span>
    );
  }

  if (pending > 0) {
    return (
      <span
        role="status"
        className={`inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 ${className}`}
      >
        <span aria-hidden="true">{syncing ? "↻" : "•"}</span>
        {syncing
          ? t("offline.syncing", "Syncing…")
          : `${t("offline.pendingSync", "Pending sync")} (${pending})`}
      </span>
    );
  }

  if (!online) {
    return (
      <span
        role="status"
        className={`inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300 ${className}`}
      >
        <span aria-hidden="true">⌁</span>
        {t("offline.offline", "Offline")}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300 ${className}`}
    >
      {t("offline.lastSynced", "Last synced")} {lastSynced}
    </span>
  );
}
