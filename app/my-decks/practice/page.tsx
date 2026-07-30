"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useLanguage } from "../../_lib/languageContext";
import {
  ApiError,
  DeckProgressSummary,
  DeckWithWords,
  fetchDeckProgress,
  getDeck,
} from "../../games/_lib/deckSessionClient";
import DeckProgress from "@/app/_components/DeckProgress";
import SyncStatusBadge from "@/app/_components/SyncStatusBadge";
import { useAccountKey } from "@/app/_lib/offline/useOffline";
import {
  getOfflineDeckRecord,
  readOfflineProgress,
} from "@/app/_lib/offline/offlineDecks";

const GAME_MODE_IDS = [
  {
    id: "flip-cards",
    icon: "🃏",
    tKey: "games.flipCards",
    descKey: "games.flipCardsDesc",
  },
  {
    id: "one-of-three",
    icon: "🎯",
    tKey: "games.oneOfThree",
    descKey: "games.oneOfThreeDesc",
  },
  {
    id: "guess-match",
    icon: "🔗",
    tKey: "games.guessMatch",
    descKey: "games.guessMatchDesc",
  },
  {
    id: "speed-spelling",
    icon: "⚡",
    tKey: "games.speedSpelling",
    descKey: "games.speedSpellingDesc",
  },
];

