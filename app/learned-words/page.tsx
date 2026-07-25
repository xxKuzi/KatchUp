"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "../_lib/languageContext";
import { useAuthState } from "../_lib/auth";
import {
  ApiError,
  LearnedWordItem,
  LearnedWordsPage,
  fetchLearnedWords,
} from "./_lib/client";

export default function LearnedWordsOverview() {
  const { t } = useLanguage();
  const { isSignedIn, isReady, signIn } = useAuthState();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LearnedWordsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    if (isReady && !isSignedIn) {
      setUnauthorized(true);
      setLoading(false);
      return;
    }
    if (!isSignedIn) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetchLearnedWords(page)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setUnauthorized(false);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setUnauthorized(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, isReady, page]);

  const items = data?.items ?? [];

  return (
    <div className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <section className="first-section-static-glow rounded-2xl border border-slate-200 bg-white/90 p-6 dark:border-slate-800 dark:bg-slate-950/70 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            {t("common.welcome")}
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100 sm:text-4xl">
            {t("learnedWords.title")}
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
            {t("learnedWords.description")}
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {t("learnedWords.title")}
            </h2>
            {data && data.total > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-3 py-1 text-center text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {data.total} {t("learnedWords.totalWords")}
              </span>
            )}
          </div>

          {unauthorized ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <p>{t("myDecks.signInToSync", "Sign in to see and sync your decks.")}</p>
              <button
                type="button"
                onClick={signIn}
                className="mt-4 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700"
              >
                {t("common.signIn", "Sign in")}
              </button>
            </div>
          ) : loading ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {t("common.loading", "Loading…")}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {t("learnedWords.empty")}
            </div>
          ) : (
            <>
              <ul className="space-y-2">
                {items.map((item) => (
                  <LearnedWordRow key={`${item.source}-${item.id}`} item={item} t={t} />
                ))}
              </ul>

              {data && data.totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled={data.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {t("learnedWords.previous")}
                  </button>
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    {t("learnedWords.page")} {data.page} {t("learnedWords.of")}{" "}
                    {data.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={data.page >= data.totalPages}
                    onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {t("learnedWords.next")}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function LearnedWordRow({
  item,
  t,
}: {
  item: LearnedWordItem;
  t: (key: string, defaultValue?: string) => string;
}) {
  const learned = item.status === "learned";

  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="min-w-0">
        <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
          {item.foreign}{" "}
          <span className="font-normal text-slate-500 dark:text-slate-400">
            — {item.native}
          </span>
        </p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
          {item.sourceLabel}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
          learned
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
            : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
        }`}
      >
        {learned
          ? `${t("learnedWords.learned")}${
              item.times != null ? ` ×${item.times}` : ""
            }`
          : t("learnedWords.skipped")}
      </span>
    </li>
  );
}
