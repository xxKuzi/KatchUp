"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "../_lib/languageContext";
import { useAuthState } from "../_lib/auth";
import {
  DeckMeta,
  ApiError,
  createDeck,
  listDecks,
} from "../games/_lib/deckSessionClient";
import {
  clearCachedDecks,
  readCachedDecks,
  writeCachedDecks,
} from "../games/_lib/deckCache";
import { Share2 } from "lucide-react";
import DeckProgress from "@/app/_components/DeckProgress";
import MasteryTip from "@/app/_components/MasteryTip";
import CardMenu, { MenuItem } from "@/app/_components/CardMenu";
import { OfflineDeckMenuItems } from "@/app/_components/OfflineDeckButton";
import SyncStatusBadge from "@/app/_components/SyncStatusBadge";
import ShareDeckDialog from "./_components/ShareDeckDialog";
import WordCountSelect from "./_components/WordCountSelect";
import { leaveDeck } from "./_lib/shareClient";
import { useOnlineStatus, useSyncStatus } from "../_lib/offline/useOffline";

/**
 * Words started but not finished: met at least once, not yet mastered. Clamped
 * because the two counts are gathered separately and an older cached deck may
 * carry no `clearedCount` at all.
 */
function inPractice(deck: DeckMeta): number {
  const cleared = Math.min(deck.clearedCount ?? 0, deck.wordCount);
  return Math.max(0, cleared - deck.knownCount);
}

