// Client-side wrappers around the deck sharing API.

export type ShareRole = "viewer" | "editor";

export interface ShareLink {
  code: string;
  role: ShareRole;
  createdAt: string;
}

export interface DeckMember {
  userId: string;
  name: string | null;
  image: string | null;
  role: ShareRole;
  joinedAt: string;
}

export interface SharePreview {
  deckId: string;
  name: string;
  nativeLang: string;
  foreignLang: string;
  wordCount: number;
  ownerName: string | null;
  role: ShareRole;
  sampleWords: Array<{ native: string; foreign: string }>;
}

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!response.ok || !data) {
    throw new Error(data?.error ?? `Request failed (${response.status})`);
  }
  return data;
}

/** The full share URL to hand to a friend. */
export function buildShareUrl(code: string): string {
  const origin =
    typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/deck/${code}`;
}

export async function fetchShareState(deckId: string): Promise<{
  share: ShareLink | null;
  members: DeckMember[];
}> {
  const response = await fetch(`/api/decks/${deckId}/share`);
  return readJson(response);
}

export async function saveShareLink(
  deckId: string,
  role: ShareRole,
): Promise<ShareLink> {
  const response = await fetch(`/api/decks/${deckId}/share`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  const data = await readJson<{ share: ShareLink }>(response);
  return data.share;
}

export async function revokeShareLink(deckId: string): Promise<void> {
  const response = await fetch(`/api/decks/${deckId}/share`, {
    method: "DELETE",
  });
  await readJson(response);
}

export async function updateMemberRole(
  deckId: string,
  memberUserId: string,
  role: ShareRole,
): Promise<void> {
  const response = await fetch(`/api/decks/${deckId}/members/${memberUserId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  await readJson(response);
}

export async function removeMember(
  deckId: string,
  memberUserId: string,
): Promise<void> {
  const response = await fetch(`/api/decks/${deckId}/members/${memberUserId}`, {
    method: "DELETE",
  });
  await readJson(response);
}

/** Leaves a deck someone else shared with you. */
export async function leaveDeck(deckId: string): Promise<void> {
  await removeMember(deckId, "me");
}

export async function fetchSharePreview(code: string): Promise<SharePreview> {
  const response = await fetch(`/api/decks/shared/${code}`);
  const data = await readJson<{ preview: SharePreview }>(response);
  return data.preview;
}

export async function joinSharedDeck(code: string): Promise<{
  status: "joined" | "already" | "owner";
  deckId: string;
}> {
  const response = await fetch(`/api/decks/shared/${code}`, {
    method: "POST",
  });
  return readJson(response);
}
