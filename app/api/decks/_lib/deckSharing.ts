// Link sharing for custom decks.
//
// A share is live, not a copy: the link points at the deck itself, so words the
// owner adds later appear for everyone who joined, and an "editor" link lets
// friends add words back. Progress is unaffected — it hangs off the vocabulary
// item, so two people practising one deck each keep their own boxes.

import { randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { deckMembers, deckShares, deckWords, decks, users } from "@/db/schema";
import { getDeckRole, type DeckRole } from "./deckStore";

/** Roles a share link can hand out. Ownership is never shared. */
export type ShareRole = Exclude<DeckRole, "owner">;

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

/** What someone sees before joining — enough to decide, not the whole deck. */
export interface SharePreview {
  deckId: string;
  name: string;
  nativeLang: string;
  foreignLang: string;
  wordCount: number;
  ownerName: string | null;
  role: ShareRole;
  /** A short taste of the deck, so the page is not just a name and a button. */
  sampleWords: Array<{ native: string; foreign: string }>;
}

/** Words shown on the preview page before joining. */
const PREVIEW_WORD_LIMIT = 5;

export function toShareRole(value: unknown): ShareRole {
  return value === "editor" ? "editor" : "viewer";
}

/**
 * 16 random URL-safe characters. Long enough that the link is the credential:
 * guessing one is not a practical way in, which is what lets the preview page
 * work without a sign-in.
 */
function newShareCode(): string {
  return randomBytes(12).toString("base64url");
}

/** The deck's current link, or null when it has never been shared. */
export async function getShareLink(
  userId: string,
  deckId: string,
): Promise<ShareLink | null> {
  if ((await getDeckRole(userId, deckId)) !== "owner") {
    return null;
  }

  const [row] = await db
    .select()
    .from(deckShares)
    .where(eq(deckShares.deckId, deckId))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    code: row.code,
    role: toShareRole(row.role),
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Creates the deck's link, or changes what an existing one grants.
 *
 * Changing the role deliberately keeps the same code: the owner flipping a
 * deck to "friends can edit" should not break the link they already sent.
 * Rotating the URL is what `revokeShareLink` is for.
 */
export async function upsertShareLink(
  userId: string,
  deckId: string,
  role: ShareRole,
): Promise<ShareLink | null> {
  if ((await getDeckRole(userId, deckId)) !== "owner") {
    return null;
  }

  const [row] = await db
    .insert(deckShares)
    .values({ deckId, code: newShareCode(), role })
    .onConflictDoUpdate({
      target: deckShares.deckId,
      set: { role, updatedAt: new Date() },
    })
    .returning();

  return {
    code: row.code,
    role: toShareRole(row.role),
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Kills the link. People who already joined keep their access — remove them
 * individually if that is the point.
 */
export async function revokeShareLink(
  userId: string,
  deckId: string,
): Promise<boolean> {
  if ((await getDeckRole(userId, deckId)) !== "owner") {
    return false;
  }

  await db.delete(deckShares).where(eq(deckShares.deckId, deckId));
  return true;
}

/** Public: resolves a link to a preview, without needing a session. */
export async function getSharePreview(
  code: string,
): Promise<SharePreview | null> {
  const [row] = await db
    .select({
      deckId: decks.id,
      name: decks.name,
      nativeLang: decks.nativeLang,
      foreignLang: decks.foreignLang,
      role: deckShares.role,
      ownerName: users.name,
    })
    .from(deckShares)
    .innerJoin(decks, eq(decks.id, deckShares.deckId))
    .leftJoin(users, eq(users.id, decks.ownerUserId))
    .where(eq(deckShares.code, code))
    .limit(1);

  if (!row) {
    return null;
  }

  const words = await db
    .select({ native: deckWords.native, foreign: deckWords.foreign })
    .from(deckWords)
    .where(eq(deckWords.deckId, row.deckId));

  return {
    deckId: row.deckId,
    name: row.name,
    nativeLang: row.nativeLang,
    foreignLang: row.foreignLang,
    wordCount: words.length,
    ownerName: row.ownerName,
    role: toShareRole(row.role),
    sampleWords: words.slice(0, PREVIEW_WORD_LIMIT),
  };
}

export type JoinResult =
  | { status: "joined" | "already"; deckId: string; role: DeckRole }
  | { status: "owner"; deckId: string; role: "owner" }
  | { status: "not-found" };

/**
 * Adds the user to the deck behind a share link.
 *
 * The role is copied onto the membership row rather than read through the link
 * on every request: the owner can then change one person's rights, or turn the
 * link read-only, without rewriting what everyone else already has.
 */
export async function joinSharedDeck(
  userId: string,
  code: string,
): Promise<JoinResult> {
  const [share] = await db
    .select({
      deckId: deckShares.deckId,
      role: deckShares.role,
      ownerUserId: decks.ownerUserId,
    })
    .from(deckShares)
    .innerJoin(decks, eq(decks.id, deckShares.deckId))
    .where(eq(deckShares.code, code))
    .limit(1);

  if (!share) {
    return { status: "not-found" };
  }

  if (share.ownerUserId === userId) {
    return { status: "owner", deckId: share.deckId, role: "owner" };
  }

  const [existing] = await db
    .select({ role: deckMembers.role })
    .from(deckMembers)
    .where(
      and(
        eq(deckMembers.deckId, share.deckId),
        eq(deckMembers.userId, userId),
      ),
    )
    .limit(1);

  if (existing) {
    return {
      status: "already",
      deckId: share.deckId,
      role: toShareRole(existing.role),
    };
  }

  const role = toShareRole(share.role);
  await db
    .insert(deckMembers)
    .values({ deckId: share.deckId, userId, role })
    .onConflictDoNothing();

  return { status: "joined", deckId: share.deckId, role };
}

/** Everyone the deck is shared with. Owner only. */
export async function listDeckMembers(
  userId: string,
  deckId: string,
): Promise<DeckMember[] | null> {
  if ((await getDeckRole(userId, deckId)) !== "owner") {
    return null;
  }

  const rows = await db
    .select({
      userId: deckMembers.userId,
      role: deckMembers.role,
      joinedAt: deckMembers.createdAt,
      name: users.name,
      image: users.image,
    })
    .from(deckMembers)
    .innerJoin(users, eq(users.id, deckMembers.userId))
    .where(eq(deckMembers.deckId, deckId));

  return rows.map((row) => ({
    userId: row.userId,
    name: row.name,
    image: row.image,
    role: toShareRole(row.role),
    joinedAt: row.joinedAt.toISOString(),
  }));
}

/** Owner changes one member's rights. */
export async function setMemberRole(
  ownerId: string,
  deckId: string,
  memberUserId: string,
  role: ShareRole,
): Promise<boolean> {
  if ((await getDeckRole(ownerId, deckId)) !== "owner") {
    return false;
  }

  await db
    .update(deckMembers)
    .set({ role })
    .where(
      and(
        eq(deckMembers.deckId, deckId),
        eq(deckMembers.userId, memberUserId),
      ),
    );
  return true;
}

/**
 * Removes someone from a deck. The owner may remove anyone; anyone else may
 * only remove themselves (that is the "leave this deck" button).
 */
export async function removeDeckMember(
  actingUserId: string,
  deckId: string,
  memberUserId: string,
): Promise<boolean> {
  const isSelf = actingUserId === memberUserId;
  if (!isSelf && (await getDeckRole(actingUserId, deckId)) !== "owner") {
    return false;
  }

  await db
    .delete(deckMembers)
    .where(
      and(
        eq(deckMembers.deckId, deckId),
        eq(deckMembers.userId, memberUserId),
      ),
    );
  return true;
}
