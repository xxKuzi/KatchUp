"use client";

import { Check, Download, Trash2 } from "lucide-react";
import { useLanguage } from "../_lib/languageContext";
import { useOfflineDeck, useOnlineStatus } from "../_lib/offline/useOffline";
import { isOfflineStorageAvailable } from "../_lib/offline/db";
import { MenuItem } from "./CardMenu";

/**
 * "Download for offline use" on one deck, and the badge it becomes afterwards.
 *
 * Only offered for custom decks: a topic deck is topped up server-side and its
 * levels mint keys, so a copy of one on a device is a copy of a moving target.
 */
export default function OfflineDeckButton({
  deckId,
  className = "",
}: {
  deckId: string;
  className?: string;
}) {
  const { t } = useLanguage();
  const online = useOnlineStatus();
  const { available, busy, error, ready, download, remove } =
    useOfflineDeck(deckId);

  // Nothing to offer where nothing can be stored.
  if (!isOfflineStorageAvailable()) {
    return null;
  }

  // Held back until the first read of IndexedDB lands, so the button doesn't
  // say "Download" for a moment on a deck that is already downloaded.
  if (!ready) {
    return (
      <span
        className={`inline-flex h-[34px] w-32 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800 ${className}`}
        aria-hidden="true"
      />
    );
  }

  if (available) {
    return (
      <span className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          <span aria-hidden="true">✓</span>
          {t("offline.available", "Available offline")}
        </span>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="rounded-lg px-2 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 disabled:opacity-60 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          {t("offline.remove", "Remove")}
        </button>
        {error && (
          <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
        )}
      </span>
    );
  }

  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={download}
        disabled={busy || !online}
        title={
          online
            ? undefined
            : t("offline.needsConnection", "Connect to download this deck.")
        }
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        {busy
          ? t("offline.downloading", "Downloading…")
          : t("offline.download", "Download for offline use")}
      </button>
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
      )}
    </span>
  );
}

/**
 * The same download action shaped as rows for a `CardMenu`.
 *
 * Shares the hook rather than the markup: a menu row and a standalone button
 * want different chrome, but "is it downloaded, is it busy, can it be" is one
 * question with one answer.
 */
export function OfflineDeckMenuItems({ deckId }: { deckId: string }) {
  const { t } = useLanguage();
  const online = useOnlineStatus();
  const { available, busy, ready, download, remove } = useOfflineDeck(deckId);

  // A menu can simply not offer what this browser can't do, with no gap left
  // behind — unlike the inline button, which holds space in a row of buttons.
  if (!isOfflineStorageAvailable() || !ready) {
    return null;
  }

  if (available) {
    return (
      <MenuItem onClick={remove} disabled={busy} tone="danger">
        <Trash2 className="h-4 w-4 shrink-0" />
        {t("offline.remove", "Remove")}
        <Check
          className="ml-auto h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
          aria-label={t("offline.available", "Available offline")}
        />
      </MenuItem>
    );
  }

  return (
    <MenuItem onClick={download} disabled={busy || !online}>
      <Download className="h-4 w-4 shrink-0" />
      {busy
        ? t("offline.downloading", "Downloading…")
        : t("offline.download", "Download for offline use")}
    </MenuItem>
  );
}
