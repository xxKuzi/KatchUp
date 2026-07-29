import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import OfflineRetry from "./OfflineRetry";

export const metadata: Metadata = {
  title: "Offline — KatchUp",
  description: "You're offline. Downloaded decks are still ready to practise.",
};

/**
 * What the service worker serves when a navigation fails and it has no cached
 * copy of the page that was asked for.
 *
 * Deliberately server-rendered and static: it has to be precacheable as plain
 * HTML at install time, so nothing on it may depend on a session or a fetch.
 * The one client bit is the retry button, which watches for the connection
 * coming back.
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-background px-4 py-12 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950">
        {/* `unoptimized` on purpose: the optimizer serves from /_next/image,
            which the service worker never caches, so the optimized copy is
            exactly the one that isn't there when this page is shown. The raw
            file is in the precached shell. */}
        <Image
          src="/katchup_mascot.webp"
          alt=""
          width={120}
          height={120}
          className="mx-auto h-28 w-28 opacity-90"
          unoptimized
          priority
        />
        <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-slate-100">
          You&rsquo;re offline
        </h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">
          This page needs a connection. Decks you downloaded for offline use are
          still there — open My Decks and keep practising.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/my-decks"
            className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            Go to My Decks
          </Link>
          <OfflineRetry />
        </div>

        <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
          Anything you practise offline is saved on this device and syncs the
          moment you&rsquo;re back online.
        </p>
      </div>
    </div>
  );
}
