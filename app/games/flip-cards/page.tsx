"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import GamePage from "../_components/GamePage";
import DeckMessage from "../_components/DeckMessage";
import DeckLoading from "../_components/DeckLoading";
import NextLevelButton from "../_components/NextLevelButton";
import PackKeyCelebration, {
  PACK_COMPLETE_BUTTON_CLASS,
} from "../_components/PackKeyCelebration";
import { predictLevelCleared } from "../_lib/levelCompletion";
import { LANG_LABELS, type CefrLevel } from "@/app/_lib/languages";
import { withArticle } from "@/app/_lib/articles";
import { useLanguagePair } from "@/app/_lib/useLanguagePair";
import { useLearningLevelState } from "@/app/_lib/useLearningLevel";
import { fetchWordPairs } from "../_lib/wordPairs";
import {
  CONFIDENT_ANSWER_STEPS,
  LEGENDARY_PASS_PERCENT,
  LEGENDARY_REVIEW_SIZE,
} from "../_lib/deckSessionClient";
import { useDeckSession } from "../_hooks/useDeckSession";
import { spendEnergy } from "@/app/_lib/energy";
import { useEnergyBlocked } from "../_lib/energyGate";
import OutOfEnergy from "../_components/OutOfEnergy";
import { useVocabProgress } from "../_lib/useVocabProgress";
import { useTopicLevel } from "../_hooks/useTopicLevel";
import { usePackCompleted } from "../_hooks/usePackCompleted";
import { useAuthState } from "@/app/_lib/auth";
import {
  Check,
  Crown,
  KeyRound,
  Sparkles,
  RefreshCw,
  ArrowLeftRight,
} from "lucide-react";

const DECK_SIZE = 15;
const SWIPE_THRESHOLD = 110;
const TAP_TOLERANCE = 8;
const GATE = {
  name: "Flip Cards",
  description:
    "A calm, self-paced flashcard deck. Tap a card to flip between your language and the translation, then swipe right if you knew it or left to keep practicing it.",
  bgImage: "flip_cards.webp",
};

interface CardWord {
  id: string;
  native: string;
  foreign: string;
  /**
   * Shown on the answer face, never graded. This game is self-graded — you
   * swipe on whether you knew it — so the article is here to be learned
   * alongside the word rather than tested.
   */
  article: string | null;
}

function shuffleArray<T>(items: T[]): T[] {
  const cloned = [...items];
  for (let i = cloned.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }
  return cloned;
}

type Verdict = "known" | "practice";

