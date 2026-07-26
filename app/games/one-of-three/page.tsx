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
import { spendEnergy } from "@/app/_lib/energy";
import { useDeckSession } from "../_hooks/useDeckSession";
import { predictLevelCleared } from "../_lib/levelCompletion";
import { useAuthState } from "@/app/_lib/auth";

/** How many times one missed word can come back inside a single round. */
const MAX_RETRIES_PER_WORD = 2;

interface Question {
  id: string;
  wordId: string;
  prompt: string;
  options: string[];
  correctOption: string;
}

interface SimpleWord {
  id: string;
  native: string;
  foreign: string;
}

const GATE = {
  name: "One of Three",
  description:
    "Pick the correct word from three options. Reach 70% to complete the lesson automatically.",
  bgImage: "one_of_three.png",
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

function buildQuestions(
  lessonWords: SimpleWord[],
  distractorPool: string[],
  seed: string,
): Question[] {
  return lessonWords.map((word, index) => {
    const distractors = shuffleWithSeed(
      distractorPool.filter((candidate) => candidate !== word.foreign),
      `${seed}:${word.id}:distractors`,
    ).slice(0, 2);

    const options = shuffleWithSeed(
      [word.foreign, ...distractors],
      `${seed}:${word.id}:options`,
    );

    return {
      id: `${word.id}-${index}`,
      wordId: word.id,
      prompt: word.native,
      options,
      correctOption: word.foreign,
    };
  });
}

const OneOfThreePage = () => {
  const searchParams = useSearchParams();
  const { isSignedIn, isReady, signIn } = useAuthState();

  const deckId = searchParams.get("deck") ?? "";
  const sessionMode =
    searchParams.get("mode") === "finish" ? "finish" : "practice";

  const {
    topicId,
    level: safeLevel,
    deckLevel,
    backHref,
    markComplete,
  } = useTopicLevel(deckId);

  const [attempt, setAttempt] = useState(0);

  const deckSession = useDeckSession(deckId || null, sessionMode, deckLevel);

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

  const allWords = useFallbackWords();
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
      }));
      // Distractors from the deck itself, padded with the base DB if tiny.
      const pool = [
        ...deckWords.map((word) => word.foreign),
        ...allWords.map((word) => word.foreign),
      ];
      return buildQuestions(deckWords, pool, roundSeed);
    }
    const lessonWords = buildLessonWords(allWords, roundSeed);
    return buildQuestions(
      lessonWords,
      allWords.map((word) => word.foreign),
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
            backLabel={topicId ? "Back to topic" : undefined}
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
  }

  return (
    <OneOfThreeRound
      key={roundSeed}
      questions={questions}
      deckId={deckId}
      sessionMode={sessionMode}
      topicId={topicId}
      safeLevel={safeLevel}
      backHref={backHref}
      // On the deck path mastery decides when a level is done — see the
      // `levelAlreadyMastered` effect above — so finishing a round no longer
      // marks it. Without a deck there is nothing else to go on.
      onComplete={deckId ? undefined : markComplete}
      onResult={deckId ? deckSession.recordResult : undefined}
      checkLevelCleared={deckId ? checkLevelCleared : undefined}
      onReplay={() => {
        if (deckId) {
          deckSession.reload();
        } else {
          setAttempt((value) => value + 1);
        }
      }}
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
  /** Marks the topic level done. Omitted on the deck path, where mastery does. */
  onComplete?: () => void;
  onResult?: (deckWordId: string, correct: boolean) => void;
  /** Whether the round's answers finish the level. Deck path only. */
  checkLevelCleared?: (correctWordIds: Set<string>) => boolean;
  onReplay: () => void;
}

function OneOfThreeRound(props: OneOfThreeRoundProps) {
  const {
    questions,
    deckId,
    sessionMode,
    topicId,
    safeLevel,
    backHref,
    onComplete,
    onResult,
    checkLevelCleared,
    onReplay,
  } = props;

  // A missed word comes back at the end of the round rather than being gone for
  // good: a level is finished by getting every word right once, so a round that
  // ended on words you never got right would leave it stuck one short.
  const [queue, setQueue] = useState<Question[]>(questions);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [correctIds, setCorrectIds] = useState<Set<string>>(new Set());
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [lessonPassed, setLessonPassed] = useState(false);
  const [levelCleared, setLevelCleared] = useState(false);
  const retriesUsed = useRef(new Map<string, number>());

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

      spendEnergy();
      setLessonPassed(passed);
      setLevelCleared(checkLevelCleared?.(nextCorrectIds) ?? false);
      setIsFinished(true);

      if (passed && topicId && totalQuestions > 0) {
        onComplete?.();
      }
      return;
    }

    setQuestionIndex(nextIndex);
    setSelectedOption(null);
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

  const handleAnswer = (option: string) => {
    if (!currentQuestion || selectedOption) {
      return;
    }

    const isCorrect = option === currentQuestion.correctOption;
    setSelectedOption(option);

    if (deckId) {
      onResult?.(currentQuestion.wordId, isCorrect);
    }

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

  const headerLabel =
    sessionMode === "finish"
      ? "Finish Round"
      : topicId
        ? `Level ${safeLevel}`
        : deckId
          ? "Custom Deck"
          : `Lesson ${safeLevel}`;

  return (
    <GamePage {...GATE}>
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
                  What matches this word?
                </p>
                <p className="mt-2 text-4xl font-black text-slate-900 dark:text-slate-100">
                  {currentQuestion.prompt}
                </p>
              </div>

              <div className="mt-5 grid gap-3">
                {currentQuestion.options.map((option) => {
                  const isCorrect = option === currentQuestion.correctOption;
                  const isSelected = option === selectedOption;
                  const showCorrect = Boolean(selectedOption) && isCorrect;
                  const showWrong =
                    Boolean(selectedOption) && isSelected && !isCorrect;

                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => handleAnswer(option)}
                      disabled={Boolean(selectedOption)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left text-base font-semibold transition ${
                        showCorrect
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                          : showWrong
                            ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
                            : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-slate-700 dark:hover:bg-slate-900"
                      }`}
                    >
                      {option}
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
                  {topicId ? "Back to topic" : "Back to decks"}
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
            </div>
          )}
        </div>
      </div>
    </GamePage>
  );
}

export default OneOfThreePage;
