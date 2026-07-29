// Client-side wrappers around the deck + spaced-repetition API. Every call is
// auth-gated server-side; callers should handle the `unauthorized` status.

import { clearCachedDecks } from "./deckCache";

export interface WordStatSummary {
  box: number;
  streak: number;
  timesSeen: number;
  timesCorrect: number;
  timesWrong: number;
  known: boolean;
  lastSeenAt: string | null;
}

export interface SessionWord {
  id: string;
  native: string;
  foreign: string;
  orderIndex: number;
  stat: WordStatSummary | null;
}

export interface DeckProgressSummary {
  total: number;
  known: number;
  learning: number;
  unseen: number;
  /** Answered right at least once — the tier a topic level finishes on. */
  cleared: number;
}

export interface DeckSession {
  deckId: string;
  deckName: string;
  mode: "practice" | "finish";
  /** Topic level this session covers, or null for the whole deck. */
  level: number | null;
  words: SessionWord[];
  summary: DeckProgressSummary;
}

export interface DeckWordRecord {
  id: string;
  native: string;
  foreign: string;
  orderIndex: number;
}

export interface DeckMeta {
  id: string;
  ownerUserId: string | null;
  kind: "topic" | "custom";
  topicKey: string | null;
  name: string;
  nativeLang: string;
  foreignLang: string;
  wordCount: number;
  /** Words mastered in this deck; 0 when signed out. */
  knownCount: number;
  /**
   * What this user may do with the deck: "owner" for their own, "editor" or
   * "viewer" for one a friend shared with them, null for topic decks.
   */
  role?: "owner" | "editor" | "viewer" | null;
  /** Who shared it, when it is not the user's own deck. */
  ownerName?: string | null;
}

export interface DeckWithWords extends DeckMeta {
  words: DeckWordRecord[];
}

export interface WordInput {
  id?: string;
  native: string;
  foreign: string;
}

export interface AttemptInput {
  deckWordId: string;
  correct: boolean;
  /** Streak weight of one correct answer; defaults to 1 on the server. */
  steps?: number;
}

/**
 * Streak weight of saying "I know this" outright — swiping a flip card right or
 * tapping the know-it button. A stronger claim than picking one of three
 * options, so it counts as two practices and the second one earns mastery.
 * These used to mark the word known on the spot, off a single unverified tap.
 */
export const CONFIDENT_ANSWER_STEPS = 2;

/**
 * Words in a pack's legendary round: everything still unlearned, hardest first,
 * topped up from the rest of the pack. Mirrors LEGENDARY_REVIEW_SIZE on the
 * server, which is what actually picks them.
 */
export const LEGENDARY_REVIEW_SIZE = 30;

/**
 * How much of a legendary round has to come back "know it" for the pack to earn
 * its crown. Playing the thirty cards through was enough at first, which made
 * the title a matter of patience rather than of knowing the words.
 */
export const LEGENDARY_PASS_PERCENT = 85;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function apiFetch<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const data = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const message =
      (data as { error?: string } | null)?.error ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

/**
 * Lists decks. Passing the language pair the user is studying also lets the
 * server create their starter deck if they own no custom deck for it yet.
 */
export async function listDecks(options?: {
  scope?: "all";
  nativeLang?: string;
  foreignLang?: string;
}): Promise<{ decks: DeckMeta[] }> {
  const params = new URLSearchParams();
  if (options?.scope) params.set("scope", options.scope);
  if (options?.nativeLang) params.set("nativeLang", options.nativeLang);
  if (options?.foreignLang) params.set("foreignLang", options.foreignLang);
  const query = params.toString();
  return apiFetch(`/api/decks${query ? `?${query}` : ""}`);
}

export async function getDeck(deckId: string): Promise<{ deck: DeckWithWords }> {
  return apiFetch(`/api/decks/${deckId}`);
}

// The three calls below change the list itself, so the local copy of it goes.
// Anything finer-grained would have to guess at what the server made of the
// change — a starter deck created alongside it, a rename, a word count.

export async function createDeck(input: {
  name: string;
  nativeLang: string;
  foreignLang: string;
  words?: WordInput[];
}): Promise<{ deck: DeckWithWords }> {
  const result = await apiFetch<{ deck: DeckWithWords }>(`/api/decks`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  clearCachedDecks();
  return result;
}

export async function updateDeck(
  deckId: string,
  input: {
    name?: string;
    nativeLang?: string;
    foreignLang?: string;
    words?: WordInput[];
  },
): Promise<{ deck: DeckWithWords }> {
  const result = await apiFetch<{ deck: DeckWithWords }>(
    `/api/decks/${deckId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
  clearCachedDecks();
  return result;
}

export async function deleteDeck(deckId: string): Promise<{ ok: boolean }> {
  const result = await apiFetch<{ ok: boolean }>(`/api/decks/${deckId}`, {
    method: "DELETE",
  });
  clearCachedDecks();
  return result;
}

export async function fetchSession(
  deckId: string,
  options: {
    mode?: "practice" | "finish";
    size?: number;
    /** Topic level 1..5; scopes the round to that level's slice of the deck. */
    level?: number;
  } = {},
): Promise<DeckSession> {
  const params = new URLSearchParams();
  if (options.mode) params.set("mode", options.mode);
  if (options.size) params.set("size", String(options.size));
  if (options.level) params.set("level", String(options.level));
  const query = params.toString();
  return apiFetch(`/api/decks/${deckId}/session${query ? `?${query}` : ""}`);
}

/**
 * Fresh mastery counts for a deck. The summary bundled with a session is a
 * snapshot from when that session started, so end-of-round screens ask for
 * this instead.
 */
export async function fetchDeckProgress(
  deckId: string,
  level?: number,
): Promise<DeckProgressSummary> {
  const query = level ? `?level=${level}` : "";
  const data = await apiFetch<{ progress: DeckProgressSummary }>(
    `/api/decks/${deckId}/progress${query}`,
  );
  return data.progress;
}

/** Mastery counts for every topic level of a deck, in level order (1..5). */
export async function fetchDeckLevelProgress(
  deckId: string,
): Promise<DeckProgressSummary[]> {
  const data = await apiFetch<{ levels: DeckProgressSummary[] }>(
    `/api/decks/${deckId}/progress/levels`,
  );
  return data.levels;
}

export async function postAttempts(
  deckId: string,
  attempts: AttemptInput[],
): Promise<{ recorded: number }> {
  return apiFetch(`/api/decks/${deckId}/attempts`, {
    method: "POST",
    body: JSON.stringify({ attempts }),
  });
}

export async function setWordKnown(
  deckId: string,
  deckWordId: string,
  known: boolean,
): Promise<{ ok: boolean }> {
  return apiFetch(`/api/decks/${deckId}/known`, {
    method: "POST",
    body: JSON.stringify({ deckWordId, known }),
  });
}
