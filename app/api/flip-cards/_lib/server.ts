import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { pusher } from "@/lib/realtime/pusher-server";
import { getWordPairs } from "@/app/api/words/_lib/wordPool";
import { normalizeLang, type CefrLevel, type Lang } from "@/app/_lib/languages";
import {
  asyncScores,
  matchAnswers,
  matchPlayers,
  matchQuestions,
  matches,
  users,
} from "@/db/schema";
import { eq, and, or, isNull, asc, desc } from "drizzle-orm";
import { listDecksForUser, getDeckForUser } from "@/app/api/decks/_lib/deckStore";

export interface MatchQuestionPayload {
  id: string;
  prompt: string;
  options: string[];
  correctOption: string;
}

interface PlayerSession {
  userId: string;
  name: string;
  avatar: string;
}

const QUEUE_KEY_PREFIX = "flipcards:queue";
const USER_CHANNEL_PREFIX = "user-";
const MATCH_CHANNEL_PREFIX = "match-";
const WINNING_CORRECT_ANSWERS = 10;
const LIVE_QUESTION_COUNT = 30;
// Buffer between match creation and the moment both players' clocks are
// allowed to start, so both clients have time to be pushed the match,
// navigate to the play screen, and show a synced 3-2-1 countdown.
export const MATCH_COUNTDOWN_MS = 5000;

function shuffleArray<T>(items: T[]): T[] {
  const cloned = [...items];
  for (let i = cloned.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
  }
  return cloned;
}

async function getWordsFromRecentDecks(
  userId: string,
  language: Lang,
): Promise<{ native: string; foreign: string }[]> {
  try {
    const userDecks = await listDecksForUser(userId);
    // Deck languages may still be stored as legacy names ("german"), so both
    // sides go through normalizeLang before comparing.
    const matchingDecks = userDecks.filter(
      (d) => normalizeLang(d.foreignLang) === language,
    );

    const pool: { native: string; foreign: string }[] = [];
    for (const d of matchingDecks.slice(0, 3)) {
      const fullDeck = await getDeckForUser(d.id, userId);
      if (fullDeck && fullDeck.words) {
        pool.push(
          ...fullDeck.words.map((w) => ({
            native: w.native,
            foreign: w.foreign,
          }))
        );
      }
    }
    return pool;
  } catch {
    return [];
  }
}

interface MatchPair {
  speak: Lang;
  learning: Lang;
  level: CefrLevel;
}

/** Turn prompt/answer pairs into multiple-choice questions. */
function toQuestions(
  pairs: Array<{ conceptId?: string; prompt: string; answer: string }>,
  answerPool: string[],
  idPrefix: string,
): MatchQuestionPayload[] {
  return pairs.slice(0, LIVE_QUESTION_COUNT).map((pair, idx) => {
    const wrong = shuffleArray(
      answerPool.filter(
        (candidate) => candidate.toLowerCase() !== pair.answer.toLowerCase(),
      ),
    ).slice(0, 3);

    return {
      id: pair.conceptId ?? `${idPrefix}-${idx}-${Math.random()}`,
      prompt: pair.prompt,
      correctOption: pair.answer,
      options: shuffleArray([...wrong, pair.answer]),
    };
  });
}

// Live duels quiz in the recognition direction: show the word being learned,
// pick its meaning in the language both players speak.
const MATCH_DIRECTION = "recognition" as const;

async function createPersonalMatchQuestions(
  userId: string,
  { speak, learning, level }: MatchPair,
): Promise<MatchQuestionPayload[]> {
  const recentWords = await getWordsFromRecentDecks(userId, learning);
  const levelPairs = await getWordPairs({
    speak,
    learning,
    direction: MATCH_DIRECTION,
    level,
    count: 100,
  });

  const seen = new Set<string>();
  const combined: Array<{ conceptId?: string; prompt: string; answer: string }> = [];

  // Deck words are stored native/foreign; in recognition the foreign side is
  // the prompt and the native side the answer.
  for (const word of recentWords) {
    const key = `${word.foreign.toLowerCase()}|||${word.native.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    combined.push({ prompt: word.foreign, answer: word.native });
  }

  for (const pair of levelPairs) {
    const key = `${pair.prompt.toLowerCase()}|||${pair.answer.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    combined.push(pair);
  }

  const answerPool = levelPairs.map((pair) => pair.answer);
  return toQuestions(shuffleArray(combined), answerPool, "personal");
}

async function createMatchQuestions({
  speak,
  learning,
  level,
}: MatchPair): Promise<MatchQuestionPayload[]> {
  const pairs = await getWordPairs({
    speak,
    learning,
    direction: MATCH_DIRECTION,
    level,
    count: 100,
  });

  const answerPool = pairs.map((pair) => pair.answer);
  return toQuestions(shuffleArray(pairs), answerPool, "match");
}

export async function ensureUser(user: PlayerSession) {
  await db
    .insert(users)
    .values({
      id: user.userId as never,
      name: user.name,
      image: user.avatar,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        name: user.name,
        image: user.avatar,
      },
    });
}

