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
import { eq, and, or, isNull, asc, desc, ne, inArray, sql } from "drizzle-orm";
import { listDecksForUser, getDeckForUser } from "@/app/api/decks/_lib/deckStore";
import { recordConceptAttempts } from "@/app/api/decks/_lib/spacedRepetition";

export interface MatchQuestionPayload {
  id: string;
  /**
   * The word behind the question, when it came from the corpus. Carried through
   * to the stored row so a graded answer can count toward the word — the server
   * cannot recover it from the question text afterwards.
   */
  conceptId: string | null;
  prompt: string;
  options: string[];
  correctOption: string;
}

interface PlayerSession {
  userId: string;
  name: string;
  avatar: string;
}

/**
 * Personalized opponents can use different language pairs and levels, so the
 * queue entry has to retain the settings needed to build that player's own
 * private question set after they are matched.
 */
type QueueEntry = PlayerSession &
  QueueDescriptor & {
    joinedAt?: number;
  };

const QUEUE_KEY_PREFIX = "flipcards:queue";
const USER_CHANNEL_PREFIX = "user-";
const MATCH_CHANNEL_PREFIX = "match-";
const SCORE_RUSH_NICKNAME_KEY_PREFIX = "score-rush:nickname";
export const WINNING_CORRECT_ANSWERS = 10;
const LIVE_QUESTION_COUNT = 30;
// Buffer between match creation and the moment both players' clocks are
// allowed to start, so both clients have time to be pushed the match,
// navigate to the play screen, and show a synced 3-2-1 countdown.
export const MATCH_COUNTDOWN_MS = 5000;
// A searching client re-announces itself on every status poll (~1s), so an
// entry that hasn't been touched in this long belongs to someone who closed
// the tab. Pairing with them would leave the survivor waiting on a ghost.
const QUEUE_ENTRY_TTL_MS = 15_000;
// Matchmaking hands the match off to both clients immediately, so anything
// older than this was not created by the search that's asking about it.
export const FRESH_MATCH_MS = 60_000;
// An active match nobody finished within this window is abandoned. Without
// this, a half-played duel stays "active" forever and keeps being served back
// to the players who left it.
export const MATCH_STALE_MS = 15 * 60 * 1000;

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
  nativeLang: Lang,
  learning: Lang,
): Promise<{ native: string; foreign: string }[]> {
  try {
    const userDecks = await listDecksForUser(userId);
    // Deck languages may still be stored as legacy names ("german"), so both
    // sides go through normalizeLang before comparing.
    const matchingDecks = userDecks.filter(
      (d) =>
        normalizeLang(d.nativeLang) === nativeLang &&
        normalizeLang(d.foreignLang) === learning,
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
      conceptId: pair.conceptId ?? null,
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
  const recentWords = await getWordsFromRecentDecks(userId, speak, learning);
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

  // Recent-deck answers are valid distractors too. This also keeps custom-only
  // pools playable when the corpus has few words for a language/level.
  const answerPool = combined.map((pair) => pair.answer);
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
  // Only ever fills a missing row. `user.name` here is the duelling nickname,
  // not the account name, and writing it back over `users.name` would rename
  // the player everywhere else in the app.
  await db
    .insert(users)
    .values({
      id: user.userId as never,
      name: user.name,
      image: user.avatar,
    })
    .onConflictDoNothing({ target: users.id });
}

export interface QueueDescriptor {
  language: Lang;
  nativeLang: Lang;
  level: CefrLevel;
  mode?: string;
}

export function queueKeyFor({
  language,
  nativeLang,
  level,
  mode,
}: QueueDescriptor) {
  if (mode === "personal") {
    // Personalized players never share questions. Their own pair and level are
    // stored on the queue entry, so everybody can search in the same pool.
    return `${QUEUE_KEY_PREFIX}:personal`;
  }

  // The pair is part of the queue key: two players learning German only get
  // matched if they also share the language the options are written in.
  return `${QUEUE_KEY_PREFIX}:${nativeLang}:${language}:${level}:fair`;
}

/**
 * Drop every entry belonging to `userId`, whatever name/avatar it was stored
 * with. Matching on the whole object the way `lrem` wants would leave stale
 * copies behind as soon as a player's profile changed.
 */
async function removeFromQueue(queueKey: string, userId: string) {
  const entries = await redis.lrange<QueueEntry>(queueKey, 0, -1);
  for (const entry of entries) {
    if (entry.userId === userId) {
      await redis.lrem(queueKey, 0, entry);
    }
  }
}

/** Called when a player cancels matchmaking or navigates away from the lobby. */
export async function leaveQueue(
  descriptor: QueueDescriptor & { userId: string },
) {
  await removeFromQueue(queueKeyFor(descriptor), descriptor.userId);
}

/**
 * Keep a searching player's entry alive. Clients call this on every status
 * poll, which is what lets `tryMatch` treat silent entries as gone.
 */
export async function touchQueueEntry(
  descriptor: QueueDescriptor & PlayerSession,
) {
  const queueKey = queueKeyFor(descriptor);
  const entries = await redis.lrange<QueueEntry>(queueKey, 0, -1);
  const mine = entries.find((entry) => entry.userId === descriptor.userId);

  if (!mine) {
    return false;
  }

  await removeFromQueue(queueKey, descriptor.userId);
  await redis.rpush(queueKey, {
    userId: descriptor.userId,
    name: descriptor.name,
    avatar: descriptor.avatar,
    language: descriptor.language,
    nativeLang: descriptor.nativeLang,
    level: descriptor.level,
    mode: descriptor.mode,
    joinedAt: Date.now(),
  } satisfies QueueEntry);
  return true;
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
  const queueKey = queueKeyFor(user);
  await ensureUser(user);

  // Anything the player left half-played is resolved before they queue again,
  // so a stale match can't be handed back to them as "your current duel".
  await abandonMatchesForUser(user.userId);

  const playerObj: QueueEntry = {
    userId: user.userId,
    name: user.name,
    avatar: user.avatar,
    language: user.language,
    nativeLang: user.nativeLang,
    level: user.level,
    mode,
    joinedAt: Date.now(),
  };

  // Remove existing entries for this user to avoid duplicates in the queue
  await removeFromQueue(queueKey, user.userId);
  await redis.rpush(queueKey, playerObj);

  const waitingQueue = await redis.lrange<QueueEntry>(queueKey, 0, -1);
  const cutoff = Date.now() - QUEUE_ENTRY_TTL_MS;
  const candidates = waitingQueue.filter(
    (entry) => entry.userId !== user.userId,
  );

  // Entries without a heartbeat were written by a client that has since gone
  // away; clear them out rather than pairing someone with a ghost.
  const stale = candidates.filter((entry) => (entry.joinedAt ?? 0) < cutoff);
  for (const entry of stale) {
    await redis.lrem(queueKey, 0, entry);
  }

  let waiting: QueueEntry | null = null;
  for (const candidate of candidates) {
    if ((candidate.joinedAt ?? 0) < cutoff) {
      continue;
    }

    // A heartbeat that raced with the candidate's own match being created can
    // leave them queued while they're already playing. Pairing with them would
    // strand this player in a duel the other side never opens.
    const alreadyPlaying = await activeMatchIdsForUser(candidate.userId);
    if (alreadyPlaying.length > 0) {
      await removeFromQueue(queueKey, candidate.userId);
      continue;
    }

    waiting = candidate;
    break;
  }

  if (!waiting) {
    return null;
  }

  const pair = {
    speak: user.nativeLang,
    learning: user.language,
    level: user.level,
  };
  const waitingPair = {
    speak: waiting.nativeLang,
    learning: waiting.language,
    level: waiting.level,
  };

  // Questions are built *before* the match row exists. A language pair with no
  // words at this level would otherwise create a match with nothing to answer
  // and blow up on the empty insert, surfacing as "matchmaking unavailable".
  const questionSets =
    mode === "personal"
      ? [
          {
            userId: user.userId,
            questions: await createPersonalMatchQuestions(user.userId, pair),
          },
          {
            userId: waiting.userId,
            questions: await createPersonalMatchQuestions(
              waiting.userId,
              waitingPair,
            ),
          },
        ]
      : [{ userId: null, questions: await createMatchQuestions(pair) }];

  if (questionSets.some((set) => set.questions.length === 0)) {
    // Both players stay queued: the pair may well have words at another level,
    // and someone else joining shouldn't be blocked by this attempt.
    return { error: "no-words" as const };
  }

  await removeFromQueue(queueKey, waiting.userId);
  await removeFromQueue(queueKey, user.userId);

  await ensureUser(waiting);

  const [match] = await db
    .insert(matches)
    .values({
      language: user.language,
      nativeLang: user.nativeLang,
      level: user.level,
      mode: mode,
      // The duel doesn't start until both players accept it.
      status: "pending",
    })
    .returning();

  await db.insert(matchQuestions).values(
    questionSets.flatMap((set) =>
      set.questions.map((question, orderIndex) => ({
        matchId: match.id,
        userId: set.userId,
        orderIndex,
        prompt: question.prompt,
        options: question.options,
        correctOption: question.correctOption,
        conceptId: question.conceptId,
      })),
    ),
  );

  const playerRows = [
    {
      matchId: match.id,
      userId: user.userId,
      side: "player1",
      displayName: user.name,
      nativeLang: user.nativeLang,
      language: user.language,
      level: user.level,
    },
    {
      matchId: match.id,
      userId: waiting.userId,
      side: "player2",
      displayName: waiting.name,
      nativeLang: waiting.nativeLang,
      language: waiting.language,
      level: waiting.level,
    },
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

  return { match, waiting, error: null };
}

/**
 * Record that a player accepted the duel. The match only goes live - and only
 * then gets a start time - once both sides have said yes.
 */
export async function acceptMatch(matchId: string, userId: string) {
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
  });

  if (!match) {
    return { ok: false as const, error: "Match not found" };
  }

  const rows = await db.query.matchPlayers.findMany({
    where: eq(matchPlayers.matchId, matchId),
  });

  const me = rows.find((row) => row.userId === userId);
  if (!me) {
    return { ok: false as const, error: "Not in match" };
  }

  if (match.status === "finished") {
    return { ok: false as const, error: "Match already finished" };
  }

  if (!me.acceptedAt) {
    await db
      .update(matchPlayers)
      .set({ acceptedAt: new Date() })
      .where(eq(matchPlayers.id, me.id));
  }

  const everyoneAccepted =
    rows.length > 1 &&
    rows.every((row) => row.userId === userId || row.acceptedAt !== null);

  if (!everyoneAccepted) {
    await pusher.trigger(
      `${MATCH_CHANNEL_PREFIX}${matchId}`,
      "match-accepted",
      { userId },
    );
    return { ok: true as const, status: "pending" as const, startAt: null };
  }

  // Second acceptance wins the race to set the clock; if the other request got
  // there first, keep its value so both screens count down together.
  const startAt = match.startAt ?? new Date(Date.now() + MATCH_COUNTDOWN_MS);

  if (match.status !== "active") {
    await db
      .update(matches)
      .set({ status: "active", startAt })
      .where(and(eq(matches.id, matchId), eq(matches.status, "pending")));
  }

  await pusher.trigger(`${MATCH_CHANNEL_PREFIX}${matchId}`, "match-ready", {
    startAt: startAt.getTime(),
  });

  return {
    ok: true as const,
    status: "active" as const,
    startAt: startAt.getTime(),
  };
}

async function closeMatch(matchId: string, winnerUserId: string | null) {
  await db
    .update(matches)
    .set({
      status: "finished",
      winnerUserId,
      finishedAt: new Date(),
    })
    .where(and(eq(matches.id, matchId), ne(matches.status, "finished")));

  await pusher.trigger(`${MATCH_CHANNEL_PREFIX}${matchId}`, "match-finished", {
    winnerUserId,
  });
}

/**
 * Decide a match that ended without anyone reaching the target: most correct
 * answers wins, and a tie goes to whoever got there first.
 */
function winnerByScore(
  rows: Array<{ userId: string; correctCount: number; progress: number }>,
  preferUserId?: string,
): string | null {
  if (rows.length === 0) {
    return null;
  }

  const best = [...rows].sort(
    (a, b) => b.correctCount - a.correctCount || a.progress - b.progress,
  );

  if (
    best.length > 1 &&
    best[0].correctCount === best[1].correctCount &&
    best[0].progress === best[1].progress
  ) {
    return preferUserId ?? null;
  }

  return best[0].userId;
}

/** Matches this player is still tied to - awaiting acceptance or in progress. */
async function activeMatchIdsForUser(userId: string, olderThanMs?: number) {
  const rows = await db
    .select({ id: matches.id, createdAt: matches.createdAt })
    .from(matchPlayers)
    .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
    .where(
      and(
        eq(matchPlayers.userId, userId),
        inArray(matches.status, ["pending", "active"]),
      ),
    );

  if (olderThanMs === undefined) {
    return rows.map((row) => row.id);
  }

  const cutoff = Date.now() - olderThanMs;
  return rows
    .filter((row) => row.createdAt.getTime() < cutoff)
    .map((row) => row.id);
}

/**
 * End a live match because `userId` walked away. Their opponent takes the win
 * so the match can't sit "active" waiting for answers that will never come.
 */
export async function forfeitMatch(matchId: string, userId: string) {
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
  });

  if (!match || match.status === "finished") {
    return;
  }

  const rows = await db.query.matchPlayers.findMany({
    where: eq(matchPlayers.matchId, matchId),
  });

  if (!rows.some((row) => row.userId === userId)) {
    return;
  }

  const opponent = rows.find((row) => row.userId !== userId);
  // A match neither side ever answered is just closed - handing out a win for
  // a duel that was never played would show up as a phantom result.
  const nobodyPlayed = rows.every((row) => row.progress === 0);
  await closeMatch(matchId, nobodyPlayed ? null : (opponent?.userId ?? null));
}

