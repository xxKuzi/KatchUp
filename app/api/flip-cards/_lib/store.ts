import { SupportedLanguage } from "@/app/games/_lib/learning/types";
import { getAllWords } from "@/app/games/_lib/learning/wordDatabase";

export interface ServerQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctOption: string;
}

interface PlayerSnapshot {
  id: string;
  name: string;
  avatar: string;
  progress: number;
  correct: number;
  finishedAt?: number;
}

interface WaitingPlayer {
  playerId: string;
  name: string;
  avatar: string;
  language: SupportedLanguage;
  level: string;
  queuedAt: number;
}

export interface MatchRecord {
  id: string;
  language: SupportedLanguage;
  level: string;
  status: "active" | "finished";
  createdAt: number;
  updatedAt: number;
  winnerId: string | null;
  totalQuestions: number;
  questions: ServerQuestion[];
  playerOrder: Record<string, string[]>;
  players: Record<string, PlayerSnapshot>;
}

interface AsyncScoreEntry {
  id: string;
  playerId: string;
  name: string;
  avatar: string;
  language: SupportedLanguage;
  level: string;
  score: number;
  correct: number;
  timeMs: number;
  createdAt: number;
}

interface FlipCardsServerStore {
  waiting: WaitingPlayer[];
  matches: Record<string, MatchRecord>;
  asyncScores: AsyncScoreEntry[];
}

const STORE_KEY = "__katchupFlipCardsStore";