export async function tryMatch(
  user: PlayerSession & {
    language: Lang;
    nativeLang: Lang;
    level: CefrLevel;
    mode?: string;
  },
) {
  const mode = user.mode || "fair";
  // The pair is part of the queue key: two players learning German only get
  // matched if they also share the language the options are written in.
  const queueKey = `${QUEUE_KEY_PREFIX}:${user.nativeLang}:${user.language}:${user.level}:${mode}`;
  await ensureUser(user);

  const playerObj: PlayerSession = {
    userId: user.userId,
    name: user.name,
    avatar: user.avatar,
  };

  // Remove existing entries for this user to avoid duplicates in the queue
  await redis.lrem(queueKey, 0, playerObj);
  await redis.rpush(queueKey, playerObj);

  const waitingQueue = await redis.lrange<PlayerSession>(queueKey, 0, -1);
  const waiting = waitingQueue.find(
    (entry) => entry.userId !== user.userId,
  );

  if (!waiting) {
    return null;
  }

  await redis.lrem(queueKey, 1, waiting);
  await redis.lrem(queueKey, 1, playerObj);

  await ensureUser(waiting);

  const [match] = await db
    .insert(matches)
    .values({
      language: user.language,
      nativeLang: user.nativeLang,
      level: user.level,
      mode: mode,
      status: "active",
    })
    .returning();

  if (mode === "personal") {
    const pair = {
      speak: user.nativeLang,
      learning: user.language,
      level: user.level,
    };
    const p1Questions = await createPersonalMatchQuestions(user.userId, pair);
    const p2Questions = await createPersonalMatchQuestions(waiting.userId, pair);

    await db.insert(matchQuestions).values([
      ...p1Questions.map((question, orderIndex) => ({
        matchId: match.id,
        userId: user.userId,
        orderIndex,
        prompt: question.prompt,
        options: question.options,
        correctOption: question.correctOption,
      })),
      ...p2Questions.map((question, orderIndex) => ({
        matchId: match.id,
        userId: waiting.userId,
        orderIndex,
        prompt: question.prompt,
        options: question.options,
        correctOption: question.correctOption,
      })),
    ]);
  } else {
    const questions = await createMatchQuestions({
      speak: user.nativeLang,
      learning: user.language,
      level: user.level,
    });
    await db.insert(matchQuestions).values(
      questions.map((question, orderIndex) => ({
        matchId: match.id,
        userId: null,
        orderIndex,
        prompt: question.prompt,
        options: question.options,
        correctOption: question.correctOption,
      })),
    );
  }

  const playerRows = [
    { matchId: match.id, userId: user.userId, side: "player1" },
    { matchId: match.id, userId: waiting.userId, side: "player2" },
  ];
  await db.insert(matchPlayers).values(playerRows);

  const startAt = match.createdAt.getTime() + MATCH_COUNTDOWN_MS;

  await pusher.trigger(`${USER_CHANNEL_PREFIX}${user.userId}`, "match-found", {
    matchId: match.id,
    opponent: waiting,
    startAt,
  });
  await pusher.trigger(
    `${USER_CHANNEL_PREFIX}${waiting.userId}`,
    "match-found",
    {
      matchId: match.id,
      opponent: user,
      startAt,
    },
  );

  return { match, waiting, startAt };
}

export async function fetchMatchForUser(matchId: string, userId: string) {
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
  });

  if (!match) {
    return null;
  }

  const players = await db.query.matchPlayers.findMany({
    where: eq(matchPlayers.matchId, matchId),
  });

  const me = players.find((player) => player.userId === userId) ?? null;
  const opponent = players.find((player) => player.userId !== userId) ?? null;

  if (!me) {
    return null;
  }

  const questionRows = await db
    .select()
    .from(matchQuestions)
    .where(
      and(
        eq(matchQuestions.matchId, matchId),
        or(
          isNull(matchQuestions.userId),
          eq(matchQuestions.userId, userId),
        ),
      ),
    )
    .orderBy(asc(matchQuestions.orderIndex));

  return { match, me, opponent, questions: questionRows };
}

