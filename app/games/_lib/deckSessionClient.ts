// Client-side wrappers around the deck + spaced-repetition API. Every call is
// auth-gated server-side; callers should handle the `unauthorized` status.

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
}

export interface DeckSession {
  deckId: string;
  deckName: string;
  mode: "practice" | "finish";
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
}

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

export async function listDecks(
  scope?: "all",
): Promise<{ decks: DeckMeta[] }> {
  const query = scope ? `?scope=${scope}` : "";
  return apiFetch(`/api/decks${query}`);
}

export async function getDeck(deckId: string): Promise<{ deck: DeckWithWords }> {
  return apiFetch(`/api/decks/${deckId}`);
}

export async function createDeck(input: {
  name: string;
  nativeLang: string;
  foreignLang: string;
  words?: WordInput[];
}): Promise<{ deck: DeckWithWords }> {
  return apiFetch(`/api/decks`, {
    method: "POST",
    body: JSON.stringify(input),
  });
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
  return apiFetch(`/api/decks/${deckId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteDeck(deckId: string): Promise<{ ok: boolean }> {
  return apiFetch(`/api/decks/${deckId}`, { method: "DELETE" });
}

export async function fetchSession(
  deckId: string,
  options: { mode?: "practice" | "finish"; size?: number } = {},
): Promise<DeckSession> {
  const params = new URLSearchParams();
  if (options.mode) params.set("mode", options.mode);
  if (options.size) params.set("size", String(options.size));
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
): Promise<DeckProgressSummary> {
  const data = await apiFetch<{ progress: DeckProgressSummary }>(
    `/api/decks/${deckId}/progress`,
  );
  return data.progress;
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
