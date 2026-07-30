"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, KeyRound, XCircle } from "lucide-react";
import GamePage from "../_components/GamePage";
import DeckMessage from "../_components/DeckMessage";
import DeckLoading from "../_components/DeckLoading";
import NextLevelButton from "../_components/NextLevelButton";
import PackKeyCelebration, {
  PACK_COMPLETE_BUTTON_CLASS,
} from "../_components/PackKeyCelebration";
import { TOPIC_LEVEL_COUNT, useTopicLevel } from "../_hooks/useTopicLevel";
import { usePackCompleted } from "../_hooks/usePackCompleted";
import { useFallbackWords } from "../_lib/useFallbackWords";
import {
  hasAnonPlaysRemaining,
  recordAnonPlayUsed,
} from "../_lib/anonPlayGate";
import {
  isOnboardingRound,
  ONBOARDING_SIGN_UP_HREF,
} from "../_lib/onboardingRound";
import {
  applySelfReportCorrection,
  type SelfReportCorrection,
} from "@/app/_lib/selfReportedLevel";
import { spendEnergy } from "@/app/_lib/energy";
import { useEnergyBlocked } from "../_lib/energyGate";
import OutOfEnergy from "../_components/OutOfEnergy";
import { useDeckSession } from "../_hooks/useDeckSession";
import { useVocabProgress } from "../_lib/useVocabProgress";
import { predictLevelCleared } from "../_lib/levelCompletion";
import { useAuthState } from "@/app/_lib/auth";
import { useLanguage } from "@/app/_lib/languageContext";
import { siblingArticles, withArticle } from "@/app/_lib/articles";

/** How many times one missed word can come back inside a single round. */
const MAX_RETRIES_PER_WORD = 2;

/**
 * What a question is asking.
 *
 * "meaning" is the original: a native word, three foreign candidates. "article"
 * shows the noun and asks which article it takes — the one thing the app taught
 * nowhere, and the thing Czech grammar gives a learner no way to guess.
 */
type QuestionKind = "meaning" | "article";

/**
 * One button.
 *
 * An object rather than the bare string it used to be, because the label is no
 * longer unique: an article question offers "der Hund" / "die Hund" /
 * "das Hund", which differ by three characters and once collided as React keys.
 * `correct` travels with the option, so grading never compares rendered text.
 */
interface QuestionOption {
  key: string;
  label: string;
  correct: boolean;
}

interface Question {
  id: string;
  wordId: string;
  kind: QuestionKind;
  prompt: string;
  options: QuestionOption[];
}

interface SimpleWord {
  id: string;
  native: string;
  foreign: string;
  article: string | null;
}

const GATE = {
  name: "One of Three",
  description:
    "Pick the correct word from three options. Reach 70% to complete the lesson automatically.",
  bgImage: "one_of_three.webp",
};

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

function buildLessonWords(words: SimpleWord[], seed: string): SimpleWord[] {
  const shuffled = shuffleWithSeed(words, `${seed}:lesson`);
  return shuffled.slice(0, Math.min(10, shuffled.length));
}

/**
 * Keys a shuffled set of options by position.
 *
 * `correct` is decided before the shuffle and carried on the object, so nothing
 * here ever grades by comparing rendered text — which is the rule that lets an
 * article question offer three labels that differ by three characters.
 */
function keyOptions(options: Array<{ label: string; correct: boolean }>) {
  return options.map((option, index) => ({
    ...option,
    key: `${index}:${option.label}`,
  }));
}

/** At most this many of a round's questions ask for an article. */
const MAX_ARTICLE_QUESTIONS = 3;

/**
 * Which words this round asks the article of.
 *
 * Deliberately not an independent roll per word: a round of ten German nouns
 * would then come out nearly all article questions, and the game would stop
 * being the one it says it is. Scoring every eligible word and taking the top
 * few keeps the proportion fixed, and keeps it seeded — a replayed round is
 * byte-identical to the first.
 *
 * Never the first word: opening on the odd task reads as the wrong game.
 */
