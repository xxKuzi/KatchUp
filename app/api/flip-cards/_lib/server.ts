import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { pusher } from "@/lib/realtime/pusher-server";
import { getAllWords } from "@/app/games/_lib/learning/wordDatabase";
import { SupportedLanguage } from "@/app/games/_lib/learning/types";
import {
  asyncScores,
  matchAnswers,
  matchPlayers,
  matchQuestions,
  matches,
  users,
  globalWords,
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
  language: SupportedLanguage,
): Promise<{ native: string; foreign: string }[]> {
  try {
    const userDecks = await listDecksForUser(userId);
    const matchingDecks = userDecks.filter(
      (d) => d.foreignLang.toLowerCase() === language.toLowerCase()
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

async function createPersonalMatchQuestions(
  userId: string,
  language: SupportedLanguage,
  level: string,
): Promise<MatchQuestionPayload[]> {
  const recentWords = await getWordsFromRecentDecks(userId, language);
  
  let levelWords = await db
    .select({
      id: globalWords.id,
      native: globalWords.native,
      foreign: globalWords.foreign,
    })
    .from(globalWords)
    .where(
      and(
        eq(globalWords.language, language),
        eq(globalWords.level, level),
      ),
    );

  if (levelWords.length < 5) {
    const localWords = getAllWords(language);
    levelWords = localWords.map((w) => ({
      id: w.id,
      native: w.native,
      foreign: w.foreign,
    }));
  }

  const uniqueKeys = new Set<string>();
  const combinedPool: { id?: string; native: string; foreign: string }[] = [];

  for (const w of recentWords) {
    const key = `${w.foreign.toLowerCase()}|||${w.native.toLowerCase()}`;
    if (!uniqueKeys.has(key)) {
      uniqueKeys.add(key);
      combinedPool.push(w);
    }
  }

  for (const w of levelWords) {
    const key = `${w.foreign.toLowerCase()}|||${w.native.toLowerCase()}`;
    if (!uniqueKeys.has(key)) {
      uniqueKeys.add(key);
      combinedPool.push(w);
    }
  }

  const selected = shuffleArray(combinedPool).slice(0, LIVE_QUESTION_COUNT);

  return selected.map((word, idx) => {
    const wrong = shuffleArray(
      levelWords
        .filter((candidate) => candidate.foreign.toLowerCase() !== word.foreign.toLowerCase())
        .map((candidate) => candidate.native),
    ).slice(0, 3);

    return {
      id: word.id || `personal-${idx}-${Math.random()}`,
      prompt: word.foreign,
      correctOption: word.native,
      options: shuffleArray([...wrong, word.native]),
    };
  });
}

async function createMatchQuestions(
  language: SupportedLanguage,
  level: string,
): Promise<MatchQuestionPayload[]> {
  let dbWords = await db
    .select({
      id: globalWords.id,
      native: globalWords.native,
      foreign: globalWords.foreign,
    })
    .from(globalWords)
    .where(
      and(
        eq(globalWords.language, language),
        eq(globalWords.level, level),
      ),
    );

  if (dbWords.length < 5) {
    const localWords = getAllWords(language);
    dbWords = localWords.map((w) => ({
      id: w.id,
      native: w.native,
      foreign: w.foreign,
    }));
  }

  const words = shuffleArray(dbWords).slice(0, LIVE_QUESTION_COUNT);

  return words.map((word) => {
    const wrong = shuffleArray(
      dbWords
        .filter((candidate) => candidate.id !== word.id)
        .map((candidate) => candidate.native),
    ).slice(0, 3);

    return {
      id: word.id,
      prompt: word.foreign,
      correctOption: word.native,
      options: shuffleArray([...wrong, word.native]),
    };
  });
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
  user: PlayerSession & { language: SupportedLanguage; level: string; mode?: string },
) {
  const mode = user.mode || "fair";
  const queueKey = `${QUEUE_KEY_PREFIX}:${user.language}:${user.level}:${mode}`;
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
      level: user.level,
      mode: mode,
      status: "active",
    })
    .returning();

  if (mode === "personal") {
    const p1Questions = await createPersonalMatchQuestions(user.userId, user.language, user.level);
    const p2Questions = await createPersonalMatchQuestions(waiting.userId, user.language, user.level);

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
    const questions = await createMatchQuestions(user.language, user.level);
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

  await pusher.trigger(`${USER_CHANNEL_PREFIX}${user.userId}`, "match-found", {
    matchId: match.id,
    opponent: waiting,
  });
  await pusher.trigger(
    `${USER_CHANNEL_PREFIX}${waiting.userId}`,
    "match-found",
    {
      matchId: match.id,
      opponent: user,
    },
  );

  return { match, waiting };
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
  language: SupportedLanguage;
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
  language: SupportedLanguage,
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