/** A grey bar standing in for a line of text that has not arrived yet. */
function SkeletonLine({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded bg-slate-200 dark:bg-slate-800 ${className}`}
    />
  );
}

/**
 * The launcher, drawn from the URL alone.
 *
 * Everything you came here to press — the four game cards — is decided by the
 * deck id and the mode in the query string, both of which are known the instant
 * the page mounts. So the page draws itself straight away and lets the deck's
 * name, its progress bar and its word count fill in underneath, rather than
 * holding a "Loading…" card in front of the whole thing and then replacing it
 * with a taller layout once the fetch lands.
 */
function PracticeShell({
  deckId,
  isChallenge,
  deck,
  progress,
}: {
  deckId: string;
  isChallenge: boolean;
  deck: DeckWithWords | null;
  progress: DeckProgressSummary | null;
}) {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <Link
              href="/my-decks"
              className="mb-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              ← {t("practice.backToDecks")}
            </Link>
            {/* The amber flag matches the button on the deck card that leads
                here, so the two read as one feature rather than two. */}
            {isChallenge && (
              <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                🏁 {t("practice.finishRound", "Challenge Round")}
              </p>
            )}
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 sm:text-4xl">
              {isChallenge
                ? t("practice.chooseChallengeMode", "Choose a challenge round")
                : t("practice.choosePracticeMode")}
            </h1>
            {isChallenge && (
              <p className="mt-2 font-medium text-amber-700 dark:text-amber-400">
                {t("practice.finishRoundDesc", "Twice the words, hardest first.")}
              </p>
            )}
            {/* Same box either way, so the heading above and the cards below
                stay put when the name lands. */}
            <div className="mt-2 flex h-6 items-center text-slate-600 dark:text-slate-300">
              {deck ? (
                <p>
                  {deck.name} ({deck.nativeLang} ↔ {deck.foreignLang})
                </p>
              ) : (
                <SkeletonLine className="h-4 w-56" />
              )}
            </div>
            {/* Downloading a deck lives on the deck card's menu, not here. This
                screen is one question — which game — and the sync badge is the
                only thing that still belongs beside it. It reads the device, not
                the deck, so it is outside the deck's arrival and cannot push the
                cards down when the fetch lands. */}
            <div className="mt-3 flex flex-wrap items-center gap-2 empty:mt-0">
              <SyncStatusBadge />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {GAME_MODE_IDS.map((mode) => {
            const cardClass = `group rounded-2xl border bg-white p-6 transition hover:shadow-lg dark:bg-slate-950 ${
              isChallenge
                ? "border-amber-200 hover:border-amber-400 dark:border-amber-900/60 dark:hover:border-amber-500"
                : "border-slate-200 hover:border-blue-400 dark:border-slate-800 dark:hover:border-blue-500"
            }`;
            const body = (
              <>
                <div className="text-4xl">{mode.icon}</div>
                <h2
                  className={`mt-4 text-xl font-bold text-slate-900 dark:text-slate-100 ${
                    isChallenge
                      ? "group-hover:text-amber-600 dark:group-hover:text-amber-400"
                      : "group-hover:text-blue-600 dark:group-hover:text-blue-400"
                  }`}
                >
                  {t(mode.tKey)}
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  {t(mode.descKey)}
                </p>
              </>
            );

            // Without a deck id there is nowhere to send you yet, so the card
            // holds its place but does not pretend to be a link.
            return deckId ? (
              <Link
                key={mode.id}
                href={`/games/${mode.id}?deck=${deckId}${
                  isChallenge ? "&mode=finish" : ""
                }`}
                className={cardClass}
              >
                {body}
              </Link>
            ) : (
              <div key={mode.id} className={cardClass} aria-hidden>
                {body}
              </div>
            );
          })}
        </div>

        {/* Progress keeps its box from the start. It arrives on its own fetch,
            and appearing late would otherwise shove the note below it down the
            page while you are reading it. */}
        {progress && progress.total > 0 ? (
          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
            <DeckProgress known={progress.known} total={progress.total} />
          </div>
        ) : deck ? null : (
          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
            <SkeletonLine className="h-4 w-full" />
          </div>
        )}

        <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex h-5 items-center text-sm text-slate-600 dark:text-slate-400">
            {deck ? (
              <p>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {t("practice.info")}:
                </span>{" "}
                {t("practice.deckHasWords")} {deck.words.length}{" "}
                {t("practice.chooseAMode")}
              </p>
            ) : (
              <SkeletonLine className="h-3 w-2/3" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PracticeModeSelector() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const deckId = searchParams.get("deck") ?? "";
  // Carried straight through to whichever game is picked. The mode belongs to
  // the round — `chooseSessionWords` reads it long before a game sees the words
  // — so this page only has to pass it along and say which one you're starting.
  const isChallenge = searchParams.get("mode") === "finish";
  const [deck, setDeck] = useState<DeckWithWords | null>(null);
  const [progress, setProgress] = useState<DeckProgressSummary | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound">(
    deckId ? "loading" : "notfound",
  );
  const accountKey = useAccountKey();

  useEffect(() => {
    if (!deckId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      // The downloaded copy first: this launcher is the way into every game, so
      // reaching it has to work without a network or the offline decks behind it
      // are unreachable.
      if (accountKey) {
        const local = await getOfflineDeckRecord(accountKey, deckId).catch(
          () => null,
        );
        if (cancelled) {
          return;
        }
        if (local) {
          setDeck({
            id: local.deckId,
            ownerUserId: null,
            kind: "custom",
            topicKey: null,
            name: local.name,
            nativeLang: local.nativeLang,
            foreignLang: local.foreignLang,
            wordCount: local.words.length,
            knownCount: 0,
            words: local.words,
          });
          setStatus("ready");

          const localProgress = await readOfflineProgress(accountKey, deckId);
          if (!cancelled && localProgress) {
            setProgress(localProgress);
          }
          return;
        }
      }

      fetchDeckProgress(deckId)
        .then((value) => {
          if (!cancelled) {
            setProgress(value);
          }
        })
        .catch(() => {
          // Non-critical: the launcher still works without the progress bar.
        });

      getDeck(deckId)
        .then((data) => {
          if (!cancelled) {
            setDeck(data.deck);
            setStatus("ready");
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setStatus("notfound");
            if (!(err instanceof ApiError)) {
              // network/parse error — treat as not found for the selector
            }
          }
        });
    })();

    return () => {
      cancelled = true;
    };
  }, [accountKey, deckId]);

  // Only a deck that genuinely is not there takes the screen away. While it is
  // still on its way the launcher is already usable, so there is nothing to
  // interrupt.
  if (status === "notfound") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <p className="text-slate-600 dark:text-slate-400">
            {t("practice.deckNotFound")}
          </p>
          <Link
            href="/my-decks"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            {t("practice.backToDecks")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PracticeShell
      deckId={deckId}
      isChallenge={isChallenge}
      deck={deck}
      progress={progress}
    />
  );
}

/**
 * The same shell again as the Suspense fallback, so the swap from fallback to
 * page is invisible: reading the query string suspends on the server, and
 * without this the boundary would fall back to blank and push the layout around
 * the moment it resolved.
 */
function PracticeFallback() {
  return (
    <PracticeShell deckId="" isChallenge={false} deck={null} progress={null} />
  );
}

export default function PracticePage() {
  return (
    <Suspense fallback={<PracticeFallback />}>
      <PracticeModeSelector />
    </Suspense>
  );
}