function pickArticleWordIds(
  lessonWords: SimpleWord[],
  seed: string,
): Set<string> {
  const quota = Math.min(
    MAX_ARTICLE_QUESTIONS,
    Math.floor(lessonWords.length / 3),
  );
  if (quota <= 0) {
    return new Set();
  }

  const eligible = lessonWords
    .map((word, index) => ({ word, index }))
    .filter(
      ({ word, index }) =>
        index > 0 && Boolean(word.article) && siblingArticles(word.article!).length > 0,
    )
    .map(({ word }) => ({
      id: word.id,
      score: createSeededRandom(`${seed}:${word.id}:kind`)(),
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, quota);

  return new Set(eligible.map((entry) => entry.id));
}

function buildQuestions(
  lessonWords: SimpleWord[],
  distractorPool: Array<{ text: string; article: string | null }>,
  seed: string,
): Question[] {
  const articleWordIds = pickArticleWordIds(lessonWords, seed);

  return lessonWords.map((word, index) => {
    const id = `${word.id}-${index}`;

    if (articleWordIds.has(word.id)) {
      // The same noun three times over, differing only in the article. Options
      // stay capped at three, so Spanish "los" offers el/la alongside it.
      const candidates = [word.article!, ...siblingArticles(word.article!)].slice(
        0,
        3,
      );
      return {
        id,
        wordId: word.id,
        kind: "article" as const,
        prompt: word.foreign,
        options: keyOptions(
          shuffleWithSeed(
            candidates.map((article) => ({
              label: withArticle(word.foreign, article),
              correct: article === word.article,
            })),
            `${seed}:${word.id}:articleOptions`,
          ),
        ),
      };
    }

    const distractors = shuffleWithSeed(
      // Compared on the bare text: an article on the answer must not turn a
      // word that is genuinely the same into a usable distractor.
      distractorPool.filter((candidate) => candidate.text !== word.foreign),
      `${seed}:${word.id}:distractors`,
    ).slice(0, 2);

    return {
      id,
      wordId: word.id,
      kind: "meaning" as const,
      prompt: word.native,
      options: keyOptions(
        shuffleWithSeed(
          [
            { label: withArticle(word.foreign, word.article), correct: true },
            ...distractors.map((candidate) => ({
              label: withArticle(candidate.text, candidate.article),
              correct: false,
            })),
          ],
          `${seed}:${word.id}:options`,
        ),
      ),
    };
  });
}

const OneOfThreePage = () => {
  const searchParams = useSearchParams();
  const { isSignedIn, isReady, signIn } = useAuthState();

  const deckId = searchParams.get("deck") ?? "";
  const sessionMode =
    searchParams.get("mode") === "finish" ? "finish" : "practice";

  // The one free round a signed-out visitor is sent here for, straight off the
  // setup modal. Signing in ends it: someone who comes back through the sign-up
  // link is a player with an account, and gets the ordinary round.
  const onboarding = isOnboardingRound(searchParams) && isReady && !isSignedIn;

  // Whether the free round was still going spare when this page was opened.
  // Snapshotted rather than read live: finishing the round spends it, and a
  // live read would replace the results screen with the sign-up wall the moment
  // the last answer landed. Re-evaluated on the next mount, which is what makes
  // the back button out of the sign-up page land here rather than on a second
  // free round.
  const [freeRoundAvailable] = useState(() =>
    typeof window === "undefined" ? true : hasAnonPlaysRemaining(),
  );

  const {
    topicId,
    level: safeLevel,
    deckLevel,
    backHref,
    markComplete,
  } = useTopicLevel(deckId);

  const [attempt, setAttempt] = useState(0);
  const [restartToken, setRestartToken] = useState(0);

  // The free round is what a visitor is being taught with, so the meter never
  // stands in its way — and a signed-out visitor is not metered anyway.
  const energyBlocked = useEnergyBlocked(onboarding);

  const deckSession = useDeckSession(deckId || null, sessionMode, deckLevel);
  const vocabProgress = useVocabProgress();

  // Nothing left in this level's slice means it is already fully mastered, so
  // the level should read as done rather than staying "Pending" forever.
  const levelAlreadyMastered =
    deckSession.status === "empty" && sessionMode === "practice";
  useEffect(() => {
    if (levelAlreadyMastered) {
      markComplete();
    }
  }, [levelAlreadyMastered, markComplete]);

  // A level with nothing left to serve is a level long since cleared, and it can
  // be the one that finishes the pack — so the key is handed over on that screen
  // too, rather than only on a results screen this round never reaches.
  const packCompleted = usePackCompleted(
    topicId,
    safeLevel,
    deckId,
    levelAlreadyMastered,
  );

  const { words: allWords, isLoading: wordsLoading } = useFallbackWords(60, {
    speak: deckSession.session?.nativeLang,
    learning: deckSession.session?.foreignLang,
  });
  const roundSeed = deckId
    ? `deck:${deckId}:${sessionMode}:${
        deckSession.session?.words.map((w) => w.id).join(",") ?? ""
      }`
    : `${topicId || "default"}:${safeLevel}:${attempt}`;

  const questions = useMemo<Question[]>(() => {
    if (deckId) {
      const deckWords = (deckSession.session?.words ?? []).map((word) => ({
        id: word.id,
        native: word.native,
        foreign: word.foreign,
        article: word.article,
      }));
      // Distractors from the deck itself, padded with the base DB if tiny.
      const pool = [
        ...deckWords.map((word) => ({
          text: word.foreign,
          article: word.article,
        })),
        ...allWords.map((word) => ({
          text: word.foreign,
          article: word.article,
        })),
      ];
      return buildQuestions(deckWords, pool, roundSeed);
    }
    const lessonWords = buildLessonWords(allWords, roundSeed);
    return buildQuestions(
      lessonWords,
      allWords.map((word) => ({ text: word.foreign, article: word.article })),
      roundSeed,
    );
  }, [deckId, deckSession.session, allWords, roundSeed]);

  // Lets the results screen say whether the level is finished without waiting on
  // the server: the session's summary is scoped to the level and the round knows
  // which of its words came back right.
  const session = deckSession.session;
  const checkLevelCleared = useCallback(
    (correctWordIds: Set<string>) =>
      session
        ? predictLevelCleared(session.summary, session.words, correctWordIds)
        : false,
    [session],
  );

  if (energyBlocked) {
    return <OutOfEnergy {...GATE} />;
  }

  // Coming back to the free round after it has been played — usually the back
  // button off the sign-up page — meets the same ask rather than a second round.
  if (onboarding && !freeRoundAvailable) {
    return (
      <DeckMessage
        {...GATE}
        title="You've used your free round"
        body="Sign up to keep playing — your level and progress are saved from here on."
        action={{ label: "Continue playing", onClick: signIn }}
      />
    );
  }

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
    if (deckSession.status === "loading" || deckSession.status === "idle" || wordsLoading) {
      return <DeckLoading {...GATE} variant="quiz" />;
    }
    if (deckSession.status === "notfound") {
      return (
        <DeckMessage {...GATE} title="Deck not found" backHref="/my-decks" />
      );
    }
    if (deckSession.status === "empty") {
      return (
        <>
          <DeckMessage
            {...GATE}
            title={
              sessionMode === "finish"
                ? "No hard words to review yet"
                : topicId
                  ? `You've mastered every word in level ${safeLevel}! 🎉`
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
              level={safeLevel}
              deckId={deckId}
            />
          )}
        </>
      );
    }
  } else if (wordsLoading) {
    // Without a deck the words come from the corpus, and a round built before
    // they land has nothing to ask.
    return <DeckLoading {...GATE} variant="quiz" />;
  } else if (questions.length === 0) {
    return (
      <DeckMessage
        {...GATE}
        title="No words to practice right now"
        body="We couldn't load words for this language pair. Try again in a moment."
        backHref="/games"
        backLabel="Back to games"
      />
    );
  }

  return (
    <OneOfThreeRound
      // The round copies its questions into state, so its key has to move when
      // the questions do: a round mounted before the words arrived would sit on
      // the empty queue it started with, which is what left the board blank.
      // `restartToken` moves it for a restart, which keeps the same questions
      // and so would otherwise leave the key — and the round — unchanged.
      key={`${roundSeed}:${questions.map((question) => question.id).join(",")}:r${restartToken}`}
      questions={questions}
      deckId={deckId}
      sessionMode={sessionMode}
      topicId={topicId}
      safeLevel={safeLevel}
      backHref={backHref}
      onboarding={onboarding}
      // On the deck path mastery decides when a level is done — see the
      // `levelAlreadyMastered` effect above — so finishing a round no longer
      // marks it. Without a deck there is nothing else to go on.
      onComplete={deckId ? undefined : markComplete}
      // Off-deck the word id *is* the concept id, so the same answer counts —
      // it just lands on the shared word rather than on a deck row.
      onResult={deckId ? deckSession.recordResult : vocabProgress.record}
      checkLevelCleared={deckId ? checkLevelCleared : undefined}
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

interface OneOfThreeRoundProps {
  questions: Question[];
  deckId: string;
  sessionMode: "practice" | "finish";
  topicId: string;
  safeLevel: number;
  backHref: string;
  /** The signed-out visitor's one free round: it grades their claimed level and
   *  ends on the sign-up ask rather than on links they can't follow. */
  onboarding: boolean;
  /** Marks the topic level done. Omitted on the deck path, where mastery does. */
  onComplete?: () => void;
  onResult?: (deckWordId: string, correct: boolean) => void;
  /** Whether the round's answers finish the level. Deck path only. */
  checkLevelCleared?: (correctWordIds: Set<string>) => boolean;
  /** A fresh selection of questions. */
  onReplay: () => void;
  /** These same questions, from the top. */
  onRestart: () => void;
}

function OneOfThreeRound(props: OneOfThreeRoundProps) {
  const {
    questions,
    deckId,
    sessionMode,
    topicId,
    safeLevel,
    backHref,
    onboarding,
    onComplete,
    onResult,
    checkLevelCleared,
    onReplay,
    onRestart,
  } = props;

  // A missed word comes back at the end of the round rather than being gone for
  // good: a level is finished by getting every word right once, so a round that
  // ended on words you never got right would leave it stuck one short.
  const { t } = useLanguage();
  const [queue, setQueue] = useState<Question[]>(questions);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [correctIds, setCorrectIds] = useState<Set<string>>(new Set());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [lessonPassed, setLessonPassed] = useState(false);
  const [levelCleared, setLevelCleared] = useState(false);
  const [correction, setCorrection] = useState<SelfReportCorrection | null>(
    null,
  );
  const retriesUsed = useRef(new Map<string, number>());
  // How each word went the *first* time it was asked. The round hands a missed
  // word back after showing the answer, so the score on the results card can
  // reach 100% off words that were only right on the second look. That is the
  // point of the retries and stays how the lesson is scored — but it is no
  // basis for judging whether someone overstated their level, which is exactly
  // the case of half the words coming back wrong. Graded on the first look.
  const firstAttempts = useRef(new Map<string, boolean>());

  const currentQuestion = queue[questionIndex] ?? null;
  // Scored over the words of the round, not over how many times they were asked,
  // so retries can't push the score past 100% or make passing harder.
  const totalQuestions = questions.length;
  const correctCount = correctIds.size;
  // The header stays on screen over the results, and the last answer never moves
  // the index on — it ends the round instead — so without the finished case the
  // bar sat one question short of full for the whole results screen.
  const answeredCount = isFinished ? queue.length : questionIndex;
  const progressPercent =
    queue.length > 0 ? Math.round((answeredCount / queue.length) * 100) : 0;

  const goToNext = (nextCorrectIds: Set<string>, nextQueue: Question[]) => {
    const nextIndex = questionIndex + 1;

    if (nextIndex >= nextQueue.length) {
      const scorePercent =
        totalQuestions > 0
          ? Math.round((nextCorrectIds.size / totalQuestions) * 100)
          : 0;
      const passed = scorePercent >= 70;

      void spendEnergy();
      setLessonPassed(passed);
      setLevelCleared(checkLevelCleared?.(nextCorrectIds) ?? false);
      setIsFinished(true);

      // The free round is spent on finishing it, not on starting it: a visitor
      // who opened the round and walked away has been taught nothing, and
      // shouldn't come back to a sign-up wall. Grading their claimed level is
      // the same moment — this round is the only evidence there is.
      if (onboarding) {
        recordAnonPlayUsed();

        const rightFirstTime = [...firstAttempts.current.values()].filter(
          Boolean,
        ).length;
        const firstLookPercent =
          totalQuestions > 0
            ? Math.round((rightFirstTime / totalQuestions) * 100)
            : 0;
        setCorrection(applySelfReportCorrection(firstLookPercent));
      }

      if (passed && topicId && totalQuestions > 0) {
        onComplete?.();
      }
      return;
    }

    setQuestionIndex(nextIndex);
    setSelectedKey(null);
  };

  /** Puts a missed question back at the end of the round, up to twice. */
  const requeue = (question: Question): Question[] => {
    const used = retriesUsed.current.get(question.wordId) ?? 0;
    if (used >= MAX_RETRIES_PER_WORD) {
      return queue;
    }

    retriesUsed.current.set(question.wordId, used + 1);
    const nextQueue = [
      ...queue,
      { ...question, id: `${question.id}-retry-${used + 1}` },
    ];
    setQueue(nextQueue);
    return nextQueue;
  };

  const markCorrect = (wordId: string): Set<string> => {
    const next = new Set(correctIds).add(wordId);
    setCorrectIds(next);
    return next;
  };

  const handleAnswer = (option: QuestionOption) => {
    if (!currentQuestion || selectedKey) {
      return;
    }

    const isCorrect = option.correct;
    setSelectedKey(option.key);

    if (!firstAttempts.current.has(currentQuestion.wordId)) {
      firstAttempts.current.set(currentQuestion.wordId, isCorrect);
    }

    // Both paths record. Off-deck the word id is the concept id, so an answer
    // here counts toward the word itself just as a deck round would.
    onResult?.(currentQuestion.wordId, isCorrect);

    const nextCorrectIds = isCorrect
      ? markCorrect(currentQuestion.wordId)
      : correctIds;
    const nextQueue = isCorrect ? queue : requeue(currentQuestion);

    window.setTimeout(() => {
      goToNext(nextCorrectIds, nextQueue);
    }, 380);
  };

  const scorePercent =
    totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  // The fifth level clearing finishes the pack, and a key comes with it. Said
  // here rather than left for the player to find on the way back. Without a
  // deck there are no word counts to clear, so passing the round is the bar —
  // the same one that marks the level done on that path.
  const packCompleted = usePackCompleted(
    topicId,
    safeLevel,
    deckId,
    deckId ? levelCleared : lessonPassed,
  );

  // Words are still outstanding whenever the level didn't finish, and going
  // round again is the way to meet them — so with nothing else to move on to,
  // that button is the one to reach for rather than the quiet outline next to
  // "Back to topic". Once the level is done and "Next level" takes the lead, it
  // steps back to being the secondary option again.
  const showNextLevel =
    Boolean(deckId && topicId) && levelCleared && safeLevel < TOPIC_LEVEL_COUNT;

  const headerLabel = onboarding
    ? "Free round"
    : sessionMode === "finish"
      ? "Challenge Round"
      : topicId
        ? `Level ${safeLevel}`
        : deckId
          ? "Custom Deck"
          : `Lesson ${safeLevel}`;

  return (
    <GamePage {...GATE} playing={!isFinished} exitHref={backHref} onRestart={onRestart}>
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
        <div className="bg-linear-to-r from-amber-300 via-orange-300 to-rose-300 p-5 dark:from-amber-700 dark:via-orange-700 dark:to-rose-700">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-700 dark:text-amber-100">
            {headerLabel}
          </p>
          <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
            Translation Sprint
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
          {!isFinished && currentQuestion && (
            <>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center dark:border-slate-800 dark:bg-slate-900/70">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  {currentQuestion.kind === "article"
                    ? t("games.oneOfThreeWhichArticle", "Which article?")
                    : t(
                        "games.oneOfThreeWhichMeaning",
                        "What matches this word?",
                      )}
                </p>
                <p className="mt-2 text-4xl font-black text-slate-900 dark:text-slate-100">
                  {currentQuestion.prompt}
                </p>
              </div>

              <div className="mt-5 grid gap-3">
                {currentQuestion.options.map((option) => {
                  const isSelected = option.key === selectedKey;
                  const showCorrect = Boolean(selectedKey) && option.correct;
                  const showWrong =
                    Boolean(selectedKey) && isSelected && !option.correct;

                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => handleAnswer(option)}
                      disabled={Boolean(selectedKey)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left text-base font-semibold transition ${
                        showCorrect
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                          : showWrong
                            ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
                            : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-slate-700 dark:hover:bg-slate-900"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Correct answers: {correctCount}/{totalQuestions}
                </p>
              </div>
            </>
          )}

          {isFinished && packCompleted && (
            <PackKeyCelebration
              topicId={topicId}
              level={safeLevel}
              deckId={deckId}
            />
          )}

          {isFinished && (
            <div className="text-center">
              <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100">
                {lessonPassed ? "Lesson completed" : "Try once more"}
              </h3>
              <p className="mt-3 text-slate-600 dark:text-slate-300">
                Score: {scorePercent}% ({correctCount}/{totalQuestions})
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

              {/* The free round ends here. Every other way on from this screen
                  leads somewhere a signed-out visitor can't go — the decks and
                  topics behind it are gated, and replaying would hand out the
                  free round again — so the ask is the only thing offered. */}
              {onboarding && (
                <div className="mt-6 flex flex-col items-center gap-3">
                  {correction?.changed && (
                    <p className="max-w-sm rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                      You picked a higher starting point than that round backed
                      up, so we&apos;ve eased it down. You&apos;ll start on
                      words that fit and climb from there.
                    </p>
                  )}
                  <Link
                    href={ONBOARDING_SIGN_UP_HREF}
                    className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-md transition hover:bg-blue-500"
                  >
                    Continue playing
                  </Link>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Free round done — sign up to keep going and save your
                    progress.
                  </p>
                </div>
              )}

              {!onboarding && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  {/* Once the pack is done this is the way to its key, so it
                    trades the plain dark button for the gold one. */}
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
                  {deckId && topicId && (
                    <NextLevelButton
                      deckId={deckId}
                      topicId={topicId}
                      level={safeLevel}
                      cleared={levelCleared}
                    />
                  )}
                  <button
                    type="button"
                    onClick={onReplay}
                    className={
                      showNextLevel
                        ? "rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        : "rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                    }
                  >
                    {showNextLevel ? "Replay lesson" : "Continue practicing"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </GamePage>
  );
}

export default OneOfThreePage;
