"use client";

// The page a share link opens. Anyone holding the link can look at the deck;
// joining it needs an account, because access is stored per user.

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthState } from "@/app/_lib/auth";
import { useLanguage } from "@/app/_lib/languageContext";
import {
  fetchSharePreview,
  joinSharedDeck,
  type SharePreview,
} from "@/app/my-decks/_lib/shareClient";

export default function SharedDeckPage() {
  const params = useParams<{ code: string }>();
  const code = typeof params?.code === "string" ? params.code : "";
  const router = useRouter();
  const { t } = useLanguage();
  const { isSignedIn, isReady, signIn } = useAuthState();

  const [preview, setPreview] = useState<SharePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!code) {
      return;
    }

    let cancelled = false;
    fetchSharePreview(code)
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            t(
              "share.linkDead",
              "This link is no longer active. Ask your friend for a new one.",
            ),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [code, t]);

  const handleJoin = async () => {
    setJoining(true);
    setError("");
    try {
      const result = await joinSharedDeck(code);
      router.push(`/my-decks/practice?deck=${result.deckId}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("share.joinFailed", "Could not add this deck."),
      );
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-6">
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-8">
        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("common.loading", "Loading…")}
          </p>
        ) : !preview ? (
          <div className="space-y-4 text-center">
            <p className="text-slate-700 dark:text-slate-200">
              {error ||
                t("share.linkDead", "This link is no longer active.")}
            </p>
            <button
              type="button"
              onClick={() => router.push("/my-decks")}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              {t("share.goToMyDecks", "Go to my decks")}
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              {preview.ownerName
                ? t("share.sharedBy", "Shared by") + " " + preview.ownerName
                : t("share.sharedDeck", "Shared deck")}
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">
              {preview.name}
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {preview.nativeLang} → {preview.foreignLang} ·{" "}
              {preview.wordCount} {t("common.words", "words")}
            </p>

            {preview.sampleWords.length > 0 && (
              <ul className="mt-5 space-y-1 rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-800">
                {preview.sampleWords.map((word) => (
                  <li
                    key={`${word.native}|${word.foreign}`}
                    className="flex justify-between gap-4"
                  >
                    <span className="text-slate-700 dark:text-slate-200">
                      {word.native}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {word.foreign}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-5 text-sm text-slate-600 dark:text-slate-300">
              {preview.role === "editor"
                ? t(
                    "share.joinEditorHint",
                    "You can practise this deck and add words to it. Your progress stays your own.",
                  )
                : t(
                    "share.joinViewerHint",
                    "You can practise this deck. Your progress stays your own.",
                  )}
            </p>

            {error && (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/60 dark:text-red-300">
                {error}
              </p>
            )}

            {isReady && !isSignedIn ? (
              <button
                type="button"
                onClick={signIn}
                className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700"
              >
                {t("share.signInToJoin", "Sign in to add this deck")}
              </button>
            ) : (
              <button
                type="button"
                disabled={joining || !isReady}
                onClick={handleJoin}
                className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {joining
                  ? t("share.joining", "Adding…")
                  : t("share.join", "Add to my decks")}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
