"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Clock, Eye, XCircle } from "lucide-react";
import GamePage from "../_components/GamePage";
import DeckMessage from "../_components/DeckMessage";
import DeckLoading from "../_components/DeckLoading";
import { useLanguage } from "@/app/_lib/languageContext";
import type { Lang } from "@/app/_lib/languages";
import {
  completeTopicLevel,
  loadTopicsState,
  saveTopicsState,
} from "@/app/topics/_lib/topicsProgress";
import { useFallbackWords } from "../_lib/useFallbackWords";
import { CONFIDENT_ANSWER_STEPS } from "../_lib/deckSessionClient";
import {
  gainEnergy,
  spendEnergy,
  ENERGY_PRACTICE_REWARD,
} from "@/app/_lib/energy";
import { useEnergyBlocked } from "../_lib/energyGate";
import OutOfEnergy from "../_components/OutOfEnergy";
import { useDeckSession } from "../_hooks/useDeckSession";
import { useTopicLevel } from "../_hooks/useTopicLevel";
import { useVocabProgress } from "../_lib/useVocabProgress";
import { useAuthState } from "@/app/_lib/auth";
import { withArticle, withOptionalArticle } from "@/app/_lib/articles";
import { normalizeVocabText } from "@/app/api/decks/_lib/vocabIdentity";

interface PracticeWord {
  id: string;
  native: string;
  foreign: string;
  /** Article of `foreign`; null for words and languages that take none. */
  article: string | null;
}

// Shared by the round and its status screens so the hero copy never changes
// height between "loading" and the game itself.
const GATE = {
  name: "Speed Spelling",
  description:
    "Type the correct word before the timer runs out. Reach 70% to complete the lesson.",
  bgImage: "speed_spelling.webp",
};

/**
 * Whether the round requires the article to be typed.
 *
 * Remembered across rounds because it is a choice about how hard the player
 * wants the game to be, not a per-round setting. Default off: a player who has
 * never seen an article in this app should not suddenly be marked wrong for
 * leaving one out.
 */
const ARTICLE_MODE_KEY = "katchup-speed-spelling-articles-v1";

/**
 * Grades one typed answer.
 *
 * Compared on `normalizeVocabText`, the same rule the corpus uses to decide two
 * words are the same one — so what counts as a match here and what counts as a
 * match there cannot drift apart.
 *
 * A word with no article is graded exactly as it always was, in both modes.
 * With the toggle off the article is *permitted* but not required: the toggle
 * governs what is demanded, never what is accepted. With it on, a bare answer
 * comes back as `missingArticle` rather than plain wrong — being told which
 * half you missed is the whole reason the toggle is worth having.
 */
export function matchesTyped(
  typed: string,
  word: { foreign: string; article: string | null },
  requireArticle: boolean,
): { correct: boolean; missingArticle: boolean } {
  const answer = normalizeVocabText(typed);
  const bare = normalizeVocabText(word.foreign);

  if (!word.article) {
    return { correct: answer === bare, missingArticle: false };
  }

  const full = normalizeVocabText(`${word.article} ${word.foreign}`);

  if (!requireArticle) {
    return { correct: answer === bare || answer === full, missingArticle: false };
  }

  return { correct: answer === full, missingArticle: answer === bare };
}

const QUESTION_SECONDS = 12;
const MAX_WORDS = 10;
const CORRECT_ADVANCE_DELAY_MS = 700;
const REVEAL_ADVANCE_DELAY_MS = 2600;

