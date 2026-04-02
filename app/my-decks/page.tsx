"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CustomDeck,
  groupDecksByLanguages,
  loadCustomDecks,
} from "./_lib/customDecks";

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Never";
  }

  return date.toLocaleString();
}

export default function MyDecksOverview() {
  const [decks, setDecks] = useState<CustomDeck[]>([]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDecks(loadCustomDecks());
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const groupedDecks = useMemo(() => groupDecksByLanguages(decks), [decks]);
  const groupEntries = useMemo(
    () => Object.entries(groupedDecks).sort((a, b) => a[0].localeCompare(b[0])),
    [groupedDecks],
  );

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Welcome
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100 sm:text-4xl">
            Your decks
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
            here you can edit and practice your custom words
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/my-decks/edit"
              className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
            >
              Open Deck Editor
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Custom Decks by Languages
            </h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {decks.length} total decks
            </span>
          </div>

          {groupEntries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No decks yet. Create your first one in the deck editor.
            </div>
          ) : (
            <div className="space-y-6">
              {groupEntries.map(([languagePair, group]) => (
                <div key={languagePair} className="space-y-3">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {languagePair}
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {group.map((deck) => (
                      <article
                        key={deck.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900"
                      >
                        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {deck.id}
                        </p>
                        <h4 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
                          {deck.name}
                        </h4>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                          {deck.words.length} words
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Last practiced: {formatDate(deck.lastPracticed)}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link
                            href={`/my-decks/edit?deck=${deck.id}`}
                            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
                          >
                            Edit
                          </Link>
                          <Link
                            href={`/my-decks/practice?deck=${deck.id}`}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900"
                          >
                            Practice
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