/** Resolve every live match this player abandoned by walking away. */
export async function abandonMatchesForUser(userId: string) {
  for (const matchId of await activeMatchIdsForUser(userId)) {
    await forfeitMatch(matchId, userId);
  }
}

/** Resolve matches both sides have clearly left behind, on score. */
export async function abandonStaleMatches(userId: string) {
  for (const matchId of await activeMatchIdsForUser(userId, MATCH_STALE_MS)) {
    const rows = await db.query.matchPlayers.findMany({
      where: eq(matchPlayers.matchId, matchId),
    });
    await closeMatch(matchId, winnerByScore(rows));
  }
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
      or(
        isNull(matchQuestions.userId),
        eq(matchQuestions.userId, params.userId),
      ),
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

  // A duel is still practice: the answer counts toward the word like it would
  // in any other game. Recorded here rather than from the client because the
  // duel is graded on the server — there is nothing to trust the browser with.
  const nativeLang = normalizeLang(player.nativeLang ?? match.nativeLang);
  const foreignLang = normalizeLang(player.language ?? match.language);
  if (question.conceptId && nativeLang && foreignLang) {
    await recordConceptAttempts(params.userId, nativeLang, foreignLang, [
      { conceptId: question.conceptId, correct: isCorrect },
    ]);
  }

  const nextProgress = player.progress + 1;
  const nextCorrectCount = isCorrect
    ? player.correctCount + 1
    : player.correctCount;
  await db
    .update(matchPlayers)
    .set({
      progress: nextProgress,
      correctCount: nextCorrectCount,
      // Only ever set, never cleared - writing null here on each answer wiped
      // the timestamp of a player who had already finished.
      ...(nextCorrectCount >= WINNING_CORRECT_ANSWERS
        ? { finishedAt: player.finishedAt ?? new Date() }
        : {}),
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

  const reachedTarget = matchRows.find(
    (row) => row.correctCount >= WINNING_CORRECT_ANSWERS,
  );
  // Running out of prompts also ends the duel. Without this the match would
  // stay active forever with no question left to answer, which is what left
  // players staring at the last word.
  const outOfQuestions = !nextQuestionRow;

  let winnerUserId: string | null = null;
  let finished = false;

  if (reachedTarget) {
    winnerUserId = reachedTarget.userId;
    finished = true;
  } else if (outOfQuestions) {
    winnerUserId = winnerByScore(matchRows, params.userId);
    finished = true;
  }

  if (finished) {
    await closeMatch(params.matchId, winnerUserId);
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
    status: finished ? ("finished" as const) : ("active" as const),
    winnerUserId,
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
  nickname: string;
}) {
  await db.insert(asyncScores).values({
    userId: params.userId,
    language: params.language,
    level: params.level,
    score: params.score,
    correct: params.correct,
    timeMs: params.timeMs,
  });

  // Nicknames are user-chosen public handles. Keep them separate from
  // `users.name`, which is the private account name supplied by OAuth.
  await redis
    .set(
      `${SCORE_RUSH_NICKNAME_KEY_PREFIX}:${params.userId}`,
      params.nickname,
    )
    .catch(() => undefined);
}

export async function getRecentAsyncScores(
  userId: string,
  language: Lang,
  level: string,
) {
  return db
    .select({
      id: asyncScores.id,
      score: asyncScores.score,
      correct: asyncScores.correct,
      createdAt: asyncScores.createdAt,
    })
    .from(asyncScores)
    .where(
      and(
        eq(asyncScores.userId, userId),
        eq(asyncScores.language, language),
        eq(asyncScores.level, level),
      ),
    )
    .orderBy(desc(asyncScores.createdAt))
    .limit(4);
}

export async function getLeaderboard(language: Lang, currentUserId: string) {
  interface LeaderboardRow extends Record<string, unknown> {
    userId: string;
    score: number;
    correct: number;
    timeMs: number;
    rank: number;
    duelNickname: string | null;
  }

  // Score Rush points are comparable across CEFR levels, so the public board
  // spans the language. One person gets one place: their best run.
  const result = await db.execute<LeaderboardRow>(sql`
    with ranked_runs as (
      select
        scores.user_id as "userId",
        scores.score,
        scores.correct,
        scores.time_ms as "timeMs",
        row_number() over (
          partition by scores.user_id
          order by scores.score desc, scores.time_ms asc, scores.created_at asc
        ) as player_run
      from async_scores scores
      where scores.language = ${language}
    )
    , ranked_players as (
      select
        ranked_runs.*,
        row_number() over (
          order by ranked_runs.score desc, ranked_runs."timeMs" asc
        )::integer as rank
      from ranked_runs
      where ranked_runs.player_run = 1
    )
    select
      ranked_players."userId",
      ranked_players.score,
      ranked_players.correct,
      ranked_players."timeMs",
      ranked_players.rank,
      (
        select players.display_name
        from match_players players
        inner join matches on matches.id = players.match_id
        where players.user_id = ranked_players."userId"
          and players.display_name is not null
          and length(trim(players.display_name)) > 0
        order by matches.created_at desc
        limit 1
      ) as "duelNickname"
    from ranked_players
    where ranked_players.rank <= 5
      or ranked_players."userId" = ${currentUserId}
    order by ranked_players.rank asc
  `);

  const nicknames = await Promise.all(
    result.rows.map((row) =>
      redis
        .get<string>(
          `${SCORE_RUSH_NICKNAME_KEY_PREFIX}:${row.userId}`,
        )
        .catch(() => null),
    ),
  );

  const rows = result.rows.map((row, index) => ({
    userId: row.userId,
    name:
      nicknames[index]?.trim() ||
      row.duelNickname?.trim() ||
      `Player ${row.rank}`,
    score: row.score,
    correct: row.correct,
    timeMs: row.timeMs,
    rank: row.rank,
  }));

  return {
    leaderboard: rows.filter((row) => row.rank <= 5),
    currentPlayer:
      rows.find((row) => row.userId === currentUserId) ?? null,
  };
}