function now(): number {
  return Date.now();
}

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${now()}`;
}

function shuffleArray<T>(items: T[]): T[] {
  const clone = [...items];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function buildQuestions(language: SupportedLanguage): ServerQuestion[] {
  const allWords = getAllWords(language);
  const selected = shuffleArray(allWords).slice(0, 10);

  return selected.map((word) => {
    const wrong = shuffleArray(
      allWords
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

function getStore(): FlipCardsServerStore {
  const globalRef = globalThis as unknown as Record<
    string,
    FlipCardsServerStore
  >;
  if (!globalRef[STORE_KEY]) {
    globalRef[STORE_KEY] = {
      waiting: [],
      matches: {},
      asyncScores: [],
    };
  }

  return globalRef[STORE_KEY];
}

export function findPlayerMatch(playerId: string): MatchRecord | null {
  const store = getStore();
  const allMatches = Object.values(store.matches);
  return allMatches.find((match) => Boolean(match.players[playerId])) ?? null;
}

export function joinMatchmaking(params: {
  playerId: string;
  name: string;
  avatar: string;
  language: SupportedLanguage;
  level: string;
}) {
  const store = getStore();
  const existingMatch = findPlayerMatch(params.playerId);
  if (existingMatch) {
    return {
      type: "matched" as const,
      match: existingMatch,
    };
  }

  const waitingIndex = store.waiting.findIndex(
    (entry) =>
      entry.playerId !== params.playerId &&
      entry.language === params.language &&
      entry.level === params.level,
  );

  if (waitingIndex >= 0) {
    const opponent = store.waiting[waitingIndex];
    store.waiting.splice(waitingIndex, 1);

    const matchId = randomId("match");
    const questions = buildQuestions(params.language);
    const playerAOrder = shuffleArray(questions.map((question) => question.id));
    const playerBOrder = shuffleArray(questions.map((question) => question.id));

    const created: MatchRecord = {
      id: matchId,
      language: params.language,
      level: params.level,
      status: "active",
      createdAt: now(),
      updatedAt: now(),
      winnerId: null,
      totalQuestions: questions.length,
      questions,
      playerOrder: {
        [params.playerId]: playerAOrder,
        [opponent.playerId]: playerBOrder,
      },
      players: {
        [params.playerId]: {
          id: params.playerId,
          name: params.name,
          avatar: params.avatar,
          progress: 0,
          correct: 0,
        },
        [opponent.playerId]: {
          id: opponent.playerId,
          name: opponent.name,
          avatar: opponent.avatar,
          progress: 0,
          correct: 0,
        },
      },
    };

    store.matches[matchId] = created;

    return {
      type: "matched" as const,
      match: created,
    };
  }

  const existingQueue = store.waiting.find(
    (entry) => entry.playerId === params.playerId,
  );

  if (!existingQueue) {
    store.waiting.push({
      playerId: params.playerId,
      name: params.name,
      avatar: params.avatar,
      language: params.language,
      level: params.level,
      queuedAt: now(),
    });
  }

  return {
    type: "waiting" as const,
  };
}

export function getMatchForPlayer(params: {
  playerId: string;
  language: SupportedLanguage;
  level: string;
}) {
  const store = getStore();
  const existingMatch = findPlayerMatch(params.playerId);
  if (existingMatch) {
    return {
      status: "matched" as const,
      match: existingMatch,
    };
  }

  const waiting = store.waiting.some(
    (entry) =>
      entry.playerId === params.playerId &&
      entry.language === params.language &&
      entry.level === params.level,
  );

  return {
    status: waiting ? ("waiting" as const) : ("idle" as const),
  };
}

function findQuestion(
  match: MatchRecord,
  questionId: string,
): ServerQuestion | null {
  return match.questions.find((question) => question.id === questionId) ?? null;
}

export function submitAnswer(params: {
  matchId: string;
  playerId: string;
  questionId: string;
  selectedOption: string;
}) {
  const store = getStore();
  const match = store.matches[params.matchId];

  if (!match) {
    return { ok: false as const, error: "Match not found" };
  }

  if (match.status === "finished") {
    return { ok: false as const, error: "Match already finished" };
  }

  const player = match.players[params.playerId];
  if (!player) {
    return { ok: false as const, error: "Player not found in match" };
  }

  const order = match.playerOrder[params.playerId];
  if (!order) {
    return { ok: false as const, error: "Player order not found" };
  }

  const expectedQuestionId = order[player.progress];
  if (expectedQuestionId !== params.questionId) {
    return { ok: false as const, error: "Out of order answer" };
  }

  const question = findQuestion(match, params.questionId);
  if (!question) {
    return { ok: false as const, error: "Question not found" };
  }

  const isCorrect = question.correctOption === params.selectedOption;
  if (isCorrect) {
    player.correct += 1;
  }

  player.progress += 1;
  if (player.progress >= match.totalQuestions) {
    player.finishedAt = now();
    if (!match.winnerId) {
      match.winnerId = player.id;
      match.status = "finished";
    }
  }

  if (
    Object.values(match.players).every(
      (entry) => entry.progress >= match.totalQuestions,
    )
  ) {
    match.status = "finished";
  }

  match.updatedAt = now();

  return {
    ok: true as const,
    isCorrect,
    match,
  };
}

export function getMatchSnapshot(matchId: string): MatchRecord | null {
  const store = getStore();
  return store.matches[matchId] ?? null;
}

export function saveAsyncScore(params: {
  playerId: string;
  name: string;
  avatar: string;
  language: SupportedLanguage;
  level: string;
  score: number;
  correct: number;
  timeMs: number;
}) {
  const store = getStore();
  const entry: AsyncScoreEntry = {
    id: randomId("async-score"),
    playerId: params.playerId,
    name: params.name,
    avatar: params.avatar,
    language: params.language,
    level: params.level,
    score: params.score,
    correct: params.correct,
    timeMs: params.timeMs,
    createdAt: now(),
  };

  store.asyncScores.push(entry);

  store.asyncScores.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return a.timeMs - b.timeMs;
  });

  if (store.asyncScores.length > 300) {
    store.asyncScores = store.asyncScores.slice(0, 300);
  }

  return entry;
}

export function getAsyncLeaderboard(
  language: SupportedLanguage,
  level: string,
) {
  const store = getStore();
  const filtered = store.asyncScores.filter(
    (entry) => entry.language === language && entry.level === level,
  );

  return filtered.slice(0, 10);
}