const FlipCardsPage = () => {
  const searchParams = useSearchParams();
  const { isSignedIn, isReady, signIn } = useAuthState();
  const energyBlocked = useEnergyBlocked();

  const deckId = searchParams.get("deck") ?? "";
  const sessionMode =
    searchParams.get("mode") === "finish" ? "finish" : "practice";

  const {
    topicId,
    level: topicLevelNumber,
    deckLevel,
    backHref,
    markComplete,
    isLegendaryRound,
    submitLegendaryResults,
  } = useTopicLevel(deckId);

  const deckSession = useDeckSession(
    deckId || null,
    sessionMode,
    deckLevel,
    isLegendaryRound ? LEGENDARY_REVIEW_SIZE : undefined,
  );

  const { speak, learning } = useLanguagePair();
  // Bumped to pull a fresh set of cards for the same pair.
  const [reshuffleToken, setReshuffleToken] = useState(0);
  const vocabProgress = useVocabProgress();
  const { level: learningLevel, status: levelStatus } =
    useLearningLevelState(learning);
  // The player sees a level number; the word pool still needs a difficulty.
  const level: CefrLevel = learningLevel?.wordDifficulty ?? "A1";
  // Fetching before the level resolves would deal everyone an A1 round and then
  // swap the cards out from under them once their real level arrived.
  const levelPending = levelStatus === "loading";
  // Only meaningful off the deck path, where the cards come from the corpus.
  const [cardsLoading, setCardsLoading] = useState(true);

  // Whether the review round took the crown is the server's call, not this
  // screen's: the verdicts go up and come back graded. The percentage below is
  // only what the player watches while that happens.
  const [legendaryVerdict, setLegendaryVerdict] = useState<
    "unplayed" | "grading" | "passed" | "failed"
  >("unplayed");
  const submittedRound = useRef(false);
  // One charge per pass through the cards, not per page visit — `resetPiles`
  // clears this, so replaying the ones you're still learning is another round
  // and costs another energy, like every other game's replay.
  const energySpent = useRef(false);

  const [deck, setDeck] = useState<CardWord[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<CardWord[]>([]);
  const [practice, setPractice] = useState<CardWord[]>([]);
  const [leaving, setLeaving] = useState<Verdict | null>(null);
  // Every word swiped "know it" since these cards were loaded. `known` is
  // emptied by a "review the ones you're learning" pass so the score reads for
  // that pass, but the level check has to count the whole visit — without this
  // a level finished across two passes looks unfinished and the Next level
  // button has to wait for the server to say otherwise.
  const [metWordIds, setMetWordIds] = useState<Set<string>>(new Set());

  // Drag state (kept in refs so pointer handlers stay stable).
  const [dragX, setDragX] = useState(0);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const moved = useRef(false);

  const resetPiles = () => {
    setIndex(0);
    setFlipped(false);
    setKnown([]);
    setPractice([]);
    setDragX(0);
    setLeaving(null);
    // A fresh round is a fresh attempt at the crown, and a fresh charge.
    submittedRound.current = false;
    energySpent.current = false;
    setLegendaryVerdict("unplayed");
  };

  // Non-deck path: pull cards for the chosen pair. Flip-cards is a recall
  // drill — the front shows your language, the back the one you're learning.
  useEffect(() => {
    if (deckId || levelPending) {
      return;
    }

    const controller = new AbortController();
    setCardsLoading(true);

    fetchWordPairs({
      speak,
      learning,
      direction: "recall",
      level,
      count: DECK_SIZE * 3,
      signal: controller.signal,
    })
      .then((pairs) => {
        setDeck(
          shuffleArray(
            pairs.map((pair) => ({
              id: pair.conceptId,
              native: pair.prompt,
              foreign: pair.answer,
              article: pair.answerArticle,
            })),
          ).slice(0, DECK_SIZE),
        );
        setMetWordIds(new Set());
        resetPiles();
        setCardsLoading(false);
      })
      .catch(() => {
        // An aborted fetch is a superseded one: the run that replaced it is
        // still loading, and saying otherwise would show its empty table.
        if (controller.signal.aborted) {
          return;
        }
        // Otherwise leave the deck empty; the existing empty state covers it.
        setCardsLoading(false);
      });

    return () => controller.abort();
  }, [deckId, speak, learning, level, levelPending, reshuffleToken]);

  /** Re-run the round using only the cards swiped into "still learning". */
  const replayPractice = () => {
    setDeck(shuffleArray(practice).slice(0, DECK_SIZE));
    resetPiles();
  };

  // Deck path: load the session's selected words.
  useEffect(() => {
    if (!deckId || !deckSession.session) {
      return;
    }
    setDeck(
      deckSession.session.words.map((word) => ({
        id: word.id,
        native: word.native,
        foreign: word.foreign,
        article: word.article,
      })),
    );
    setMetWordIds(new Set());
    resetPiles();
  }, [deckId, deckSession.session]);

  const currentCard = deck[index] ?? null;
  const finished = deck.length > 0 && index >= deck.length;

  // Topic levels: swiping through a round used to be enough on its own, so a
  // level read "Done" at 3 of 6 words. On the deck path an empty practice round
  // means there is nothing left to learn here; the topic page does the finer
  // check against the server's counts when you land back on it. Rounds without a
  // deck have nothing to check against, so there finishing still counts.
  const levelDone =
    Boolean(topicId) &&
    (deckId
      ? deckSession.status === "empty" && sessionMode === "practice"
      : finished);
  useEffect(() => {
    if (levelDone) {
      markComplete();
    }
  }, [levelDone, markComplete]);

  // The crown is scored, not sat through: 85% of the review round has to come
  // back "know it". Fall short and the pack stays as it was — the round can be
  // played again, and the answers counted toward the words either way.
  const answered = known.length + practice.length;
  const scorePercent = answered
    ? Math.round((known.length / answered) * 100)
    : 0;

  useEffect(() => {
    if (!isLegendaryRound || !finished || submittedRound.current) {
      return;
    }
    submittedRound.current = true;
    setLegendaryVerdict("grading");

    void submitLegendaryResults([
      ...known.map((card) => ({ deckWordId: card.id, correct: true })),
      ...practice.map((card) => ({ deckWordId: card.id, correct: false })),
    ]).then((passed) => setLegendaryVerdict(passed ? "passed" : "failed"));
  }, [finished, isLegendaryRound, known, practice, submitLegendaryResults]);

  // A pass through the cards costs one energy, like every other round. Charged
  // at the end rather than the start: a player who opens the deck and walks away
  // has practised nothing. `commitVerdict` only ever bumps the index, so there
  // is no end-of-round branch to put this in — `finished` plus a ref is the
  // guard against the effect firing twice on the results screen.
  useEffect(() => {
    if (!finished || energySpent.current) {
      return;
    }
    energySpent.current = true;
    void spendEnergy();
  }, [finished]);

  const legendaryPassed = legendaryVerdict === "passed";

  // Whether the swipes just finished the level, worked out from the session's
  // level-scoped snapshot rather than by asking the server once the round ends —
  // that answer arrives a round trip late and may not have the last swipes yet.
  // A right swipe is the word met; a left swipe is not.
  const session = deckSession.session;
  const levelCleared = useMemo(() => {
    if (!finished || !session || !topicId || isLegendaryRound) {
      return false;
    }
    return predictLevelCleared(session.summary, session.words, metWordIds);
  }, [finished, session, topicId, isLegendaryRound, metWordIds]);

  // The fifth level clearing finishes the pack, and a key comes with it. Said
  // here rather than left for the player to find on the way back.
  const packCompleted = usePackCompleted(
    topicId,
    topicLevelNumber,
    deckId,
    // `levelDone` covers the round that never happens: a level whose words are
    // all learned serves nothing, and that empty session is itself proof the
    // level is cleared.
    deckId ? levelCleared || levelDone : finished && !isLegendaryRound,
  );

  // On a topic level, cards swiped "still learning" are the thing to do next,
  // and the amber button above the row already offers exactly them — replaying
  // the whole lesson alongside it is only a way to lose that shorter path. It
  // comes back once nothing is left over. A failed legendary round is the one
  // case where running it all again is the point.
  const showRoundAgain = !(topicId && !isLegendaryRound && practice.length > 0);

  const remaining = Math.max(deck.length - index, 0);
  const progressPercent = deck.length
    ? Math.min((index / deck.length) * 100, 100)
    : 0;

  const commitVerdict = (verdict: Verdict) => {
    if (!currentCard || leaving) {
      return;
    }

    setLeaving(verdict);
    setDragX(verdict === "known" ? window.innerWidth : -window.innerWidth);

    if (verdict === "known") {
      setKnown((previous) => [...previous, currentCard]);
      setMetWordIds((previous) => new Set(previous).add(currentCard.id));
      if (deckId) {
        // A right swipe is a claim, not a tested answer — worth two practices,
        // so the second swipe is what earns mastery.
        deckSession.recordResult(currentCard.id, true, CONFIDENT_ANSWER_STEPS);
      } else {
        // Off-deck the card id *is* the concept id, so the same claim counts.
        vocabProgress.record(currentCard.id, true, CONFIDENT_ANSWER_STEPS);
      }
    } else {
      setPractice((previous) => [...previous, currentCard]);
      if (deckId) {
        // "Still learning" → a wrong attempt so the word resurfaces.
        deckSession.recordResult(currentCard.id, false);
      } else {
        vocabProgress.record(currentCard.id, false);
      }
    }

    window.setTimeout(() => {
      setIndex((previous) => previous + 1);
      setFlipped(false);
      setDragX(0);
      setLeaving(null);
    }, 260);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (leaving) {
      return;
    }
    dragging.current = true;
    moved.current = false;
    pointerStart.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || !pointerStart.current) {
      return;
    }
    const deltaX = event.clientX - pointerStart.current.x;
    const deltaY = event.clientY - pointerStart.current.y;
    if (Math.abs(deltaX) > TAP_TOLERANCE || Math.abs(deltaY) > TAP_TOLERANCE) {
      moved.current = true;
    }
    setDragX(deltaX);
  };

  const handlePointerUp = () => {
    if (!dragging.current) {
      return;
    }
    dragging.current = false;

    if (!moved.current) {
      // Treated as a tap: flip the card.
      setFlipped((previous) => !previous);
      setDragX(0);
      return;
    }

    if (dragX > SWIPE_THRESHOLD) {
      commitVerdict("known");
    } else if (dragX < -SWIPE_THRESHOLD) {
      commitVerdict("practice");
    } else {
      setDragX(0);
    }
  };

  if (energyBlocked) {
    return <OutOfEnergy {...GATE} />;
  }

  // Deck-path gating.
  if (deckId) {
    if ((isReady && !isSignedIn) || deckSession.status === "unauthorized") {
      return (
        <DeckMessage
          {...GATE}
          title="Sign in to practice this deck"
          body="Your progress is saved to your account."
          action={{ label: "Sign in", onClick: signIn }}
        />
      );
    }
    if (deckSession.status === "loading" || deckSession.status === "idle") {
      return <DeckLoading {...GATE} variant="cards" />;
    }
    if (deckSession.status === "notfound") {
      return (
        <DeckMessage {...GATE} title="Deck not found" backHref="/my-decks" />
      );
    }
    if (deckSession.status === "empty") {
      // A level with nothing left to serve is a level long since cleared, and it
      // can be the one that finishes the pack — so the key is handed over here
      // too rather than only on a results screen this round never reaches.
      return (
        <>
          <DeckMessage
            {...GATE}
            title={
              sessionMode === "finish"
                ? "No words to review yet"
                : topicId
                  ? `You've mastered every word in level ${topicLevelNumber}! 🎉`
                  : "You've mastered every word in this deck! 🎉"
            }
            body={
              topicId && sessionMode !== "finish"
                ? "Pick another level to keep going."
                : undefined
            }
            backHref={backHref}
            backLabel={
              topicId
                ? "Back to topic"
                : deckId
                  ? "Back to decks"
                  : "Back to games"
            }
            highlightBack={packCompleted}
          />
          {packCompleted && (
            <PackKeyCelebration
              topicId={topicId}
              level={topicLevelNumber}
              deckId={deckId}
            />
          )}
        </>
      );
    }
  } else if (cardsLoading) {
    return <DeckLoading {...GATE} variant="cards" />;
  }

  const rotation = dragX / 18;
  const swipeHint: Verdict | null =
    dragX > 40 ? "known" : dragX < -40 ? "practice" : null;

  return (
    <GamePage
      {...GATE}
      playing={!finished}
      exitHref={backHref}
      // These same cards from the top, which `resetPiles` already is — the
      // reload and the reshuffle next to it both fetch a *different* set, which
      // is a next round rather than a restart.
      onRestart={resetPiles}
    >
      {/* Deck name + progress bar */}
      <div className="w-full max-w-xl">
        {deckId && deckSession.session && (
          <p className="text-center text-sm font-semibold text-zinc-600 dark:text-zinc-300">
            {deckSession.session.deckName}
            {topicId && !isLegendaryRound ? ` · Level ${topicLevelNumber}` : ""}
            {sessionMode === "finish"
              ? isLegendaryRound
                ? " · Legendary round"
                : " · Challenge round"
              : ""}
          </p>
        )}

        <div
          className={`flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400 ${
            deckId ? "mt-5" : ""
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-emerald-500" />
            Known {known.length}
          </span>
          <span>{finished ? "Done" : `${remaining} left`}</span>
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            Still learning {practice.length}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {!finished && currentCard ? (
        <>
          {/* Card stack */}
          <div className="relative mt-6 flex h-80 w-full max-w-sm items-center justify-center perspective-distant">
            {/* Peek of the next card behind the current one */}
            {deck[index + 1] && (
              <div className="absolute h-72 w-full scale-95 rounded-3xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/60" />
            )}

            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{
                transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
                transition: dragging.current
                  ? "none"
                  : "transform 0.26s ease-out",
              }}
              className="absolute h-72 w-full cursor-grab touch-none select-none active:cursor-grabbing"
            >
              <div
                style={{
                  transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                  transformStyle: "preserve-3d",
                  transition: "transform 0.5s",
                }}
                className="relative h-full w-full"
              >
                {/* Front — native language */}
                <div
                  style={{ backfaceVisibility: "hidden" }}
                  className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border border-zinc-200 bg-white p-6 text-center shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <span className="absolute top-4 left-5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    Your language
                  </span>
                  <p className="text-4xl font-black text-zinc-900 dark:text-zinc-50">
                    {currentCard.native}
                  </p>
                  <span className="absolute bottom-4 inline-flex items-center gap-1.5 text-xs text-zinc-400">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Tap to flip
                  </span>
                </div>

                {/* Back — foreign language */}
                <div
                  style={{
                    backfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                  }}
                  className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border border-blue-200 bg-blue-50 p-6 text-center shadow-xl dark:border-blue-900 dark:bg-blue-950/40"
                >
                  <span className="absolute top-4 left-5 text-[11px] font-semibold uppercase tracking-wider text-blue-500/70">
                    {deckId ? "Translation" : LANG_LABELS[learning]}
                  </span>
                  <p className="text-4xl font-black text-blue-700 dark:text-blue-300">
                    {withArticle(currentCard.foreign, currentCard.article)}
                  </p>
                  <span className="absolute bottom-4 inline-flex items-center gap-1.5 text-xs text-blue-400">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Tap to flip back
                  </span>
                </div>
              </div>

              {/* Swipe direction hints */}
              {swipeHint === "known" && (
                <div className="pointer-events-none absolute left-5 top-5 -rotate-12 rounded-lg border-2 border-emerald-500 px-3 py-1 text-sm font-black uppercase tracking-wider text-emerald-500">
                  Know it
                </div>
              )}
              {swipeHint === "practice" && (
                <div className="pointer-events-none absolute right-5 top-5 rotate-12 rounded-lg border-2 border-amber-500 px-3 py-1 text-sm font-black uppercase tracking-wider text-amber-500">
                  Still learning
                </div>
              )}
            </div>
          </div>

          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-zinc-400">
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Swipe the card, or use the buttons below
          </p>

          {/* Action buttons */}
          <div className="mt-4 flex items-start justify-center gap-10">
            <div className="flex w-20 flex-col items-center gap-2">
              <button
                onClick={() => commitVerdict("practice")}
                aria-label="I'm still learning this one"
                className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-amber-500 bg-amber-50 text-amber-600 shadow-md transition hover:-translate-y-0.5 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/40"
              >
                <Sparkles className="h-7 w-7" />
              </button>
              <span className="text-xs font-medium text-zinc-400">
                Still learning
              </span>
            </div>
            <div className="flex w-20 flex-col items-center gap-2">
              <button
                onClick={() => commitVerdict("known")}
                aria-label="I know this one"
                className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-50 text-emerald-600 shadow-md transition hover:-translate-y-0.5 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
              >
                <Check className="h-7 w-7" />
              </button>
              <span className="text-xs font-medium text-zinc-400">Know it</span>
            </div>
          </div>
        </>
      ) : (
        finished && (
          <div className="mt-6 w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
            {packCompleted && (
              <PackKeyCelebration
                topicId={topicId}
                level={topicLevelNumber}
                deckId={deckId}
              />
            )}
            {isLegendaryRound ? (
              legendaryPassed ? (
                <p className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-amber-600 dark:text-amber-300">
                  <Crown className="h-4 w-4" />
                  This pack is now legendary
                </p>
              ) : legendaryVerdict === "grading" ? (
                <p className="text-sm font-bold uppercase tracking-wide text-zinc-500">
                  Scoring the round...
                </p>
              ) : (
                <p className="text-sm font-bold uppercase tracking-wide text-zinc-500">
                  {LEGENDARY_PASS_PERCENT}% needed for legendary
                </p>
              )
            ) : (
              <p className="text-sm uppercase tracking-wide text-zinc-500">
                Deck complete
              </p>
            )}
            <p
              className={`mt-2 text-4xl font-black ${
                isLegendaryRound && !legendaryPassed
                  ? "text-zinc-500 dark:text-zinc-400"
                  : "text-zinc-900 dark:text-zinc-50"
              }`}
            >
              {scorePercent}% known
            </p>
            {legendaryVerdict === "failed" && (
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Run the round again to take the crown.
              </p>
            )}
            <div className="mt-5 flex items-center justify-center gap-8 text-sm">
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <Check className="h-4 w-4" /> {known.length} known
              </span>
              <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <Sparkles className="h-4 w-4" /> {practice.length} still
                learning
              </span>
            </div>

            <div className="mt-7 flex flex-col gap-3">
              {practice.length > 0 && (
                <button
                  onClick={replayPractice}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-3 font-semibold text-white transition hover:bg-amber-400"
                >
                  <Sparkles className="h-4 w-4" />
                  Review the {practice.length} you&apos;re learning
                </button>
              )}

              {/* Same trio, in the same order, as the One of Three results:
                  back out, on to the next level once this one is finished, or
                  round again. */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                {/* Always rendered: a shuffled round has no deck, and without
                    this link its results screen had no way out. Once the pack
                    is done this is also the way to its key, so it trades the
                    plain dark button for the gold one. */}
                <Link
                  href={backHref}
                  className={
                    packCompleted
                      ? `${PACK_COMPLETE_BUTTON_CLASS} inline-flex items-center gap-2`
                      : "rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                  }
                >
                  {packCompleted && (
                    <>
                      <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-white/40 blur-md animate-[legendaryShimmer_2.6s_linear_infinite]" />
                      <KeyRound size={16} />
                    </>
                  )}
                  {topicId
                    ? "Back to topic"
                    : deckId
                      ? "Back to decks"
                      : "Back to games"}
                </Link>
                {deckId && topicId && !isLegendaryRound && (
                  <NextLevelButton
                    deckId={deckId}
                    topicId={topicId}
                    level={topicLevelNumber}
                    cleared={levelCleared}
                  />
                )}
                {showRoundAgain && (
                  <button
                    onClick={() =>
                      deckId
                        ? deckSession.reload()
                        : setReshuffleToken((value) => value + 1)
                    }
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {!deckId
                      ? "Shuffle a fresh deck"
                      : legendaryVerdict === "failed"
                        ? "Try the round again"
                        : topicId
                          ? "Replay lesson"
                          : "Next round"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      )}
    </GamePage>
  );
};

export default FlipCardsPage;