function hashSeed(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function createSeededRandom(seed: string): () => number {
  let state = hashSeed(seed) || 1;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function shuffleWithSeed<T>(items: T[], seed: string): T[] {
  const random = createSeededRandom(seed);
  const cloned = [...items];

  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [cloned[index], cloned[swapIndex]] = [cloned[swapIndex], cloned[index]];
  }

  return cloned;
}

function buildRoundWords(words: PracticeWord[], seed: string): PracticeWord[] {
  const shuffled = shuffleWithSeed(words, seed);
  return shuffled.slice(0, Math.min(MAX_WORDS, shuffled.length));
}

const SpeedSpellingPage = () => {
  const searchParams = useSearchParams();
  const { language } = useLanguage();
  const { isSignedIn, isReady, signIn } = useAuthState();

  const deckId = searchParams.get("deck") ?? "";
  const topicId = searchParams.get("topicId") ?? "";
  const level = Number(searchParams.get("level") ?? "1");
  const safeLevel = Number.isFinite(level)
    ? Math.max(1, Math.min(5, level))
    : 1;
  const isEnergyReview = searchParams.get("energyReview") === "1";
  const sessionMode =
    searchParams.get("mode") === "finish" ? "finish" : "practice";

  const [attempt, setAttempt] = useState(0);
  const [restartToken, setRestartToken] = useState(0);
  const [knownWords, setKnownWords] = useState<PracticeWord[]>([]);

  // Scopes a topic round to its level's slice of the deck; undefined for a
  // custom deck, which has no level ladder and draws from the whole thing.
  const { deckLevel } = useTopicLevel(deckId);
  const deckSession = useDeckSession(deckId || null, sessionMode, deckLevel);
  const vocabProgress = useVocabProgress();

  // Fetch the user's known words from the DB for energy-practice.
  useEffect(() => {
    if (!isEnergyReview || deckId) return;
    let cancelled = false;
    fetch("/api/decks/energy-practice")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { words: Array<Omit<PracticeWord, "article"> & { article?: string | null }> } | null) => {
        if (!cancelled && data?.words) {
          setKnownWords(
            data.words.map((word) => ({ ...word, article: word.article ?? null })),
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isEnergyReview, deckId, attempt]);

  // The energy round is the way back from empty, so it is never blocked by it.
  const energyBlocked = useEnergyBlocked(isEnergyReview);

  const { words: allWords, isLoading: wordsLoading } = useFallbackWords();
  const roundSeed = `${topicId || "default"}:${safeLevel}:speed-spelling:${attempt}`;

  const words = useMemo<PracticeWord[]>(() => {
    if (deckId) {
      return (deckSession.session?.words ?? []).map((word) => ({
        id: word.id,
        native: word.native,
        foreign: word.foreign,
        article: word.article,
      }));
    }
    // Energy review: use the user's known words from DB.
    if (isEnergyReview && knownWords.length > 0) {
      return knownWords;
    }
    return buildRoundWords(allWords, roundSeed);
  }, [
    deckId,
    deckSession.session,
    isEnergyReview,
    knownWords,
    allWords,
    roundSeed,
  ]);

  if (energyBlocked) {
    return <OutOfEnergy {...GATE} />;
  }

  // Deck path: gate on auth/session status before rendering the round.
  if (deckId) {
    const gate = GATE;
    if ((isReady && !isSignedIn) || deckSession.status === "unauthorized") {
      return (
        <DeckMessage
          {...gate}
          title="Sign in to practice this deck"
          body="Your progress is saved to your account."
          action={{ label: "Sign in", onClick: signIn }}
        />
      );
    }
    if (deckSession.status === "loading" || deckSession.status === "idle") {
      return <DeckLoading {...gate} variant="type" />;
    }
    if (deckSession.status === "notfound") {
      return (
        <DeckMessage {...gate} title="Deck not found" backHref="/my-decks" />
      );
    }
    if (deckSession.status === "empty") {
      return (
        <DeckMessage
          {...gate}
          title={
            sessionMode === "finish"
              ? "No hard words to review yet"
              : "You've mastered every word in this deck! 🎉"
          }
          body={
            sessionMode === "finish"
              ? "Practice some rounds first, then the toughest words show up here."
              : "Nothing left to practice right now."
          }
          backHref="/my-decks"
          backLabel={deckId ? "Back to decks" : undefined}
        />
      );
    }
  } else if (wordsLoading) {
    // Without a deck the words come from the corpus, and a round built before
    // they land has nothing to ask.
    return <DeckLoading {...GATE} variant="type" />;
  }

  return (
    <SpeedSpellingRound
      // Keyed on the words themselves so a set that arrives late — a language
      // switch, an energy round's own fetch — starts the round over rather than
      // dropping new words into a timer that is already running.
      //
      // `restartToken` is in the key for the opposite reason: a restart keeps
      // the same words, so without it nothing about the key would change and
      // the round would carry on from where it was.
      key={
        deckId
          ? `deck:${deckId}:${sessionMode}:${words.map((w) => w.id).join(",")}:r${restartToken}`
          : `${roundSeed}:${words.map((w) => w.id).join(",")}:r${restartToken}`
      }
      words={words}
      deckId={deckId}
      sessionMode={sessionMode}
      topicId={topicId}
      safeLevel={safeLevel}
      language={language}
      isEnergyReview={isEnergyReview}
      // Off-deck the word id *is* the concept id, so the same answer counts.
      onResult={
        deckId
          ? deckSession.recordResult
          : // The energy round replays words the player already owns, and its ids
            // are deck words rather than concepts — nothing new to record.
            isEnergyReview
            ? undefined
            : vocabProgress.record
      }
      // Two different things, which used to be one: "next round" fetches a new
      // selection — the words you just learned drop out and new ones come in —
      // while "restart" replays this very round from the top.
      onReplay={() => {
        if (deckId) {
          deckSession.reload();
        } else {
          setAttempt((value) => value + 1);
        }
      }}
      onRestart={() => setRestartToken((value) => value + 1)}
    />
  );
};

interface SpeedSpellingRoundProps {
  words: PracticeWord[];
  deckId: string;
  sessionMode: "practice" | "finish";
  topicId: string;
  safeLevel: number;
  language: Lang;
  isEnergyReview: boolean;
  onResult?: (deckWordId: string, correct: boolean, steps?: number) => void;
  /** A fresh selection of words. */
  onReplay: () => void;
  /** These same words, from the top. */
  onRestart: () => void;
}

function SpeedSpellingRound(props: SpeedSpellingRoundProps) {
  const {
    words,
    deckId,
    sessionMode,
    topicId,
    safeLevel,
    language,
    isEnergyReview,
    onResult,
    onReplay,
    onRestart,
  } = props;

  // A word you got wrong comes back once before the round is over: seeing the
  // answer and then never typing it is how a miss stays a miss. The queue is
  // what grows, so the words themselves stay the round's scored population.
  const { t } = useLanguage();
  const [queue, setQueue] = useState<PracticeWord[]>(words);
  const [questionIndex, setQuestionIndex] = useState(0);
  // Scored once per word, whichever pass earns it, so a word rescued on its
  // replay still counts — and getting it right twice doesn't count twice.
  const [correctIds, setCorrectIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [typedValue, setTypedValue] = useState("");
  // Read in an effect rather than a useState initializer: the initializer runs
  // during the server render too, where there is no localStorage, and the
  // markup it produces would not match the client's.
  const [requireArticle, setRequireArticle] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_SECONDS);
  const [isLocked, setIsLocked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [banner, setBanner] = useState<{
    tone: "good" | "bad";
    text: string;
  } | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [lessonPassed, setLessonPassed] = useState(false);
  const [paused, setPaused] = useState(false);

  const completionSaved = useRef(false);
  const lockedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Seconds still owed on this question, so a pause doesn't spend them. */
  const remainingRef = useRef(QUESTION_SECONDS);
  // Ids already sent back for a second go, so a word can be replayed at most
  // once and the round can't be extended forever by missing the same word.
  const requeuedRef = useRef<Set<string>>(new Set());

  const currentWord = queue[questionIndex] ?? null;
  const totalWords = words.length;
  const correctCount = correctIds.size;
  const progressPercent =
    queue.length > 0 ? Math.round((questionIndex / queue.length) * 100) : 0;
  const scorePercent =
    totalWords > 0 ? Math.round((correctCount / totalWords) * 100) : 0;
  const isReplayQuestion = questionIndex >= totalWords;

  const finish = (finalCorrect: number) => {
    const finalScore =
      totalWords > 0 ? Math.round((finalCorrect / totalWords) * 100) : 0;
    const passed = finalScore >= 70;

    if (isEnergyReview) {
      void gainEnergy(ENERGY_PRACTICE_REWARD);
    } else {
      void spendEnergy(1);
    }
    setLessonPassed(passed);
    setIsFinished(true);

    if (
      passed &&
      topicId &&
      !deckId &&
      !completionSaved.current &&
      totalWords > 0
    ) {
      const state = loadTopicsState(language);
      const { nextState } = completeTopicLevel(state, topicId, safeLevel);
      saveTopicsState(language, nextState);
      completionSaved.current = true;
    }
  };

  const goToNext = (nextCorrect: number, extraQuestions: number) => {
    const nextIndex = questionIndex + 1;

    if (nextIndex >= queue.length + extraQuestions) {
      finish(nextCorrect);
      return;
    }

    lockedRef.current = false;
    setIsLocked(false);
    setRevealed(false);
    setQuestionIndex(nextIndex);
  };

  const advance = (wasCorrect: boolean, reason?: "timeout" | "shown") => {
    if (lockedRef.current) {
      return;
    }

    lockedRef.current = true;
    setIsLocked(true);

    const word = currentWord;
    let nextCorrect = correctCount;
    let extraQuestions = 0;

    if (word) {
      // Both paths record. Off-deck the word id is the concept id, so an answer
      // here counts toward the word itself just as a deck round would. Typing a
      // word out from memory is the hardest thing any of the games ask for, so a
      // hit here is worth the same two practices as swiping a flip card right.
      onResult?.(word.id, wasCorrect, wasCorrect ? CONFIDENT_ANSWER_STEPS : 1);

      if (wasCorrect) {
        if (!correctIds.has(word.id)) {
          nextCorrect += 1;
          setCorrectIds((previous) => new Set(previous).add(word.id));
        }
      } else if (!requeuedRef.current.has(word.id)) {
        requeuedRef.current.add(word.id);
        extraQuestions = 1;
        setQueue((previous) => [...previous, word]);
      }
    }

    // A miss ends with the word on screen either way — asked for with Show, or
    // out of time. Being told only that you were wrong teaches nothing, and the
    // word still comes back on its replay to be typed properly.
    if (!wasCorrect) {
      setRevealed(true);
    }

    // The banner itself never spells the answer out; that is the reveal's job,
    // in its own reserved line above.
    setBanner(
      wasCorrect
        ? { tone: "good", text: "Correct!" }
        : reason === "shown"
          ? null
          : { tone: "bad", text: "Time's up" },
    );

    window.setTimeout(
      () => goToNext(nextCorrect, extraQuestions),
      wasCorrect ? CORRECT_ADVANCE_DELAY_MS : REVEAL_ADVANCE_DELAY_MS,
    );
  };

  // Giving up on purpose: the translation is shown and the word is treated as
  // missed, which also books it in for its replay later in the round.
  const handleShow = () => {
    if (!currentWord || lockedRef.current) {
      return;
    }
    advance(false, "shown");
  };

  // A fresh question gets the full clock and an empty box. Separate from the
  // ticking below so that pausing and resuming restarts the interval without
  // also handing the player their time back.
  useEffect(() => {
    remainingRef.current = QUESTION_SECONDS;
    setSecondsLeft(QUESTION_SECONDS);
    setTypedValue("");
    setBanner(null);
    setRevealed(false);
  }, [questionIndex]);

  useEffect(() => {
    if (isFinished || !currentWord || paused) {
      return;
    }

    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
    const budget = remainingRef.current;
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, budget - elapsed);
      remainingRef.current = remaining;
      setSecondsLeft(remaining);

      if (remaining <= 0) {
        window.clearInterval(interval);
        advance(false, "timeout");
      }
    }, 200);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(focusTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIndex, isFinished, paused]);

  useEffect(() => {
    try {
      setRequireArticle(
        window.localStorage.getItem(ARTICLE_MODE_KEY) === "on",
      );
    } catch {
      // A blocked localStorage just means the choice isn't remembered.
    }
  }, []);

  // Dead chrome otherwise: a Czech deck, or a round of nothing but verbs, has
  // no article to ask for and should look exactly as it did before.
  const roundHasArticles = words.some((word) => Boolean(word.article));

  const chooseArticleMode = (next: boolean) => {
    setRequireArticle(next);
    try {
      window.localStorage.setItem(ARTICLE_MODE_KEY, next ? "on" : "off");
    } catch {
      // As above — the round still plays, the choice just isn't kept.
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTypedValue(event.target.value);
    if (banner) {
      setBanner(null);
    }
  };

  const handleSubmit = () => {
    if (!currentWord || lockedRef.current || typedValue.trim().length === 0) {
      return;
    }

    const { correct, missingArticle } = matchesTyped(
      typedValue,
      currentWord,
      requireArticle,
    );

    if (correct) {
      advance(true);
      return;
    }

    // Naming the missing half is what makes the toggle teach something rather
    // than just being harder.
    setBanner({
      tone: "bad",
      text: missingArticle
        ? t("games.speedSpellingNeedArticle", "Don't forget the article")
        : t("games.speedSpellingNotQuite", "Not quite, keep trying"),
    });
  };

  const backHref = deckId
    ? "/my-decks"
    : topicId
      ? `/topics/${encodeURIComponent(topicId)}`
      : "/games";
  const backLabel = deckId
    ? "Back to decks"
    : topicId
      ? "Back to topic"
      : "Back to games";

  const headerLabel = deckId
    ? sessionMode === "finish"
      ? "Challenge Round"
      : "Custom Deck"
    : `Lesson ${safeLevel}`;

  return (
    <GamePage
      {...GATE}
      playing={!isFinished}
      exitHref={backHref}
      onRestart={onRestart}
      onPauseChange={setPaused}
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
        <div className="bg-linear-to-r from-sky-300 via-cyan-300 to-teal-300 p-5 dark:from-sky-700 dark:via-cyan-700 dark:to-teal-700">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-700 dark:text-sky-100">
            {headerLabel}
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            Type the Translation
          </h2>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-100">
            Progress {progressPercent}%
          </p>
          <div className="mt-2 h-2 rounded-full bg-white/50">
            <div
              className="h-full rounded-full bg-slate-900 transition-all dark:bg-white"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {!isFinished && currentWord && (
            <>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center dark:border-slate-800 dark:bg-slate-900/70">
                <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  <Clock className="h-4 w-4" />
                  <span>{secondsLeft}s left</span>
                </div>
                <div className="mx-auto mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-200 ease-linear ${
                      secondsLeft <= 3 ? "bg-rose-500" : "bg-sky-500"
                    }`}
                    style={{
                      width: `${(secondsLeft / QUESTION_SECONDS) * 100}%`,
                    }}
                  />
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {isReplayQuestion ? "One more go" : "Type this word"}
                  </p>
                  {/* Only when the round actually holds an article to ask for,
                      so a Czech or verb-heavy round has no dead chrome. */}
                  {roundHasArticles && (
                    <div className="flex shrink-0 items-center gap-1 rounded-full border border-slate-200 p-0.5 dark:border-slate-700">
                      {([false, true] as const).map((mode) => (
                        <button
                          key={String(mode)}
                          type="button"
                          onClick={() => chooseArticleMode(mode)}
                          aria-pressed={requireArticle === mode}
                          className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition ${
                            requireArticle === mode
                              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                          }`}
                        >
                          {mode
                            ? t("games.speedSpellingArticlesOn", "With article")
                            : t("games.speedSpellingArticlesOff", "Word only")}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="mt-2 text-4xl font-black text-slate-900 dark:text-slate-100">
                  {currentWord.native}
                </p>
                {/* Always in the layout, empty until Show is pressed. Rendering
                    it conditionally grew the card by a line at the exact moment
                    the player is reading it, which shoved the input and the
                    buttons down the page under their own cursor. */}
                <p
                  aria-live="polite"
                  className="mt-3 h-8 text-2xl font-black text-sky-600 dark:text-sky-400"
                >
                  {revealed
                    ? requireArticle
                      ? withArticle(currentWord.foreign, currentWord.article)
                      : withOptionalArticle(
                          currentWord.foreign,
                          currentWord.article,
                        )
                    : ""}
                </p>
              </div>

              <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row">
                <input
                  ref={inputRef}
                  type="text"
                  value={typedValue}
                  onChange={handleChange}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleSubmit();
                    }
                  }}
                  disabled={isLocked}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder="Start typing..."
                  className="w-full flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-lg font-semibold text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-200 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-600"
                />
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLocked || typedValue.trim().length === 0}
                  className="w-full rounded-2xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 sm:w-auto"
                >
                  Check
                </button>
              </div>

              {/* Reserved for the same reason as the revealed word above: this
                  line comes and goes on every answer, and letting it collapse
                  bounced everything below it. */}
              <p
                className={`mt-4 h-5 text-center text-sm font-semibold ${
                  banner?.tone === "good"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {banner?.text ?? ""}
              </p>

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Correct answers: {correctCount}/{totalWords}
                </p>
                <button
                  type="button"
                  onClick={handleShow}
                  disabled={isLocked}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Show
                </button>
              </div>
            </>
          )}

          {!isFinished && !currentWord && (
            <p className="text-center text-slate-600 dark:text-slate-300">
              No words available for this round yet.
            </p>
          )}

          {isFinished && (
            <div className="text-center">
              <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100">
                {lessonPassed ? "Lesson completed" : "Try once more"}
              </h3>
              <p className="mt-3 text-slate-600 dark:text-slate-300">
                Score: {scorePercent}% ({correctCount}/{totalWords})
              </p>
              <div className="mt-2 flex items-center justify-center gap-2 text-sm font-semibold">
                {lessonPassed ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-700 dark:text-emerald-300">
                      Passed
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                    <span className="text-rose-700 dark:text-rose-300">
                      Failed
                    </span>
                  </>
                )}
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href={backHref}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  {backLabel}
                </Link>
                {/* The challenge round is offered on the deck card now, where
                    it can be found without playing a round first. */}
                <button
                  type="button"
                  onClick={onReplay}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
                >
                  Next round
                </button>
                {/* The quieter of the two: most people want the next words, not
                    these ones over again. */}
                <button
                  type="button"
                  onClick={onRestart}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Restart
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </GamePage>
  );
}

export default SpeedSpellingPage;