export async function submitLiveAnswer(params: {
  matchId: string;
  userId: string;
  questionId: string;
  selectedOption: string;
  responseMs: number;
}) {
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, params.matchId),
  });

  if (!match || match.status !== "active") {
    return { ok: false as const, error: "Match already finished" };
  }

  const question = await db.query.matchQuestions.findFirst({
    where: and(
      eq(matchQuestions.matchId, params.matchId),
      eq(matchQuestions.id, params.questionId),
    ),
  });

  const player = await db.query.matchPlayers.findFirst({
    where: and(
      eq(matchPlayers.matchId, params.matchId),
      eq(matchPlayers.userId, params.userId),
    ),
  });

  if (!question || !player) {
    return { ok: false as const, error: "Match state invalid" };
  }

  const isCorrect = question.correctOption === params.selectedOption;
  await db.insert(matchAnswers).values({
    matchId: params.matchId,
    userId: params.userId,
    questionId: question.id,
    selectedOption: params.selectedOption,
    isCorrect,
    responseMs: params.responseMs,
  });

  const nextProgress = player.progress + 1;
  const nextCorrectCount = isCorrect
    ? player.correctCount + 1
    : player.correctCount;
  await db
    .update(matchPlayers)
    .set({
      progress: nextProgress,
      correctCount: nextCorrectCount,
      finishedAt:
        nextCorrectCount >= WINNING_CORRECT_ANSWERS ? new Date() : null,
    })
    .where(
      and(
        eq(matchPlayers.matchId, params.matchId),
        eq(matchPlayers.userId, params.userId),
      ),
    );

  const matchRows = await db.query.matchPlayers.findMany({
    where: eq(matchPlayers.matchId, params.matchId),
  });

  const winner = matchRows.find(
    (row) => row.correctCount >= WINNING_CORRECT_ANSWERS,
  );
  if (winner) {
    await db
      .update(matches)
      .set({
        status: "finished",
        winnerUserId: winner.userId,
        finishedAt: new Date(),
      })
      .where(eq(matches.id, params.matchId));
    await pusher.trigger(
      `${MATCH_CHANNEL_PREFIX}${params.matchId}`,
      "match-finished",
      {
        winnerUserId: winner.userId,
      },
    );
  } else {
    await pusher.trigger(
      `${MATCH_CHANNEL_PREFIX}${params.matchId}`,
      "turn-played",
      {
        userId: params.userId,
        progress: nextProgress,
        correctCount: nextCorrectCount,
        isCorrect,
      },
    );
  }

  const nextQuestionRow = await db.query.matchQuestions.findFirst({
    where: and(
      eq(matchQuestions.matchId, params.matchId),
      eq(matchQuestions.orderIndex, nextProgress),
      or(
        isNull(matchQuestions.userId),
        eq(matchQuestions.userId, params.userId),
      ),
    ),
  });

  const nextQuestion = nextQuestionRow
    ? {
        id: nextQuestionRow.id,
        prompt: nextQuestionRow.prompt,
        options: nextQuestionRow.options as string[],
        correctOption: nextQuestionRow.correctOption,
      }
    : null;

  return {
    ok: true as const,
    isCorrect,
    status: winner ? ("finished" as const) : ("active" as const),
    winnerUserId: winner?.userId ?? null,
    progress: nextProgress,
    correctCount: nextCorrectCount,
    nextQuestion,
  };
}

export async function saveAsyncScore(params: {
  userId: string;
  language: Lang;
  level: string;
  score: number;
  correct: number;
  timeMs: number;
}) {
  await db.insert(asyncScores).values({
    userId: params.userId,
    language: params.language,
    level: params.level,
    score: params.score,
    correct: params.correct,
    timeMs: params.timeMs,
  });
}

export async function getLeaderboard(
  language: Lang,
  level: string,
) {
  return db
    .select({
      score: asyncScores.score,
      correct: asyncScores.correct,
      timeMs: asyncScores.timeMs,
      name: users.name,
      avatar: users.image,
    })
    .from(asyncScores)
    .innerJoin(users, eq(asyncScores.userId, users.id))
    .where(
      and(eq(asyncScores.language, language), eq(asyncScores.level, level)),
    )
    .orderBy(desc(asyncScores.score), asc(asyncScores.timeMs))
    .limit(10);
}