export default function MyDecksOverview() {
  const { t, language, learningLanguage } = useLanguage();
  const { isSignedIn, isReady, signIn } = useAuthState();
  const online = useOnlineStatus();
  const { syncing, pending } = useSyncStatus();
  const [decks, setDecks] = useState<DeckMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  // The deck whose sharing dialog is open, if any.
  const [sharingDeck, setSharingDeck] = useState<DeckMeta | null>(null);

  // AI deck generation, mirroring the editor's panel.
  const [aiTopic, setAiTopic] = useState("");
  const [aiCount, setAiCount] = useState(20);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiRemaining, setAiRemaining] = useState<number | null>(null);
  const [aiLimit, setAiLimit] = useState(2);

  const refreshDecks = useCallback(async () => {
    const data = await listDecks({
      nativeLang: language,
      foreignLang: learningLanguage,
    });
    setDecks(data.decks);
    writeCachedDecks(language, learningLanguage, data.decks);
    return data.decks;
  }, [language, learningLanguage]);

  useEffect(() => {
    // Offline, "not signed in" usually means the session check could not reach
    // the server, not that anyone signed out. Showing the sign-in wall there
    // hides decks that are sitting on the device ready to practise, so the
    // cached list wins until the network is back to say otherwise.
    if (isReady && !isSignedIn && online) {
      setUnauthorized(true);
      setLoading(false);
      return;
    }
    if (!isSignedIn && online) {
      return;
    }

    if (!online) {
      const offlineDecks = readCachedDecks(language, learningLanguage);
      setDecks(offlineDecks ?? []);
      setUnauthorized(false);
      setLoading(false);
      return;
    }

    let cancelled = false;

    // Paint last visit's list right away and let the request correct it. The
    // counts move as you practise, so this is a head start, not the answer.
    const cached = readCachedDecks(language, learningLanguage);
    if (cached) {
      setDecks(cached);
      setUnauthorized(false);
    }
    setLoading(!cached);

    listDecks({ nativeLang: language, foreignLang: learningLanguage })
      .then((data) => {
        if (!cancelled) {
          setDecks(data.decks);
          setUnauthorized(false);
        }
        writeCachedDecks(language, learningLanguage, data.decks);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          // Someone else's decks must not sit on screen for the next account.
          clearCachedDecks();
          if (!cancelled) {
            setDecks([]);
            setUnauthorized(true);
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, isReady, online, language, learningLanguage]);

  // How many AI decks are still allowed today.
  useEffect(() => {
    if (!isSignedIn) {
      return;
    }
    let cancelled = false;
    fetch("/api/decks/generate")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.remaining === "number") {
          setAiRemaining(data.remaining);
          if (typeof data.limit === "number") setAiLimit(data.limit);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  const handleGenerateDeck = async (event: React.FormEvent) => {
    event.preventDefault();
    setAiError("");
    const topic = aiTopic.trim();
    if (!topic) {
      setAiError(t("myDecks.ai.enterTopic", "Enter a topic first."));
      return;
    }

    setAiLoading(true);
    try {
      const res = await fetch("/api/decks/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          nativeLang: language,
          foreignLang: learningLanguage,
          count: aiCount,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setAiError(
          data?.error ?? t("myDecks.ai.failed", "Failed to generate deck."),
        );
        if (typeof data?.remaining === "number") setAiRemaining(data.remaining);
        return;
      }

      const words = Array.isArray(data?.words)
        ? data.words
            .map((word: { native?: string; foreign?: string }) => ({
              native: (word.native ?? "").trim(),
              foreign: (word.foreign ?? "").trim(),
            }))
            .filter(
              (word: { native: string; foreign: string }) =>
                word.native && word.foreign,
            )
        : [];

      await createDeck({
        name: topic,
        nativeLang: language,
        foreignLang: learningLanguage,
        words,
      });
      await refreshDecks();
      setAiTopic("");
      if (typeof data?.remaining === "number") setAiRemaining(data.remaining);
    } catch {
      setAiError(
        t("myDecks.ai.failed", "Something went wrong. Please try again."),
      );
    } finally {
      setAiLoading(false);
    }
  };

  // Leaving only drops this user's access; the owner's deck is untouched.
  const handleLeaveDeck = async (deck: DeckMeta) => {
    const confirmed = window.confirm(
      t("share.confirmLeave", "Remove this shared deck from your list?"),
    );
    if (!confirmed) {
      return;
    }

    try {
      await leaveDeck(deck.id);
      await refreshDecks();
    } catch {
      // Nothing changed server-side, so the list on screen is still correct.
    }
  };

  const filteredDecks = useMemo(
    () =>
      decks.filter(
        (deck) =>
          deck.nativeLang.trim().toLowerCase() === language &&
          deck.foreignLang.trim().toLowerCase() === learningLanguage,
      ),
    [decks, language, learningLanguage],
  );

  const groupEntries = useMemo(() => {
    const groups = filteredDecks.reduce<Record<string, DeckMeta[]>>(
      (acc, deck) => {
        const key = `${deck.nativeLang} -> ${deck.foreignLang}`;
        (acc[key] ??= []).push(deck);
        return acc;
      },
      {},
    );
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredDecks]);

  // Shaped like a deck card so it sits in the grid as the first tile — top-left
  // on desktop — rather than as a separate panel above the decks.
  const aiCard = (
    <article className="flex flex-col rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900/60 dark:bg-violet-950/40">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          ✨ {t("myDecks.ai.title", "Generate with AI")}
        </h4>
        {aiRemaining !== null && (
          <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-900/60 dark:text-violet-200">
            {aiRemaining}/{aiLimit} {t("myDecks.ai.leftToday", "left today")}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        {t("myDecks.ai.description", "Describe a topic and let AI build the deck for you.")}
      </p>

      <form className="mt-4 space-y-3" onSubmit={handleGenerateDeck}>
        <input
          type="text"
          value={aiTopic}
          onChange={(event) => setAiTopic(event.target.value)}
          placeholder={t("myDecks.ai.placeholder", "e.g. Ordering food at a café")}
          maxLength={100}
          disabled={aiLoading}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <label className="flex items-center justify-between gap-3 text-sm font-medium text-slate-700 dark:text-slate-300">
          {t("myDecks.ai.words", "Words")}
          <WordCountSelect
            value={aiCount}
            onChange={setAiCount}
            disabled={aiLoading}
          />
        </label>
        {aiError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/60 dark:text-red-300">
            {aiError}
          </p>
        )}
        <button
          type="submit"
          disabled={aiLoading || aiRemaining === 0}
          className="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-violet-500 dark:hover:bg-violet-400"
        >
          {aiLoading
            ? t("myDecks.ai.generating", "Generating…")
            : aiRemaining === 0
              ? t("myDecks.ai.limitReached", "Daily limit reached")
              : t("myDecks.ai.generate", "Generate deck")}
        </button>
      </form>
    </article>
  );

  return (
    <div className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="first-section-static-glow rounded-2xl border border-slate-200 bg-white/90 p-6 dark:border-slate-800 dark:bg-slate-950/70 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            {t("common.welcome")}
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100 sm:text-4xl">
            {t("myDecks.title")}
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
            {t("myDecks.description")}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/my-decks/edit"
              className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
            >
              {t("myDecks.openDeckEditor")}
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {t("myDecks.customDecksByLanguages")}
            </h2>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <SyncStatusBadge />
              <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-3 py-1 text-center text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {filteredDecks.length} {t("common.totalDecks")}
              </span>
            </div>
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
            // Shaped like the grid it becomes, so the first visit settles into
            // place rather than jumping when the decks land.
            <div
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              role="status"
              aria-live="polite"
            >
              <span className="sr-only">{t("common.loading", "Loading…")}</span>
              {aiCard}
              {[0, 1, 2].map((key) => (
                <article
                  key={key}
                  className="animate-pulse rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="h-7 w-40 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="mt-2 h-5 w-24 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="mt-3 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800" />
                  <div className="mt-4 flex gap-2">
                    <div className="h-8 w-16 rounded-lg bg-slate-200 dark:bg-slate-800" />
                    <div className="h-8 w-20 rounded-lg bg-slate-200 dark:bg-slate-800" />
                  </div>
                </article>
              ))}
            </div>
          ) : groupEntries.length === 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {aiCard}
              <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
                {t("common.noDecksYet")}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {groupEntries.map(([languagePair, group], groupIndex) => (
                <div key={languagePair} className="space-y-3">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {languagePair}
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {groupIndex === 0 && aiCard}
                    {group.map((deck) => (
                      <article
                        key={deck.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                            {deck.name}
                          </h4>
                          {/* Sharing and downloading live here rather than in
                              the row below: they are things you do to a deck
                              once, and every button spent on them was a button
                              competing with the two you press every day. */}
                          <CardMenu
                            label={t("common.deckActions", "Deck actions")}
                            className="-mr-1 -mt-1"
                          >
                            {deck.role === "owner" && (
                              <MenuItem onClick={() => setSharingDeck(deck)}>
                                <Share2 className="h-4 w-4 shrink-0" />
                                {t("share.share", "Share")}
                              </MenuItem>
                            )}
                            {/* Custom decks only: a topic deck is topped up on
                                the server, so a copy of one here would go
                                stale. */}
                            {deck.kind === "custom" && (
                              <OfflineDeckMenuItems deckId={deck.id} />
                            )}
                          </CardMenu>
                        </div>
                        {/* Decks a friend shared say so, because the actions
                            below differ: no sharing on, no deleting of, and
                            sometimes no editing of someone else's deck. */}
                        {deck.role && deck.role !== "owner" && (
                          <p className="mt-1 text-xs font-semibold text-violet-700 dark:text-violet-300">
                            {t("share.sharedBy", "Shared by")}{" "}
                            {deck.ownerName ?? t("share.someone", "Someone")}
                            {deck.role === "viewer" &&
                              ` · ${t("share.roleViewerShort", "Can practise")}`}
                          </p>
                        )}
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                          {deck.wordCount} {t("common.words")}
                        </p>
                        {deck.wordCount > 0 && (
                          <DeckProgress
                            known={deck.knownCount}
                            total={deck.wordCount}
                            className="mt-3"
                          />
                        )}
                        <div className="mt-4 flex flex-wrap gap-2">
                          {deck.role !== "viewer" && (
                            <Link
                              href={`/my-decks/edit?deck=${deck.id}`}
                              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
                            >
                              {t("common.edit")}
                            </Link>
                          )}
                          <Link
                            href={`/my-decks/practice?deck=${deck.id}`}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900"
                          >
                            {t("common.practice")}
                          </Link>
                          {/* The long round, offered up front. It used to be
                              reachable only from a results screen, so you had
                              to play a round before you could find the one that
                              drills what you keep getting wrong.

                              Through the practice selector rather than straight
                              into a game: the mode belongs to the round, not to
                              one game, so the player picks which of the four
                              plays it. */}
                          {deck.wordCount > 0 && (
                            <Link
                              href={`/my-decks/practice?deck=${deck.id}&mode=finish`}
                              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 transition hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300 dark:hover:bg-amber-900"
                            >
                              🏁 {t("practice.finishRound", "Challenge round")}
                            </Link>
                          )}
                          {deck.role && deck.role !== "owner" && (
                            <button
                              type="button"
                              onClick={() => handleLeaveDeck(deck)}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              {t("share.leave", "Leave")}
                            </button>
                          )}
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

      {sharingDeck && (
        <ShareDeckDialog
          deckId={sharingDeck.id}
          deckName={sharingDeck.name}
          onClose={() => setSharingDeck(null)}
        />
      )}
    </div>
  );
}
